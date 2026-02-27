import { Hono } from "hono";
import { getSession, getAccessToken, updateSessionCookie } from "../helpers/auth";
import { getDomain, isPublicEmail } from "../helpers/html";
import {
  listMeetings,
  getMeeting,
  createAndStoreMeeting,
  getStoredToken,
  storeToken,
  getEmailByAlias,
  getOrCreateAlias,
} from "../helpers/kv";
import { createMeetSpace } from "../helpers/meet";
import { redirectPage } from "../pages/redirect";
import { selectionPage } from "../pages/selection";
import { errorPage } from "../pages/error";
import { mePage } from "../pages/me";

const meetRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /
 *
 * ?owner=<alias> — direct link to a specific user's meeting via opaque alias:
 *   - Always works regardless of org boundaries
 *   - Resolves alias → email → stored token → meeting (create if needed)
 *
 * No ?owner — visibility depends on user type:
 *   - Logged out: public (gmail.com) meetings only. Empty → sign-in CTA.
 *   - Gmail user: public meetings only. Auto-creates own if missing.
 *   - Org user: same-domain meetings by default. ?public=1 shows public meetings.
 *     Auto-creates own if missing.
 */
meetRoutes.get("/", async (c) => {
  const { MEET_KV } = c.env;
  const session = await getSession(c);
  const ownerAlias = c.req.query("owner");
  const showPublic = c.req.query("public") === "1";

  try {
    // --- ?owner=<alias> direct link (always works, no org filtering) ---
    if (ownerAlias) {
      const ownerEmail = await getEmailByAlias(MEET_KV, ownerAlias);
      if (!ownerEmail) {
        return c.html(
          errorPage(
            "invalid link",
            "This direct link is invalid or the user hasn't signed in yet.",
            "/home"
          ),
          404
        );
      }

      const storedToken = await getStoredToken(MEET_KV, ownerEmail);
      if (!storedToken) {
        return c.html(
          errorPage(
            "user not found",
            "This user's session has expired. They need to sign in again.",
            "/home"
          ),
          404
        );
      }

      const existing = await getMeeting(MEET_KV, ownerEmail);
      if (existing) {
        return c.html(redirectPage(existing.url));
      }

      const { entry } = await createAndStoreMeeting(
        MEET_KV,
        storedToken.refreshToken,
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
        ownerEmail,
        storedToken.name
      );
      return c.html(redirectPage(entry.url));
    }

    // --- Normal / behavior with org/public filtering ---
    const allMeetings = await listMeetings(MEET_KV);

    if (!session) {
      // Logged out — show public meetings only
      const publicMeetings = allMeetings.filter((m) => isPublicEmail(m.email));

      if (publicMeetings.length === 0) {
        return c.html(
          selectionPage([], null, false, null, null)
        );
      }

      if (publicMeetings.length === 1) {
        return c.html(redirectPage(publicMeetings[0].url));
      }

      return c.html(selectionPage(publicMeetings, null, false));
    }

    // --- Logged-in user ---
    const userDomain = getDomain(session.email);
    const userIsPublic = isPublicEmail(session.email);

    // Determine which meetings to show based on user type and ?public param
    let visibleMeetings: typeof allMeetings;
    let orgDomain: string | null = null;

    if (userIsPublic) {
      // Gmail user — always sees public meetings
      visibleMeetings = allMeetings.filter((m) => isPublicEmail(m.email));
    } else if (showPublic) {
      // Org user viewing public meetings via ?public=1
      visibleMeetings = allMeetings.filter((m) => isPublicEmail(m.email));
      orgDomain = userDomain; // Still pass orgDomain so UI can show "back to org" link
    } else {
      // Org user default view — same domain only
      visibleMeetings = allMeetings.filter(
        (m) => getDomain(m.email) === userDomain
      );
      orgDomain = userDomain;
    }

    // Auto-create user's meeting if it doesn't exist yet
    const userMeetingExists = allMeetings.some(
      (m) => m.email === session.email
    );

    if (!userMeetingExists) {
      const { entry, newRefreshToken } = await createAndStoreMeeting(
        MEET_KV,
        session.refreshToken,
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
        session.email,
        session.name
      );

      if (newRefreshToken) {
        await updateSessionCookie(c, session, newRefreshToken);
      }

      // Add to visible list only if it passes the current filter
      const entryIsPublic = isPublicEmail(entry.email);
      const entryDomain = getDomain(entry.email);

      if (userIsPublic && entryIsPublic) {
        visibleMeetings.push(entry);
      } else if (!userIsPublic && showPublic && entryIsPublic) {
        visibleMeetings.push(entry);
      } else if (!userIsPublic && !showPublic && entryDomain === userDomain) {
        visibleMeetings.push(entry);
      }
    }

    if (visibleMeetings.length === 1) {
      return c.html(redirectPage(visibleMeetings[0].url));
    }

    const userAlias = await getOrCreateAlias(MEET_KV, session.email);
    return c.html(
      selectionPage(
        visibleMeetings,
        session.email,
        true,
        userAlias,
        orgDomain,
        showPublic
      )
    );
  } catch (err: any) {
    console.error("Failed to create meeting:", err);
    return c.html(
      errorPage(
        "failed to create meeting",
        err.message || "Unknown error occurred.",
        "/login"
      ),
      500
    );
  }
});

/**
 * GET /new
 * Always create a fresh meeting (not stored in KV). Requires authentication.
 */
meetRoutes.get("/new", async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.redirect("/login");
  }

  try {
    const { accessToken, newRefreshToken } = await getAccessToken(
      session.refreshToken,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET
    );

    // Persist rotated refresh token if present and update cookie
    if (newRefreshToken) {
      await Promise.all([
        storeToken(c.env.MEET_KV, session.email, newRefreshToken, session.name),
        updateSessionCookie(c, session, newRefreshToken),
      ]);
    }

    const meetUrl = await createMeetSpace(accessToken);

    return c.html(redirectPage(meetUrl));
  } catch (err: any) {
    console.error("Failed to create meeting:", err);
    return c.html(
      errorPage(
        "failed to create meeting",
        err.message || "Unknown error occurred.",
        "/login"
      ),
      500
    );
  }
});

/**
 * GET /me
 * Show the user's profile: name, email, and direct link alias.
 * Redirects to /login if not signed in.
 */
meetRoutes.get("/me", async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.redirect("/login");
  }

  const alias = await getOrCreateAlias(c.env.MEET_KV, session.email);
  return c.html(mePage(session.email, session.name, alias));
});

export { meetRoutes };

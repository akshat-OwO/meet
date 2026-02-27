import { Hono } from "hono";
import { DEFAULT_USER_KEY } from "../constants";
import { getSession, getAccessToken, updateSessionCookie } from "../helpers/auth";
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
 *   - Resolves the alias to the owner's email
 *   - Looks up the owner's stored refresh token from KV
 *   - If owner's meeting exists, redirect immediately
 *   - If not, create one using owner's token, then redirect
 *   - If alias is invalid or owner has never signed in, show error
 *
 * No ?owner (logged-in user):
 *   - List all meetings, auto-create user's if missing
 *   - 1 meeting → instant redirect, multiple → selection UI with auto-redirect
 *
 * No ?owner (not logged in):
 *   - List all meetings
 *   - 0 meetings → create with env fallback
 *   - 1 → redirect, multiple → selection UI (no auto-redirect)
 */
meetRoutes.get("/", async (c) => {
  const { MEET_KV } = c.env;
  const session = await getSession(c);
  const ownerAlias = c.req.query("owner");

  try {
    // --- ?owner=<alias> direct link ---
    if (ownerAlias) {
      // Resolve alias to email
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

      // Check if the owner has a stored refresh token
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

      // Check if the owner already has a meeting for today
      const existing = await getMeeting(MEET_KV, ownerEmail);
      if (existing) {
        return c.html(redirectPage(existing.url));
      }

      // Create a meeting on the owner's behalf using their stored token
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

    // --- Normal / behavior ---
    let meetings = await listMeetings(MEET_KV);

    if (session) {
      // Logged-in user
      const userMeeting = meetings.find((m) => m.email === session.email);

      if (!userMeeting) {
        const { entry, newRefreshToken } = await createAndStoreMeeting(
          MEET_KV,
          session.refreshToken,
          c.env.GOOGLE_CLIENT_ID,
          c.env.GOOGLE_CLIENT_SECRET,
          session.email,
          session.name
        );
        meetings.push(entry);

        // Update cookie if token was rotated
        if (newRefreshToken) {
          await updateSessionCookie(c, session, newRefreshToken);
        }
      }

      if (meetings.length === 1) {
        return c.html(redirectPage(meetings[0].url));
      }

      const userAlias = await getOrCreateAlias(MEET_KV, session.email);
      return c.html(selectionPage(meetings, session.email, true, userAlias));
    } else {
      // Not logged in
      if (meetings.length === 0) {
        const { entry } = await createAndStoreMeeting(
          MEET_KV,
          c.env.GOOGLE_REFRESH_TOKEN,
          c.env.GOOGLE_CLIENT_ID,
          c.env.GOOGLE_CLIENT_SECRET,
          DEFAULT_USER_KEY,
          "Default"
        );
        meetings.push(entry);
      }

      if (meetings.length === 1) {
        return c.html(redirectPage(meetings[0].url));
      }

      return c.html(selectionPage(meetings, null, false));
    }
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
 * Always create a fresh meeting (not stored in KV).
 */
meetRoutes.get("/new", async (c) => {
  try {
    const session = await getSession(c);
    const refreshToken = session
      ? session.refreshToken
      : c.env.GOOGLE_REFRESH_TOKEN;

    const { accessToken, newRefreshToken } = await getAccessToken(
      refreshToken,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET
    );

    // Persist rotated refresh token if present and update cookie
    if (newRefreshToken && session) {
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

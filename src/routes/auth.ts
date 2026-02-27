import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  SCOPES,
  COOKIE_NAME,
} from "../constants";
import {
  signCookie,
  decodeJwtPayload,
} from "../helpers/auth";
import { getBaseUrl } from "../helpers/html";
import { storeToken, getOrCreateAlias } from "../helpers/kv";
import { errorPage } from "../pages/error";
import type { UserSession } from "../types";

const authRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /login
 * Redirect to Google OAuth consent screen.
 */
authRoutes.get("/login", async (c) => {
  const redirectUri = `${getBaseUrl(c)}/callback`;

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  setCookie(c, "oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 300,
  });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/**
 * GET /callback
 * OAuth callback — exchange code for tokens, extract identity from id_token,
 * store session in cookie and refresh token in KV.
 */
authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) {
    return c.html(
      errorPage(
        "login failed",
        `Google returned an error: ${error}`,
        "/login"
      ),
      400
    );
  }

  if (!code) {
    return c.html(
      errorPage("login failed", "No authorization code received.", "/login"),
      400
    );
  }

  // Validate OAuth state
  const stateParam = c.req.query("state");
  const stateCookie = getCookie(c, "oauth_state");
  deleteCookie(c, "oauth_state", { path: "/" });

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return c.html(
      errorPage(
        "login failed",
        "Invalid OAuth state. Please try again.",
        "/login"
      ),
      400
    );
  }

  const redirectUri = `${getBaseUrl(c)}/callback`;

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
    };

    if (!data.refresh_token) {
      return c.html(
        errorPage(
          "login failed",
          "No refresh token received. Try revoking app access at myaccount.google.com/permissions and logging in again.",
          "/login"
        ),
        400
      );
    }

    if (!data.id_token) {
      return c.html(
        errorPage(
          "login failed",
          "No id_token received. Make sure the OAuth scope includes openid.",
          "/login"
        ),
        400
      );
    }

    // Extract user identity from id_token JWT
    const idPayload = decodeJwtPayload(data.id_token);
    const email = idPayload.email as string;
    const name = (idPayload.name as string) || email.split("@")[0];

    // Store refresh token with name and create alias in KV
    await Promise.all([
      storeToken(c.env.MEET_KV, email, data.refresh_token, name),
      getOrCreateAlias(c.env.MEET_KV, email),
    ]);

    const session: UserSession = {
      refreshToken: data.refresh_token,
      email,
      name,
    };

    // Store session in signed HTTP-only cookie (30 days)
    const signedValue = await signCookie(
      JSON.stringify(session),
      c.env.COOKIE_SECRET
    );
    setCookie(c, COOKIE_NAME, signedValue, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return c.redirect("/");
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return c.html(
      errorPage("login failed", err.message || "Unknown error.", "/login"),
      500
    );
  }
});

/**
 * GET /logout
 * Clear the auth cookie and redirect to /.
 */
authRoutes.get("/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.redirect("/");
});

export { authRoutes };

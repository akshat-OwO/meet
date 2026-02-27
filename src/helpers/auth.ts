import { getCookie, setCookie } from "hono/cookie";
import { COOKIE_NAME, GOOGLE_TOKEN_URL } from "../constants";
import type { UserSession } from "../types";

/** Sign a cookie value with HMAC-SHA256. Returns "payload.signature". */
export async function signCookie(
  value: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${value}.${sigB64}`;
}

/** Verify and extract a signed cookie value. Returns null if invalid. */
export async function verifyCookie(
  signed: string,
  secret: string
): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const expected = await signCookie(value, secret);
  if (expected !== signed) return null;
  return value;
}

/** Get the user session from cookie, or null if not logged in. */
export async function getSession(c: any): Promise<UserSession | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  try {
    const verified = await verifyCookie(raw, c.env.COOKIE_SECRET);
    if (!verified) return null;
    return JSON.parse(verified) as UserSession;
  } catch {
    return null;
  }
}

/** Result of a token refresh — includes new refresh token if Google rotated it. */
export interface TokenRefreshResult {
  accessToken: string;
  newRefreshToken?: string;
}

/** Exchange a refresh token for an access token. Returns new refresh token if rotated. */
export async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenRefreshResult> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    newRefreshToken: data.refresh_token,
  };
}

/** Decode JWT payload without verification (trusted — received directly from Google over HTTPS). */
export function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const payload = parts[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/** Update the session cookie with a new refresh token (after Google rotation). */
export async function updateSessionCookie(
  c: any,
  session: UserSession,
  newRefreshToken: string
): Promise<void> {
  const updated: UserSession = { ...session, refreshToken: newRefreshToken };
  const signedValue = await signCookie(
    JSON.stringify(updated),
    c.env.COOKIE_SECRET
  );
  setCookie(c, COOKIE_NAME, signedValue, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

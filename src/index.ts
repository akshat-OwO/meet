import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MEET_API_URL = "https://meet.googleapis.com/v2/spaces";
const SCOPES =
  "https://www.googleapis.com/auth/meetings.space.created openid email profile";
const KV_PREFIX = "meeting:";
const DEFAULT_USER_KEY = "__default__";
const COOKIE_NAME = "meet_session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MeetingEntry {
  url: string;
  name: string;
  email: string;
}

interface UserSession {
  refreshToken: string;
  email: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh; background: #fafafa; color: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
  }
  .container { width: 100%; max-width: 480px; padding: 32px; }
  a { color: #1a73e8; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

/** HTML-escape a string to prevent XSS when interpolating into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sign a cookie value with HMAC-SHA256 using COOKIE_SECRET. Returns "payload.signature". */
async function signCookie(
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
async function verifyCookie(
  signed: string,
  secret: string
): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const expected = await signCookie(value, secret);
  // Constant-time-ish comparison (sufficient for this use case)
  if (expected !== signed) return null;
  return value;
}

async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
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
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function createMeetSpace(accessToken: string): Promise<string> {
  const res = await fetch(MEET_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meet API error (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { meetingUri: string };
  return data.meetingUri;
}

/** Decode JWT payload without verification (we trust it -- received directly from Google over HTTPS). */
function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const payload = parts[1];
  // Base64url -> base64
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  // Handle non-ASCII (e.g. accented names) by decoding the Latin-1 string as UTF-8
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/** Get the user session from cookie, or null if not logged in. */
async function getSession(c: any): Promise<UserSession | null> {
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

/** List all meeting entries from KV (paginated). */
async function listMeetings(kv: KVNamespace): Promise<MeetingEntry[]> {
  const entries: MeetingEntry[] = [];
  let cursor: string | undefined;

  do {
    const list = await kv.list({
      prefix: KV_PREFIX,
      ...(cursor ? { cursor } : {}),
    });

    const page = await Promise.all(
      list.keys.map(async (key) => {
        const val = await kv.get(key.name);
        if (!val) return null;
        try {
          return JSON.parse(val) as MeetingEntry;
        } catch {
          return null;
        }
      })
    );
    entries.push(...page.filter((e): e is MeetingEntry => e !== null));

    cursor = list.list_complete ? undefined : (list.cursor as string);
  } while (cursor);

  return entries;
}

/** Store a meeting entry in KV. */
async function storeMeeting(
  kv: KVNamespace,
  email: string,
  entry: MeetingEntry
): Promise<void> {
  await kv.put(`${KV_PREFIX}${email}`, JSON.stringify(entry));
}

/** Create a meeting and store it in KV. Returns the entry. */
async function createAndStoreMeeting(
  kv: KVNamespace,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  email: string,
  name: string
): Promise<MeetingEntry> {
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret);
  const url = await createMeetSpace(accessToken);
  const entry: MeetingEntry = { url, name, email };
  await storeMeeting(kv, email, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// HTML pages
// ---------------------------------------------------------------------------

function redirectPage(meetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Redirecting to Meet</title>
  <style>
    ${BASE_STYLES}
    .spinner {
      width: 32px; height: 32px; margin: 0 auto 20px;
      border: 3px solid #e0e0e0; border-top-color: #1a73e8;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 13px; color: #666; }
    .url { margin-top: 12px; font-size: 12px; }
    .copied { margin-top: 8px; font-size: 11px; color: #0d904f; }
  </style>
</head>
<body>
  <div class="container" style="text-align:center">
    <div class="spinner"></div>
    <p>Redirecting to Meet...</p>
    <p class="copied" id="status"></p>
    <p class="url"><a href="${meetUrl}">${meetUrl}</a></p>
  </div>
  <script>
    (async () => {
      const url = ${JSON.stringify(meetUrl)};
      try {
        await navigator.clipboard.writeText(url);
        document.getElementById("status").textContent = "link copied to clipboard";
      } catch {
        document.getElementById("status").textContent = "";
      }
      setTimeout(() => { window.location.href = url; }, 600);
    })();
  </script>
</body>
</html>`;
}

function selectionPage(
  meetings: MeetingEntry[],
  currentUserEmail: string | null,
  autoRedirect: boolean
): string {
  const currentUserMeeting = currentUserEmail
    ? meetings.find((m) => m.email === currentUserEmail)
    : null;

  const meetingsJson = JSON.stringify(meetings);
  const autoRedirectUrl = currentUserMeeting ? currentUserMeeting.url : null;

  const isLoggedIn = currentUserEmail !== null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Meet</title>
  <style>
    ${BASE_STYLES}
    h1 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #888; margin-bottom: 24px; }
    .meeting {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border: 1px solid #e0e0e0; background: #fff;
      border-radius: 0; cursor: pointer; margin-bottom: 8px;
      transition: border-color 0.15s, background 0.15s;
    }
    .meeting:hover { border-color: #1a73e8; background: #f0f6ff; }
    .meeting.active { border-color: #1a73e8; background: #e8f0fe; }
    .meeting-info { flex: 1; min-width: 0; }
    .meeting-name { font-size: 13px; font-weight: 600; }
    .meeting-url { font-size: 11px; color: #888; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meeting-badge {
      font-size: 10px; font-weight: 600; color: #1a73e8;
      border: 1px solid #1a73e8; padding: 2px 8px;
      margin-left: 12px; white-space: nowrap;
    }
    .countdown {
      font-size: 11px; color: #888; text-align: center;
      margin-top: 16px; min-height: 16px;
    }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
    .btn {
      flex: 1; padding: 10px 16px; font-size: 12px;
      font-family: 'JetBrains Mono', monospace; font-weight: 500;
      border: 1px solid #e0e0e0; background: #fff; color: #1a1a1a;
      border-radius: 0; cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .btn:hover { border-color: #1a73e8; background: #f0f6ff; }
    .btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
    .btn-primary:hover { background: #1557b0; }
    .copied-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1a1a1a; color: #fff; padding: 8px 20px;
      font-size: 11px; font-family: 'JetBrains Mono', monospace;
      opacity: 0; transition: opacity 0.2s; pointer-events: none;
    }
    .copied-toast.show { opacity: 1; }
    .footer { margin-top: 24px; font-size: 11px; color: #aaa; text-align: center; }
    .footer a { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>meet</h1>
    <p class="subtitle">${isLoggedIn ? `signed in as ${escapeHtml(currentUserEmail!)}` : "not signed in"}</p>

    <div id="meetings"></div>

    <p class="countdown" id="countdown"></p>

    <div class="actions">
      ${
        isLoggedIn
          ? `<a href="/new" class="btn">new meeting</a>
             <a href="/logout" class="btn">logout</a>`
          : `<a href="/new" class="btn">create new</a>
             <a href="/login" class="btn btn-primary">sign in</a>`
      }
    </div>

    <div class="footer">
      ${isLoggedIn ? "" : '<a href="/login">sign in</a> to create your own daily meeting'}
    </div>
  </div>

  <div class="copied-toast" id="toast">link copied to clipboard</div>

  <script>
    const meetings = ${meetingsJson};
    const currentEmail = ${JSON.stringify(currentUserEmail)};
    const autoRedirectUrl = ${JSON.stringify(autoRedirectUrl)};
    const shouldAutoRedirect = ${autoRedirect && autoRedirectUrl ? "true" : "false"};

    let timer = null;
    let countdown = 2;
    let selectedUrl = autoRedirectUrl;

    const container = document.getElementById("meetings");
    const countdownEl = document.getElementById("countdown");
    const toast = document.getElementById("toast");

    function showToast() {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1500);
    }

    function render() {
      container.innerHTML = "";
      meetings.forEach(m => {
        const div = document.createElement("div");
        div.className = "meeting" + (selectedUrl === m.url ? " active" : "");

        const info = document.createElement("div");
        info.className = "meeting-info";

        const nameEl = document.createElement("div");
        nameEl.className = "meeting-name";
        nameEl.textContent = m.name;
        info.appendChild(nameEl);

        const urlEl = document.createElement("div");
        urlEl.className = "meeting-url";
        urlEl.textContent = m.url;
        info.appendChild(urlEl);

        div.appendChild(info);

        if (m.email === currentEmail) {
          const badge = document.createElement("span");
          badge.className = "meeting-badge";
          badge.textContent = "you";
          div.appendChild(badge);
        }

        div.addEventListener("click", () => selectMeeting(m.url));
        container.appendChild(div);
      });
    }

    function selectMeeting(url) {
      // Cancel any auto-redirect
      if (timer) { clearInterval(timer); timer = null; }
      selectedUrl = url;
      render();

      // Copy and redirect
      navigator.clipboard.writeText(url).then(() => showToast()).catch(() => {});
      setTimeout(() => { window.location.href = url; }, 500);
    }

    function startAutoRedirect() {
      if (!shouldAutoRedirect) return;
      countdown = 2;
      countdownEl.textContent = "redirecting in " + countdown + "s...";
      timer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          timer = null;
          navigator.clipboard.writeText(selectedUrl).then(() => {}).catch(() => {});
          window.location.href = selectedUrl;
        } else {
          countdownEl.textContent = "redirecting in " + countdown + "s...";
        }
      }, 1000);
    }

    render();
    startAutoRedirect();
  </script>
</body>
</html>`;
}

function errorPage(title: string, message: string, loginUrl?: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const loginLink = loginUrl
    ? `<p style="margin-top:16px"><a href="${escapeHtml(loginUrl)}">sign in with google</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    ${BASE_STYLES}
    h1 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #d93025; }
    p { font-size: 13px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container" style="text-align:center">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${loginLink}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /
 *
 * Logged-in user:
 *   - List all meetings from KV
 *   - If user has no meeting yet, create one
 *   - Show selection UI with 2s auto-redirect to their own meeting
 *
 * Not logged in:
 *   - List all meetings from KV
 *   - If none exist, create one with env fallback token
 *   - Show selection UI (no auto-redirect), with option to create new
 */
app.get("/", async (c) => {
  const { MEET_KV } = c.env;
  const session = await getSession(c);

  try {
    let meetings = await listMeetings(MEET_KV);

    if (session) {
      // Logged-in user
      const userMeeting = meetings.find((m) => m.email === session.email);

      if (!userMeeting) {
        // Create a meeting for this user
        const entry = await createAndStoreMeeting(
          MEET_KV,
          session.refreshToken,
          c.env.GOOGLE_CLIENT_ID,
          c.env.GOOGLE_CLIENT_SECRET,
          session.email,
          session.name
        );
        meetings.push(entry);
      }

      if (meetings.length === 1) {
        // Only one meeting -- just redirect directly
        return c.html(redirectPage(meetings[0].url));
      }

      // Multiple meetings -- show selection with auto-redirect
      return c.html(selectionPage(meetings, session.email, true));
    } else {
      // Not logged in
      if (meetings.length === 0) {
        // No meetings at all -- create one with env fallback
        const entry = await createAndStoreMeeting(
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
        // Only one meeting -- redirect directly
        return c.html(redirectPage(meetings[0].url));
      }

      // Multiple meetings -- show selection, no auto-redirect
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
 * Always create a new meeting (bypass KV). Does NOT store in KV.
 */
app.get("/new", async (c) => {
  try {
    const session = await getSession(c);
    const refreshToken = session
      ? session.refreshToken
      : c.env.GOOGLE_REFRESH_TOKEN;

    const accessToken = await getAccessToken(
      refreshToken,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET
    );
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
 * GET /login
 * Redirect to Google OAuth consent screen.
 */
app.get("/login", async (c) => {
  const redirectUri = `${getBaseUrl(c)}/callback`;

  // Generate a random state token for CSRF protection, store it in a short-lived cookie
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  setCookie(c, "oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 300, // 5 minutes
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
 * OAuth callback -- exchange code for tokens, extract identity from id_token,
 * store session in cookie.
 */
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) {
    return c.html(
      errorPage("login failed", `Google returned an error: ${error}`, "/login"),
      400
    );
  }

  if (!code) {
    return c.html(
      errorPage("login failed", "No authorization code received.", "/login"),
      400
    );
  }

  // Validate OAuth state to prevent CSRF
  const stateParam = c.req.query("state");
  const stateCookie = getCookie(c, "oauth_state");
  deleteCookie(c, "oauth_state", { path: "/" });

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return c.html(
      errorPage("login failed", "Invalid OAuth state. Please try again.", "/login"),
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

    const session: UserSession = {
      refreshToken: data.refresh_token,
      email,
      name,
    };

    // Store session in signed HTTP-only cookie (30 days)
    const signedValue = await signCookie(JSON.stringify(session), c.env.COOKIE_SECRET);
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
app.get("/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.redirect("/");
});

// ---------------------------------------------------------------------------
// Scheduled (Cron) Handler -- clears all daily meetings from KV
// ---------------------------------------------------------------------------

export default {
  fetch: app.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: CloudflareBindings,
    _ctx: ExecutionContext
  ) {
    let deleted = 0;
    let cursor: string | undefined;

    do {
      const list = await env.MEET_KV.list({
        prefix: KV_PREFIX,
        ...(cursor ? { cursor } : {}),
      });
      await Promise.all(list.keys.map((key) => env.MEET_KV.delete(key.name)));
      deleted += list.keys.length;
      cursor = list.list_complete ? undefined : (list.cursor as string);
    } while (cursor);

    console.log(`Cron: cleared ${deleted} meeting(s) from KV`);
  },
};

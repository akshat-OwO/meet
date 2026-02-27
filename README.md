# meet

A fast Google Meet link generator on Cloudflare Workers. Instead of waiting for `meet.new` to load, visit your worker URL and get instantly redirected to a cached daily meeting link.

Multiple users can sign in with Google — each gets their own daily meeting stored in Cloudflare KV. A cron job clears all meetings at midnight IST so you get a fresh link every day.

## How it works

1. You visit the worker URL
2. If you're signed in and have no meeting for today, one is created via the Google Meet REST API and stored in KV
3. If only one meeting exists, you're instantly redirected (link copied to clipboard)
4. If multiple users have meetings, you see a selection UI — your own meeting auto-redirects after 2 seconds, or click another to join theirs
5. At midnight IST (18:30 UTC), all meetings are cleared

### Routes

| Route | Behavior |
|-------|----------|
| `GET /` | List meetings, auto-create if needed, redirect or show selection UI |
| `GET /?owner=<id>` | Direct link to a specific user's daily meeting (opaque alias, no email exposed) |
| `GET /new` | Create a fresh meeting (not stored in KV), copy link, redirect |
| `GET /me` | View your profile, email, and shareable direct link |
| `GET /login` | Google OAuth consent screen |
| `GET /callback` | OAuth token exchange, stores session cookie |
| `GET /logout` | Clears session, redirects to `/` |
| `GET /home` | Landing page explaining how the app works |
| `GET /tnc` | Terms and Conditions |
| `GET /privacy-policy` | Privacy Policy |
| Cron `30 18 * * *` | Deletes all `meeting:*` keys from KV |

## Setup

### Prerequisites

- Node.js
- A [Google Cloud project](https://console.cloud.google.com/) with the Google Meet REST API enabled
- OAuth 2.0 credentials (Web application type) with `<your-worker-url>/callback` as an authorized redirect URI

### 1. Install dependencies

```
pnpm install
```

### 2. Create a KV namespace

```
wrangler kv namespace create MEET_KV
```

Update the `id` in `wrangler.jsonc` with the returned namespace ID.

### 3. Set secrets

Create a `.dev.vars` file for local development:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=a-fallback-refresh-token
COOKIE_SECRET=any-random-string
```

For production, use `wrangler secret put`:

```
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put COOKIE_SECRET
```

`GOOGLE_REFRESH_TOKEN` is used as a fallback for unauthenticated visitors to create meetings. You can obtain one by going through the OAuth flow once and extracting the refresh token.

### 4. Run locally

```
pnpm dev
```

### 5. Deploy

```
pnpm deploy
```

## Technical notes

- Uses the Google Meet REST API directly (`POST https://meet.googleapis.com/v2/spaces`) — no SDK dependencies
- User identity is extracted from the `id_token` JWT payload (decoded without verification since it's received directly from Google over HTTPS)
- Session is stored in an HTTP-only `meet_session` cookie (30-day expiry)
- KV keys are prefixed with `meeting:` (e.g., `meeting:user@example.com`), `token:` for refresh tokens, `alias:` and `email_alias:` for opaque user aliases
- Direct links use opaque aliases (`?owner=a1b2c3d4`) instead of email addresses to prevent email enumeration
- Zero static assets — the worker serves all HTML inline

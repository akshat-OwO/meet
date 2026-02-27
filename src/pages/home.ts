import { pageLayout } from "../styles";

export function homePage(): string {
  return pageLayout(
    "home",
    `
<h1>meet</h1>
<p>A fast, cached Google Meet link generator. Instead of waiting for <code>meet.new</code> to load every time, visit <a href="/">meet.akshat.pro</a> and get instantly redirected to your daily meeting link.</p>

<hr>

<h2>How it works</h2>

<p>When you visit the app, it creates a Google Meet link for you and caches it for the day. Every subsequent visit reuses the same link &mdash; no waiting, no extra clicks. At midnight IST, all links are cleared and fresh ones are generated on the next visit.</p>

<h3>Single user</h3>
<p>If you're the only person using the app, visiting <code>/</code> will either create a new daily meeting or reuse today's cached one. You're immediately redirected and the link is copied to your clipboard.</p>

<h3>Multiple users</h3>
<p>When multiple people have signed in, each person gets their own daily meeting stored separately. Visiting <code>/</code> shows a selection UI listing everyone's meetings. Your own meeting is auto-selected and redirects after 2 seconds. Click someone else's meeting to join theirs instead.</p>

<h3>Direct links with <code>?owner=</code></h3>
<p>Want to invite someone to <em>your</em> meeting without them having to pick from the list? Each signed-in user gets a unique, private link like:</p>
<pre><code>https://meet.akshat.pro/?owner=a1b2c3d4</code></pre>
<p>When anyone opens this link, they're taken directly to the owner's meeting. If the owner hasn't created one for the day yet, it's created automatically on their behalf. Visit <a href="/me">/me</a> to find your direct link. The link uses an opaque ID &mdash; your email is never exposed in the URL.</p>

<h3>Ad-hoc meetings</h3>
<p>Visit <code>/new</code> to create a one-off meeting that isn't cached or stored. Useful for quick throwaway calls.</p>

<hr>

<h2>Routes</h2>

<table>
  <tr><th>Route</th><th>Behavior</th></tr>
  <tr><td><code>/</code></td><td>List or create daily meetings, auto-redirect</td></tr>
  <tr><td><code>/?owner=id</code></td><td>Redirect to a specific user's daily meeting</td></tr>
  <tr><td><code>/new</code></td><td>Create a fresh one-off meeting</td></tr>
  <tr><td><code>/me</code></td><td>View your profile and direct link</td></tr>
  <tr><td><code>/login</code></td><td>Sign in with Google</td></tr>
  <tr><td><code>/logout</code></td><td>Clear your session</td></tr>
</table>

<hr>

<h2>Technical details</h2>

<ul>
  <li>Built on <strong>Cloudflare Workers</strong> with the <strong>Hono</strong> framework</li>
  <li>Uses the Google Meet REST API directly &mdash; no SDK, no extra dependencies</li>
  <li>Meetings are stored in <strong>Cloudflare KV</strong> with a daily cron cleanup at midnight IST (18:30 UTC)</li>
  <li>OAuth sessions are stored in HMAC-signed HTTP-only cookies</li>
  <li>Zero static assets &mdash; all HTML is served inline from the worker</li>
</ul>

<hr>

<p style="margin-top: 20px; text-align: center;">
  <a href="/login" style="display: inline-block; padding: 10px 24px; background: #1a73e8; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; border: none;">sign in with google</a>
</p>
`
  );
}

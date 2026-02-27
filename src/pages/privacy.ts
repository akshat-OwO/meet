import { pageLayout } from "../styles";

export function privacyPage(): string {
  return pageLayout(
    "Privacy Policy",
    `
<h1>Privacy Policy</h1>
<p><em>Last updated: February 2026</em></p>

<hr>

<h2>1. Information We Collect</h2>
<p>When you sign in with Google, we receive and store the following information:</p>
<ul>
  <li><strong>Email address</strong> &mdash; used to identify your account and store your daily meeting link</li>
  <li><strong>Display name</strong> &mdash; shown in the meeting selection UI so other users can identify meetings</li>
  <li><strong>OAuth refresh token</strong> &mdash; used to create Google Meet meetings on your behalf without requiring you to sign in each time</li>
</ul>

<h2>2. How We Use Your Information</h2>
<p>Your information is used solely to:</p>
<ul>
  <li>Create Google Meet meeting spaces on your behalf via the Google Meet REST API</li>
  <li>Cache your daily meeting link so it can be reused throughout the day</li>
  <li>Display your name alongside your meeting in the selection UI</li>
  <li>Allow other users to join your meeting via the <code>?owner=</code> direct link feature</li>
</ul>

<h2>3. Data Storage</h2>
<ul>
  <li><strong>Session cookie</strong> &mdash; your session (email, name, refresh token) is stored in an HMAC-signed, HTTP-only, secure cookie in your browser with a 30-day expiry</li>
  <li><strong>Cloudflare KV</strong> &mdash; your daily meeting link (URL, name, email) is stored server-side in Cloudflare KV and automatically deleted at midnight IST each day</li>
  <li><strong>Refresh token</strong> &mdash; stored separately in Cloudflare KV (not deleted daily) to support the direct link feature. It is never exposed to other users or sent to the browser</li>
</ul>

<h2>4. Data Sharing</h2>
<p>We do not sell, trade, or share your personal information with any third parties. Your data is only used within the service to provide its functionality. The only external service we communicate with is the Google API (for authentication and meeting creation).</p>

<h2>5. Data Visible to Other Users</h2>
<p>When multiple users are signed in, the following is visible to other users of the service:</p>
<ul>
  <li>Your display name</li>
  <li>Your meeting link for the day</li>
</ul>
<p>Your email address and refresh token are never exposed to other users.</p>

<h2>6. Data Retention</h2>
<ul>
  <li><strong>Meeting links</strong> are automatically deleted daily at midnight IST (18:30 UTC)</li>
  <li><strong>Refresh tokens</strong> persist in KV until you revoke access or they are manually removed</li>
  <li><strong>Session cookies</strong> expire after 30 days</li>
</ul>

<h2>7. How to Delete Your Data</h2>
<p>To remove your data from the service:</p>
<ol>
  <li>Visit <code>/logout</code> to clear your session cookie</li>
  <li>Revoke the app's access in your <a href="https://myaccount.google.com/permissions">Google Account permissions</a> to invalidate your stored refresh token</li>
</ol>
<p>For complete data removal from KV storage, contact us at <a href="https://akshat.pro">akshat.pro</a>.</p>

<h2>8. Security</h2>
<ul>
  <li>Session cookies are HTTP-only, secure, SameSite=Lax, and HMAC-signed</li>
  <li>OAuth flow includes CSRF protection via state parameter</li>
  <li>Refresh tokens stored in KV are never sent to the client</li>
  <li>All communication with Google APIs is over HTTPS</li>
</ul>

<h2>9. Google API Services</h2>
<p>This application's use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>10. Changes to This Policy</h2>
<p>This privacy policy may be updated at any time. Changes will be reflected on this page with an updated date.</p>

<h2>11. Contact</h2>
<p>For questions about this privacy policy or your data, visit <a href="https://akshat.pro">akshat.pro</a>.</p>
`
  );
}

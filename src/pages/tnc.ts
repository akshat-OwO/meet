import { pageLayout } from "../styles";

export function tncPage(): string {
  return pageLayout(
    "Terms and Conditions",
    `
<h1>Terms and Conditions</h1>
<p><em>Last updated: February 2026</em></p>

<hr>

<h2>1. Acceptance of Terms</h2>
<p>By accessing or using meet (<a href="https://meet.akshat.pro">meet.akshat.pro</a>), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the service.</p>

<h2>2. Description of Service</h2>
<p>meet is a web application that generates and caches daily Google Meet links. It uses the Google Meet REST API to create meeting spaces on behalf of authenticated users. The service is hosted on Cloudflare Workers.</p>

<h2>3. Google Account Authorization</h2>
<p>To use the full functionality of the service, you must authorize it with your Google account. By doing so, you grant meet permission to:</p>
<ul>
  <li>Create Google Meet meeting spaces on your behalf</li>
  <li>Access your basic profile information (name and email address)</li>
</ul>
<p>You can revoke this access at any time through your <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.</p>

<h2>4. User Responsibilities</h2>
<ul>
  <li>You are responsible for maintaining the security of your Google account</li>
  <li>You agree not to misuse the service or attempt to access other users' data</li>
  <li>You understand that meetings created through the service are subject to Google's own Terms of Service</li>
</ul>

<h2>5. Service Availability</h2>
<p>The service is provided on an "as is" and "as available" basis. There is no guarantee of uptime, availability, or reliability. The service may be modified, suspended, or discontinued at any time without notice.</p>

<h2>6. Data and Meeting Links</h2>
<ul>
  <li>Daily meeting links are cached and automatically cleared at midnight IST (18:30 UTC) each day</li>
  <li>The service does not store meeting content, recordings, or participant information</li>
  <li>Meeting links generated through the service are Google Meet links and are subject to Google's policies</li>
</ul>

<h2>7. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, the service and its operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service, including but not limited to loss of data, unauthorized access to meetings, or service interruptions.</p>

<h2>8. Changes to Terms</h2>
<p>These terms may be updated at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>

<h2>9. Contact</h2>
<p>For questions about these terms, visit <a href="https://akshat.pro">akshat.pro</a>.</p>
`
  );
}

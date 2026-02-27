import { escapeHtml } from "../helpers/html";
import { BASE_STYLES } from "../styles";

export function errorPage(
  title: string,
  message: string,
  loginUrl?: string
): string {
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

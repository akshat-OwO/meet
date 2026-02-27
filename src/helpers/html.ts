/** HTML-escape a string to prevent XSS when interpolating into HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Extract the base URL (protocol + host) from a Hono context. */
export function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

/** Extract the domain from an email address. */
export function getDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase();
}

/** Check if an email is a public (gmail.com) address. */
export function isPublicEmail(email: string): boolean {
  return getDomain(email) === "gmail.com";
}

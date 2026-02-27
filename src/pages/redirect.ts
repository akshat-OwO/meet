import { BASE_STYLES } from "../styles";
import { escapeHtml } from "../helpers/html";

export function redirectPage(meetUrl: string): string {
  const escaped = escapeHtml(meetUrl);
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
    <p class="url"><a href="${escaped}">${escaped}</a></p>
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

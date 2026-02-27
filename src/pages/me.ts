import { escapeHtml } from "../helpers/html";
import { BASE_STYLES } from "../styles";

export function mePage(email: string, name: string, alias: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>me - meet</title>
  <style>
    ${BASE_STYLES}
    h1 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #888; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .value { font-size: 13px; font-weight: 500; }
    .direct-link {
      padding: 12px 16px; background: #f8f8f8;
      border: 1px solid #e0e0e0; margin-top: 4px;
    }
    .direct-link code {
      display: block; font-size: 12px; padding: 4px 0;
      word-break: break-all; cursor: pointer; user-select: all;
    }
    .copy-btn {
      margin-top: 8px; padding: 6px 14px; font-size: 11px;
      font-family: 'JetBrains Mono', monospace; font-weight: 500;
      border: 1px solid #e0e0e0; background: #fff; color: #1a1a1a;
      cursor: pointer; transition: border-color 0.15s, background 0.15s;
    }
    .copy-btn:hover { border-color: #1a73e8; background: #f0f6ff; }
    .actions { margin-top: 24px; display: flex; gap: 8px; }
    .btn {
      flex: 1; padding: 10px 16px; font-size: 12px;
      font-family: 'JetBrains Mono', monospace; font-weight: 500;
      border: 1px solid #e0e0e0; background: #fff; color: #1a1a1a;
      text-align: center; transition: border-color 0.15s, background 0.15s;
    }
    .btn:hover { border-color: #1a73e8; background: #f0f6ff; }
    .btn-danger:hover { border-color: #d93025; background: #fce8e6; }
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1a1a1a; color: #fff; padding: 8px 20px;
      font-size: 11px; font-family: 'JetBrains Mono', monospace;
      opacity: 0; transition: opacity 0.2s; pointer-events: none;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>me</h1>
    <p class="subtitle">your account</p>

    <div class="section">
      <div class="label">name</div>
      <div class="value">${escapeHtml(name)}</div>
    </div>

    <div class="section">
      <div class="label">email</div>
      <div class="value">${escapeHtml(email)}</div>
    </div>

    <div class="section">
      <div class="label">your direct link</div>
      <div class="direct-link">
        <code id="directLink">/?owner=${escapeHtml(alias)}</code>
        <button class="copy-btn" onclick="copyLink()">copy full link</button>
      </div>
    </div>

    <div class="actions">
      <a href="/" class="btn">back to app</a>
      <a href="/logout" class="btn btn-danger">logout</a>
    </div>
  </div>

  <div class="toast" id="toast">link copied to clipboard</div>

  <script>
    function copyLink() {
      var el = document.getElementById("directLink");
      var link = window.location.origin + el.textContent;
      navigator.clipboard.writeText(link).then(function() {
        var toast = document.getElementById("toast");
        toast.classList.add("show");
        setTimeout(function() { toast.classList.remove("show"); }, 1500);
      }).catch(function() {});
    }
  </script>
</body>
</html>`;
}

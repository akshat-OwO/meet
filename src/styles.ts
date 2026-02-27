export const BASE_STYLES = `
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

export const PROSE_STYLES = `
  .prose { max-width: 640px; line-height: 1.7; }
  .prose h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .prose h2 { font-size: 15px; font-weight: 600; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  .prose h3 { font-size: 13px; font-weight: 600; margin-top: 20px; margin-bottom: 6px; }
  .prose p { font-size: 12px; color: #444; margin-bottom: 12px; }
  .prose ul, .prose ol { font-size: 12px; color: #444; margin-bottom: 12px; padding-left: 20px; }
  .prose li { margin-bottom: 4px; }
  .prose code { font-size: 11px; background: #f0f0f0; padding: 2px 6px; border: 1px solid #e0e0e0; }
  .prose pre { font-size: 11px; background: #f0f0f0; padding: 12px 16px; border: 1px solid #e0e0e0; margin-bottom: 12px; overflow-x: auto; }
  .prose pre code { background: none; border: none; padding: 0; }
  .prose blockquote { border-left: 3px solid #1a73e8; padding-left: 12px; margin-bottom: 12px; color: #666; font-size: 12px; }
  .prose hr { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
  .prose table { font-size: 12px; border-collapse: collapse; width: 100%; margin-bottom: 12px; }
  .prose th, .prose td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: left; }
  .prose th { background: #f0f0f0; font-weight: 600; }
  .nav { font-size: 11px; margin-bottom: 24px; color: #888; }
  .nav a { color: #888; margin-right: 12px; }
  .nav a:hover { color: #1a73e8; }
  .footer { font-size: 11px; color: #aaa; margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 12px; }
  .footer a { color: #888; margin-right: 12px; }
`;

/** Wraps content in the shared page layout with nav and footer. */
import { escapeHtml } from "./helpers/html";

export function pageLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(title)} - meet</title>
  <style>
    ${BASE_STYLES}
    ${PROSE_STYLES}
    body { align-items: flex-start; padding: 48px 24px; }
    .container { max-width: 640px; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/home">home</a>
      <a href="/">app</a>
      <a href="/tnc">terms</a>
      <a href="/privacy-policy">privacy</a>
    </nav>
    <div class="prose">
      ${content}
    </div>
    <div class="footer">
      <a href="/home">home</a>
      <a href="/tnc">terms</a>
      <a href="/privacy-policy">privacy</a>
    </div>
  </div>
</body>
</html>`;
}

import { escapeHtml } from "../helpers/html";
import { BASE_STYLES } from "../styles";
import type { MeetingEntry } from "../types";

/** Client-safe meeting data — no email field. */
interface ClientMeeting {
  url: string;
  name: string;
  isCurrentUser: boolean;
}

export function selectionPage(
  meetings: MeetingEntry[],
  currentUserEmail: string | null,
  autoRedirect: boolean,
  userAlias?: string | null
): string {
  // Strip emails before serializing to client
  const clientMeetings: ClientMeeting[] = meetings.map((m) => ({
    url: m.url,
    name: m.name,
    isCurrentUser: currentUserEmail !== null && m.email === currentUserEmail,
  }));

  const currentUserMeeting = clientMeetings.find((m) => m.isCurrentUser) ?? null;
  const meetingsJson = JSON.stringify(clientMeetings);
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
    .direct-link {
      margin-top: 16px; padding: 10px 14px; background: #f8f8f8;
      border: 1px solid #e0e0e0; font-size: 11px; text-align: center;
    }
    .direct-link code {
      display: inline-block; padding: 2px 6px; background: #fff;
      border: 1px solid #e0e0e0; cursor: pointer; user-select: all;
    }
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

    ${
      userAlias
        ? `<div class="direct-link">
             your direct link: <code id="directLink" onclick="copyDirectLink()">/?owner=${escapeHtml(userAlias)}</code>
           </div>`
        : ""
    }

    <div class="footer">
      ${isLoggedIn ? "" : '<a href="/login">sign in</a> to create your own daily meeting'}
    </div>
  </div>

  <div class="copied-toast" id="toast">link copied to clipboard</div>

  <script>
    const meetings = ${meetingsJson};
    const autoRedirectUrl = ${JSON.stringify(autoRedirectUrl)};
    const shouldAutoRedirect = ${autoRedirect && autoRedirectUrl ? "true" : "false"};

    let timer = null;
    let countdown = 2;
    let selectedUrl = autoRedirectUrl;

    const container = document.getElementById("meetings");
    const countdownEl = document.getElementById("countdown");
    const toast = document.getElementById("toast");

    function showToast(msg) {
      toast.textContent = msg || "link copied to clipboard";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1500);
    }

    function copyDirectLink() {
      const el = document.getElementById("directLink");
      if (!el) return;
      const link = window.location.origin + el.textContent;
      navigator.clipboard.writeText(link).then(() => showToast("direct link copied")).catch(() => {});
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

        if (m.isCurrentUser) {
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
      if (timer) { clearInterval(timer); timer = null; }
      selectedUrl = url;
      render();

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

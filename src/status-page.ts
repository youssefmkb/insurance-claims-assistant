// src/status-page.ts
//
// Page de statut publique servie sur GET /. Elle n'expose aucun secret
// et n'appelle jamais Claude.

import { readFileSync } from "node:fs";
import { analyzeClaimTool } from "./tools/analyze-claim.js";
import { classifyClaimTool } from "./tools/classify-claim.js";
import { generateNotificationTool } from "./tools/generate-notification.js";

const REPO_URL = "https://github.com/youssefmkb/insurance-claims-assistant";

// dist/status-page.js -> ../package.json à la racine du projet
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const TOOLS = [analyzeClaimTool, classifyClaimTool, generateNotificationTool];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export function renderStatusPage(): string {
  const toolItems = TOOLS.map(
    (tool) =>
      `<li><code>${escapeHtml(tool.name)}</code><p>${escapeHtml(tool.description)}</p></li>`,
  ).join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Insurance Claims Assistant MCP</title>
  <style>
    :root { --bg: #f7f7f5; --card: #ffffff; --text: #1d1d1b; --muted: #66665f; --border: #e3e3de; --ok: #1f7a4d; --code: #efefea; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #161615; --card: #1f1f1d; --text: #ececea; --muted: #a3a39c; --border: #33332f; --ok: #4cc38a; --code: #2a2a27; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 48px 16px; background: var(--bg); color: var(--text); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 26px; margin: 0 0 4px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 32px 0 12px; }
    .status { display: inline-flex; align-items: center; gap: 8px; color: var(--ok); font-weight: 600; }
    .status::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--ok); }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    code { background: var(--code); padding: 1px 6px; border-radius: 4px; font-size: 14px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li + li { border-top: 1px solid var(--border); margin-top: 14px; padding-top: 14px; }
    li p { margin: 6px 0 0; color: var(--muted); }
    .note { color: var(--muted); font-size: 14px; margin-top: 32px; }
    a { color: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>Insurance Claims Assistant</h1>
    <p class="status">Online</p>
    <p>Remote MCP server for car insurance claim processing: entity extraction, severity triage with an LLM-as-judge pipeline, and broker notifications.</p>

    <h2>Connection</h2>
    <div class="card">
      <dl>
        <dt>Endpoint</dt><dd><code>POST /mcp</code></dd>
        <dt>Transport</dt><dd>Streamable HTTP, stateless</dd>
        <dt>Auth</dt><dd><code>Authorization: Bearer &lt;token&gt;</code> required</dd>
        <dt>Version</dt><dd>${escapeHtml(version)}</dd>
        <dt>Uptime</dt><dd>${formatUptime(process.uptime())}</dd>
      </dl>
    </div>

    <h2>Tools</h2>
    <div class="card">
      <ul>
        ${toolItems}
      </ul>
    </div>

    <p class="note">Portfolio project deployed as a technical demo, not used by real customers. Source code and documentation on <a href="${REPO_URL}">GitHub</a>.</p>
  </main>
</body>
</html>`;
}

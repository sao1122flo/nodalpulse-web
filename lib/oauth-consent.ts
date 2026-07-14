// Branded OAuth consent page for the MCP connector (WS-A).
//
// Passed to mcp().oidcConfig.getConsentHTML — better-auth renders this HTML string
// at the consent step of the authorize flow. It must be fully self-contained
// (no external assets) because it's served raw by the OAuth provider.
//
// Submit contract (pinned vs better-auth 1.6.9 oidc-provider/index.mjs):
//   POST /api/auth/oauth2/consent   application/json
//     body: { accept: boolean, consent_code: string }   // consent_code = props.code
//     200:  { redirectURI: string }                      // browser must navigate here to resume OAuth
// A plain <form> POST won't do — it needs JSON + to follow the returned redirectURI —
// so we drive it with a small inline fetch handler.

export interface ConsentProps {
  clientId:       string
  clientName:     string
  clientIcon?:    string | undefined
  clientMetadata: Record<string, unknown> | null
  code:           string
  scopes:         string[]
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  )

const SCOPE_LABELS: Record<string, string> = {
  openid:          "Confirm your identity",
  profile:         "Your name",
  email:           "Your email address",
  offline_access:  "Stay connected (refresh access)",
}

export function renderConsentHTML(props: ConsentProps): string {
  const client = esc(props.clientName || "An application")
  // Embed as JSON so untrusted values can't break out of the JS string context.
  const codeJson = JSON.stringify(props.code)

  const scopeItems = props.scopes
    .map((s) => `<li>${esc(SCOPE_LABELS[s] ?? s)}</li>`)
    .join("")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect ${client} to NodalPulse</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b1220; color: #e6edf6; padding: 24px;
  }
  .card {
    width: 100%; max-width: 420px; background: #111a2e; border: 1px solid #223052;
    border-radius: 14px; padding: 28px; box-shadow: 0 12px 40px rgba(0,0,0,.4);
  }
  .brand { font-weight: 700; letter-spacing: -.01em; font-size: 18px; margin: 0 0 4px; }
  .brand span { color: #4c9ffe; }
  h1 { font-size: 17px; font-weight: 600; margin: 20px 0 6px; }
  p.sub { color: #9fb0c9; margin: 0 0 16px; }
  .ro {
    display: inline-block; font-size: 12px; font-weight: 600; color: #7ee0b8;
    background: rgba(46,160,120,.12); border: 1px solid rgba(46,160,120,.35);
    padding: 2px 9px; border-radius: 999px; margin-bottom: 14px;
  }
  ul { margin: 0 0 22px; padding-left: 18px; color: #cdd8ea; }
  ul li { margin: 4px 0; }
  .row { display: flex; gap: 10px; }
  button {
    flex: 1; padding: 11px 14px; border-radius: 10px; font-size: 14px; font-weight: 600;
    cursor: pointer; border: 1px solid transparent;
  }
  .allow { background: #2f6df6; color: #fff; }
  .allow:hover { background: #245ad6; }
  .deny { background: transparent; color: #9fb0c9; border-color: #2a3a5e; }
  .deny:hover { color: #e6edf6; }
  button:disabled { opacity: .55; cursor: default; }
  .err { color: #ff8a8a; font-size: 13px; margin-top: 12px; min-height: 18px; }
  .note { color: #6b7d99; font-size: 12px; margin-top: 16px; }
</style>
</head>
<body>
  <div class="card">
    <p class="brand">Nodal<span>Pulse</span></p>
    <div class="ro">Read-only access</div>
    <h1>${client} wants to connect to your Record</h1>
    <p class="sub">It will be able to read your verified regulatory Record — your tracked dockets, deadlines, and mentions, always with source links. It cannot change or delete anything.</p>
    <ul>${scopeItems}</ul>
    <div class="row">
      <button class="deny"  id="deny"  type="button">Deny</button>
      <button class="allow" id="allow" type="button">Allow</button>
    </div>
    <div class="err" id="err"></div>
    <p class="note">You can disconnect anytime from NodalPulse → Settings → Connections.</p>
  </div>
<script>
  (function () {
    var CODE = ${codeJson};
    var allow = document.getElementById("allow");
    var deny  = document.getElementById("deny");
    var err   = document.getElementById("err");
    function submit(accept) {
      allow.disabled = true; deny.disabled = true; err.textContent = "";
      fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept: accept, consent_code: CODE }),
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.j && res.j.redirectURI) { window.location.href = res.j.redirectURI; return; }
        throw new Error((res.j && (res.j.error_description || res.j.message)) || "Consent failed");
      })
      .catch(function (e) {
        err.textContent = e.message || "Something went wrong. Please try again.";
        allow.disabled = false; deny.disabled = false;
      });
    }
    allow.addEventListener("click", function () { submit(true); });
    deny.addEventListener("click",  function () { submit(false); });
  })();
</script>
</body>
</html>`
}

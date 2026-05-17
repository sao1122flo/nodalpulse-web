// keep visual structure in sync with services/nodalpulse/email/templates.py build_brief_html() — drift = sample looks dated

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO_STACK =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace"

export const SAMPLE_BRIEF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>NodalPulse &middot; Example Brief</title>
  <style>
    body {
      font-family: ${FONT_STACK};
      font-size: 14px;
      line-height: 1.55;
      color: #44403C;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .header {
      border-bottom: 1px solid #E5E5E7;
      padding-bottom: 16px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .logo {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #18181B;
      text-decoration: none;
    }
    .logo-pulse { color: #6366F1; }
    .header-meta { float: right; font-size: 13px; color: #71717A; margin-top: 2px; }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #71717A;
      margin: 24px 0 12px;
      border-top: 1px solid #E5E5E7;
      padding-top: 16px;
    }
    .item {
      padding-bottom: 20px;
      margin-bottom: 20px;
      border-bottom: 1px solid #F1F1F3;
    }
    .item-header { overflow: hidden; margin-bottom: 4px; }
    .item-title {
      font-size: 15px;
      font-weight: 600;
      color: #18181B;
      line-height: 1.3;
      margin: 0;
    }
    .item-summary { font-size: 14px; color: #44403C; margin: 6px 0 8px; line-height: 1.55; }
    .citation {
      font-family: ${MONO_STACK};
      font-size: 11px;
      color: #6366F1;
      text-decoration: none;
    }
    .cta {
      display: inline-block;
      font-size: 12px;
      font-weight: 500;
      color: #6366F1;
      text-decoration: none;
      float: right;
      margin-left: 12px;
    }
    .footer {
      border-top: 1px solid #E5E5E7;
      padding-top: 16px;
      margin-top: 24px;
      font-size: 12px;
      color: #71717A;
    }
    .footer-stamp {
      margin-top: 8px;
      display: block;
      font-family: ${MONO_STACK};
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400E;font-weight:500;">
      &#9888; Sample data &mdash; not a live brief. Citations and links are illustrative only.
    </div>

    <div class="header">
      <span class="logo">Nodal<span class="logo-pulse">Pulse</span></span>
      <div class="header-meta">Example Brief &middot; 5 items</div>
    </div>

    <div class="section-title">Top of mind</div>

    <div class="item">
      <div class="item-header">
        <span class="cta">Open &#x2192;</span>
        <div class="item-title">Commission approves interconnection queue reform &mdash; 18-month implementation window</div>
      </div>
      <div class="item-summary">PUCT grants partial approval of ERCOT&apos;s proposed queue reform, requiring updated position-securing deposits and enhanced transmission constraint modeling by Q4 2026.</div>
      <span class="citation">[SAMPLE-PUCT, p.1 &para;1]</span>
    </div>

    <div class="item">
      <div class="item-header">
        <span class="cta">Open &#x2192;</span>
        <div class="item-title">Order 1000 compliance: highway/byway cost allocation methodology revised for 345kV+ facilities</div>
      </div>
      <div class="item-summary">Transmission provider proposes revised cost allocation for facilities above 345kV, triggering 30-day public comment period ending June 15.</div>
      <span class="citation">[SAMPLE-PUCT, p.1 &para;1]</span>
    </div>

    <div class="section-title">What changed</div>

    <div class="item">
      <div class="item-header">
        <span class="cta">Open &#x2192;</span>
        <div class="item-title">NPRR1287 &mdash; Real-time co-optimization: effective date extended to January 2027</div>
      </div>
      <div class="item-summary">ERCOT confirms 6-month delay for RTC deployment following reliability assessment; stakeholder comment window reopened through next month.</div>
      <span class="citation">[SAMPLE-NPRR, p.1 &para;1]</span>
    </div>

    <div class="item">
      <div class="item-header">
        <span class="cta">Open &#x2192;</span>
        <div class="item-title">CREZ transmission line rating update filed with commission</div>
      </div>
      <div class="item-summary">Transmission owner requests revised emergency operating limit for CREZ West segment following summer loading analysis; effective pending PUCT review.</div>
      <span class="citation">[SAMPLE-PUCT, p.1 &para;1]</span>
    </div>

    <div class="item">
      <div class="item-header">
        <span class="cta">Open &#x2192;</span>
        <div class="item-title">Rate case settlement: interim fuel cost factor approved at 4.2&cent;/kWh</div>
      </div>
      <div class="item-summary">Commission accepts stipulation adjusting fuel factor effective next billing cycle; final order pending evidentiary hearing scheduled for August.</div>
      <span class="citation">[SAMPLE-PUCT, p.1 &para;1]</span>
    </div>

    <div class="footer">
      <span style="color:#92400E;font-weight:500;">Sample brief &mdash; your personalized version arrives tomorrow at 6 AM CT.</span>
      <span class="footer-stamp">sample &middot; not generated by LLM &middot; illustrative only</span>
    </div>

  </div>
</body>
</html>`

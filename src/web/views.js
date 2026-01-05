function layout(title, body, user, active = "") {
  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "config", label: "Config", href: "/config" },
    { key: "blackouts", label: "Blackouts", href: "/blackouts" },
  ];

  const navHtml = navItems.map(i => `
    <a class="nav-item ${active === i.key ? "active" : ""}" href="${i.href}">
      <span class="dot"></span>
      <span>${i.label}</span>
    </a>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>

  <style>
    :root{
      --bg: #0b1020;
      --panel: #101a33;
      --panel-2: #0f1730;
      --border: rgba(255,255,255,0.08);
      --text: rgba(255,255,255,0.92);
      --muted: rgba(255,255,255,0.65);
      --muted2: rgba(255,255,255,0.45);

      --accent: #4f8cff;
      --accent-2: #6ee7ff;

      --requested: #4f8cff; /* blue */
      --review: #ffcc66;    /* amber */
      --accepted: #2bd576;  /* green */
      --declined: #ff5a67;  /* red */
      --cancelled: #9aa4b2; /* grey */
      --completed: #6ee7ff; /* cyan */

      --radius: 16px;
      --shadow: 0 10px 30px rgba(0,0,0,0.35);
      --shadow-soft: 0 6px 18px rgba(0,0,0,0.22);
    }

    *{ box-sizing:border-box; }
    html,body{ height:100%; }
    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background: radial-gradient(1200px 600px at 10% -10%, rgba(79,140,255,0.25), transparent 60%),
                  radial-gradient(900px 450px at 90% 0%, rgba(110,231,255,0.18), transparent 55%),
                  var(--bg);
      color: var(--text);
    }

    a{ color: var(--accent); text-decoration:none; }
    a:hover{ text-decoration:underline; }

    .app{ min-height:100vh; display:grid; grid-template-columns: 260px 1fr; }

    .sidebar{
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      border-right: 1px solid var(--border);
      padding: 18px 14px;
      position: sticky;
      top: 0;
      height: 100vh;
    }

    .brand{ display:flex; align-items:center; gap:10px; padding: 10px 12px 14px 12px; margin-bottom: 10px; }
    .logo{
      width:38px;height:38px;border-radius: 12px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: var(--shadow-soft);
    }
    .brand h1{ font-size: 14px; margin:0; letter-spacing:0.2px; line-height:1.2; }
    .brand p{ margin:2px 0 0 0; font-size: 12px; color: var(--muted); }

    .nav{ display:flex; flex-direction:column; gap: 8px; padding: 8px 6px; }
    .nav-item{
      display:flex; align-items:center; gap:10px;
      padding: 10px 12px; border-radius: 12px;
      color: var(--text);
      border: 1px solid transparent;
      background: transparent;
    }
    .nav-item .dot{ width:10px;height:10px;border-radius: 999px;background: rgba(255,255,255,0.2); }
    .nav-item:hover{ border-color: var(--border); background: rgba(255,255,255,0.04); text-decoration:none; }
    .nav-item.active{ background: rgba(79,140,255,0.14); border-color: rgba(79,140,255,0.35); }
    .nav-item.active .dot{ background: var(--accent); box-shadow: 0 0 0 4px rgba(79,140,255,0.18); }

    .main{ padding: 18px 18px 60px 18px; }

    .topbar{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      background: rgba(16,26,51,0.55);
      backdrop-filter: blur(10px);
      border-radius: var(--radius);
      box-shadow: var(--shadow-soft);
      margin-bottom: 16px;
    }
    .topbar .title{ font-size: 16px; font-weight: 700; letter-spacing: 0.2px; }

    .userbox{ display:flex; align-items:center; gap:10px; color: var(--muted); font-size: 13px; white-space:nowrap; }
    .chip{
      display:inline-flex; align-items:center; gap:8px;
      padding: 8px 10px; border-radius: 999px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      color: var(--text);
    }
    .avatar{
      width: 20px; height: 20px; border-radius: 999px;
      background: linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.08));
    }

    .grid{ display:grid; grid-template-columns: 1fr; gap: 14px; }

    .card{
      border: 1px solid var(--border);
      background: rgba(16,26,51,0.55);
      backdrop-filter: blur(10px);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: var(--shadow-soft);
    }

    .card h3{ margin:0 0 10px 0; font-size: 14px; letter-spacing: 0.2px; }
    .muted{ color: var(--muted); }
    .small{ font-size: 12px; color: var(--muted); }

    table{
      width:100%;
      border-collapse: collapse;
      overflow:hidden;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.12);
    }
    th,td{
      padding: 10px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      vertical-align: top;
    }
    th{
      text-align:left;
      color: var(--muted);
      font-weight: 600;
      background: rgba(255,255,255,0.03);
    }
    tr:hover td{ background: rgba(255,255,255,0.03); }

    code{
      padding:2px 6px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.22);
      color: var(--text);
      font-size: 12px;
    }

    label{ display:block; font-size: 12px; color: var(--muted); margin: 10px 0 6px 0; }
    input,select,textarea{
      width:100%;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.18);
      color: var(--text);
      outline: none;
    }
    textarea{ min-height: 90px; resize: vertical; }
    input:focus,select:focus,textarea:focus{
      border-color: rgba(79,140,255,0.55);
      box-shadow: 0 0 0 4px rgba(79,140,255,0.15);
    }

    .btnrow{ display:flex; gap:10px; flex-wrap:wrap; margin-top: 10px; }

    button, .btn{
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.06);
      color: var(--text);
      cursor:pointer;
      font-weight: 600;
      font-size: 13px;
    }
    button:hover, .btn:hover{ background: rgba(255,255,255,0.09); }

    .btn-primary{
      border-color: rgba(79,140,255,0.45);
      background: rgba(79,140,255,0.18);
    }
    .btn-primary:hover{ background: rgba(79,140,255,0.26); }

    /* Badges */
    .badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.05);
      font-size: 12px;
      color: var(--text);
      white-space: nowrap;
    }

    /* ✅ Per-status badge colours */
    .badge.requested{ border-color: rgba(79,140,255,0.45); background: rgba(79,140,255,0.16); }
    .badge.review{ border-color: rgba(255,204,102,0.45); background: rgba(255,204,102,0.14); }
    .badge.accepted{ border-color: rgba(43,213,118,0.45); background: rgba(43,213,118,0.14); }
    .badge.declined{ border-color: rgba(255,90,103,0.45); background: rgba(255,90,103,0.14); }
    .badge.cancelled{ border-color: rgba(154,164,178,0.45); background: rgba(154,164,178,0.14); }
    .badge.completed{ border-color: rgba(110,231,255,0.45); background: rgba(110,231,255,0.14); }

    /* ✅ Optional: tint status buttons slightly (still keeps btn-primary for selected) */
    .status-btn.status-requested{ border-color: rgba(79,140,255,0.25); }
    .status-btn.status-review{ border-color: rgba(255,204,102,0.25); }
    .status-btn.status-accepted{ border-color: rgba(43,213,118,0.25); }
    .status-btn.status-declined{ border-color: rgba(255,90,103,0.25); }
    .status-btn.status-cancelled{ border-color: rgba(154,164,178,0.25); }
    .status-btn.status-completed{ border-color: rgba(110,231,255,0.25); }

    @media (max-width: 900px){
      .app{ grid-template-columns: 1fr; }
      .sidebar{
        position: relative;
        height:auto;
        border-right:none;
        border-bottom: 1px solid var(--border);
      }
      .main{ padding: 14px; }
    }
  </style>
</head>

<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>Elite Convoys</h1>
          <p>Booking System</p>
        </div>
      </div>

      <nav class="nav">
        ${user ? navHtml : `<div class="small muted" style="padding:10px 12px;">Login to access the panel.</div>`}
      </nav>

      <div style="padding:12px;">
        <div class="small muted">Tip</div>
        <div class="small" style="margin-top:6px;color:var(--muted);">
          Use the Dashboard to manage bookings and update statuses — the Discord ticket embed updates automatically.
        </div>
      </div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div class="title">${title}</div>
        <div class="userbox">
          ${user ? `
            <span class="chip"><span class="avatar"></span> ${user.username}#${user.discriminator}</span>
            <a class="btn" href="/logout">Logout</a>
          ` : `<a class="btn btn-primary" href="/login">Login with Discord</a>`}
        </div>
      </div>

      <div class="grid">
        ${body}
      </div>
    </main>
  </div>
</body>
</html>`;
}

module.exports = { layout };

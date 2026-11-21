/* Neon Peach — customer service dashboard logic (vanilla JS, no build). */
(function () {
  "use strict";

  // ---------- Dictionaries ----------
  const CATEGORIES = {
    reservation: { label: "הזמנת מקום", emoji: "📅", color: "#FFB899" },
    complaint:   { label: "תלונה", emoji: "😤", color: "#FFA8B5" },
    event:       { label: "אירוע פרטי", emoji: "🎉", color: "#C9B6FF" },
    feedback:    { label: "משוב", emoji: "💖", color: "#B8F0E0" },
    question:    { label: "שאלה", emoji: "❓", color: "#BFE3FF" },
    lost_found:  { label: "אבדות ומציאות", emoji: "🔎", color: "#FFF4B8" },
    job:         { label: "עבודה", emoji: "🧑‍🍳", color: "#E6D3C4" },
  };
  const STATUSES = {
    new:         { label: "חדש", emoji: "🔵", order: 0 },
    in_progress: { label: "בטיפול", emoji: "🟡", order: 1 },
    resolved:    { label: "טופל", emoji: "🟢", order: 2 },
    closed:      { label: "סגור", emoji: "⚪", order: 3 },
  };
  const PRIORITIES = {
    high:   { label: "גבוהה", order: 0 },
    medium: { label: "בינונית", order: 1 },
    low:    { label: "נמוכה", order: 2 },
  };
  const CHANNELS = {
    whatsapp:  { label: "וואטסאפ", emoji: "💬" },
    instagram: { label: "אינסטגרם", emoji: "📸" },
    phone:     { label: "טלפון", emoji: "📞" },
    website:   { label: "אתר", emoji: "🌐" },
    walk_in:   { label: "הגעה פיזית", emoji: "🚶" },
  };
  const ME = "מאיה";
  const STORE_KEY = "neon-peach-overrides-v1";

  // ---------- Storage (overrides on top of mock data) ----------
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
    },
    save(o) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch { /* storage unavailable: keep in memory */ }
    },
    clear() {
      try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    },
  };
  let overrides = store.load();
  let tickets = [];

  function buildState() {
    tickets = window.npBuildTickets().map((t) => {
      const o = overrides[t.id];
      if (!o) return t;
      return { ...t, ...o.fields, notes: [...t.notes, ...(o.notes || [])] };
    });
  }
  function patch(id, fields) {
    const o = (overrides[id] ||= { fields: {}, notes: [] });
    Object.assign(o.fields, fields);
    store.save(overrides);
    Object.assign(byId(id), fields);
  }
  function addNote(id, text) {
    const note = { by: ME, at: new Date().toISOString(), text };
    const o = (overrides[id] ||= { fields: {}, notes: [] });
    o.notes.push(note);
    store.save(overrides);
    byId(id).notes.push(note);
  }
  const byId = (id) => tickets.find((t) => t.id === id);

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = () => ymd(new Date());
  const isOpen = (t) => t.status === "new" || t.status === "in_progress";

  function relTime(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "עכשיו";
    if (mins < 60) return `לפני ${mins} דק'`;
    const h = Math.round(mins / 60);
    if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שע'`;
    const d = Math.round(h / 24);
    return d === 1 ? "אתמול" : `לפני ${d} ימים`;
  }
  const fmtDateTime = (iso) => new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const fmtMinutes = (m) => (m < 60 ? `${Math.round(m)} דק'` : `${(m / 60).toFixed(1)} שע'`);
  const waLink = (phone) => `https://wa.me/972${phone.replace(/\D/g, "").replace(/^0/, "")}`;

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function ticketCard(t) {
    const c = CATEGORIES[t.category], s = STATUSES[t.status], p = PRIORITIES[t.priority];
    return `<button class="ticket" data-id="${t.id}">
      <span class="ticket-emoji" style="background:${c.color}" aria-hidden="true">${c.emoji}</span>
      <span class="ticket-main">
        <div class="ticket-subject">${esc(t.subject)}</div>
        <div class="ticket-meta">${esc(t.customer.name)} · ${CHANNELS[t.channel].emoji} ${relTime(t.createdAt)} · ${t.id}</div>
      </span>
      <span class="ticket-side">
        <span class="pill st-${t.status}">${s.label}</span>
        <span class="pr pr-${t.priority}">${p.label}</span>
      </span>
    </button>`;
  }

  // ---------- Dashboard ----------
  function renderKpis() {
    const open = tickets.filter(isOpen).length;
    const today = todayStr();
    const newToday = tickets.filter((t) => ymd(new Date(t.createdAt)) === today).length;
    const responses = tickets.filter((t) => t.notes.length)
      .map((t) => (new Date(t.notes[0].at) - new Date(t.createdAt)) / 60000);
    const avgResp = responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : 0;
    const rated = tickets.filter((t) => t.rating);
    const csat = rated.length ? rated.reduce((a, t) => a + t.rating, 0) / rated.length : 0;
    const tonight = tickets.filter((t) => t.reservation && t.reservation.date === today);
    const guests = tonight.reduce((a, t) => a + t.reservation.guests, 0);

    const kpis = [
      { label: "📥 פניות פתוחות", value: open, hint: `${tickets.filter((t) => t.status === "new").length} חדשות`, bg: "var(--blue)" },
      { label: "🆕 חדשות היום", value: newToday, hint: "מאז חצות", bg: "var(--peach)" },
      { label: "⏱️ זמן תגובה ממוצע", value: fmtMinutes(avgResp), hint: "עד הטיפול הראשון", bg: "var(--butter)" },
      { label: "😊 שביעות רצון", value: `${csat.toFixed(1)}/5`, hint: `${rated.length} דירוגים`, bg: "var(--mint)" },
      { label: "📅 הזמנות להערב", value: tonight.length, hint: `${guests} סועדים צפויים`, bg: "var(--lavender)" },
    ];
    $("#kpis").innerHTML = kpis.map((k) => `<div class="kpi" style="background:${k.bg}">
      <div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-hint">${k.hint}</div></div>`).join("");
    $("#bellCount").textContent = tickets.filter((t) => t.status === "new").length;
  }

  const charts = {};
  function renderCharts() {
    if (!window.Chart) return;
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue("--text").trim();
    const grid = css.getPropertyValue("--border").trim();
    Chart.defaults.font.family = "Rubik, system-ui, sans-serif";
    Chart.defaults.color = text;

    // by day (14 days)
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const dayCounts = days.map((d) => tickets.filter((t) => ymd(new Date(t.createdAt)) === ymd(d)).length);
    const cats = Object.keys(CATEGORIES);
    const chans = Object.keys(CHANNELS);

    const configs = {
      chartDays: {
        type: "bar",
        data: { labels: days.map((d) => d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })),
          datasets: [{ label: "פניות", data: dayCounts, backgroundColor: "#FFB899", borderRadius: 4, maxBarThickness: 24 }] },
        options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } } } },
      },
      chartCats: {
        type: "doughnut",
        data: { labels: cats.map((c) => CATEGORIES[c].label),
          datasets: [{ data: cats.map((c) => tickets.filter((t) => t.category === c).length),
            backgroundColor: cats.map((c) => CATEGORIES[c].color), borderColor: css.getPropertyValue("--surface").trim(), borderWidth: 2 }] },
        options: { cutout: "62%", plugins: { legend: { display: true, position: "bottom", rtl: true, labels: { boxWidth: 10, boxHeight: 10, padding: 8, font: { size: 11 } } } } },
      },
      chartChannels: {
        type: "bar",
        data: { labels: chans.map((c) => `${CHANNELS[c].emoji} ${CHANNELS[c].label}`),
          datasets: [{ label: "פניות", data: chans.map((c) => tickets.filter((t) => t.channel === c).length), backgroundColor: "#C9B6FF", borderRadius: 4, maxBarThickness: 22 }] },
        options: { indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, y: { grid: { display: false } } } },
      },
    };
    for (const [id, cfg] of Object.entries(configs)) {
      cfg.options = { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, ...cfg.options,
        plugins: { legend: { display: false }, tooltip: { rtl: true }, ...(cfg.options.plugins || {}) } };
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(document.getElementById(id), cfg);
    }
  }

  function renderUrgent() {
    const urgent = tickets.filter((t) => isOpen(t) && t.priority === "high")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 5);
    $("#urgentList").innerHTML = urgent.length ? urgent.map(ticketCard).join("") : `<div class="empty">אין פניות דחופות 🎉</div>`;
  }

  // ---------- Tickets list ----------
  const filters = { category: null, status: null, priority: null, channel: null };
  const FILTER_GROUPS = [
    ["status", "סטטוס", STATUSES],
    ["category", "סוג", CATEGORIES],
    ["priority", "עדיפות", PRIORITIES],
    ["channel", "ערוץ", CHANNELS],
  ];
  function renderFilters() {
    $("#filters").innerHTML = FILTER_GROUPS.map(([key, title, dict]) => `<div class="chip-row" role="group" aria-label="${title}">
      <button class="chip" data-f="${key}" data-v="" aria-pressed="${!filters[key]}">כל ה${title === "סוג" ? "סוגים" : title === "ערוץ" ? "ערוצים" : title === "עדיפות" ? "עדיפויות" : "סטטוסים"}</button>
      ${Object.entries(dict).map(([v, d]) => `<button class="chip" data-f="${key}" data-v="${v}" aria-pressed="${filters[key] === v}">${d.emoji ? d.emoji + " " : ""}${d.label}</button>`).join("")}
    </div>`).join("");
  }
  function renderTickets() {
    const q = $("#search").value.trim().toLowerCase();
    const sort = $("#sort").value;
    let list = tickets.filter((t) =>
      Object.entries(filters).every(([k, v]) => !v || t[k] === v) &&
      (!q || [t.id, t.subject, t.customer.name, t.customer.phone, t.message].some((f) => f.toLowerCase().includes(q))));
    const byNew = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "new") list.sort(byNew);
    if (sort === "priority") list.sort((a, b) => PRIORITIES[a.priority].order - PRIORITIES[b.priority].order || byNew(a, b));
    if (sort === "status") list.sort((a, b) => STATUSES[a.status].order - STATUSES[b.status].order || byNew(a, b));
    $("#ticketCount").textContent = `${list.length} מתוך ${tickets.length}`;
    $("#ticketList").innerHTML = list.length ? list.map(ticketCard).join("") : `<div class="empty">לא נמצאו פניות 🍑</div>`;
  }

  // ---------- Tonight ----------
  function renderTonight() {
    const today = todayStr();
    const list = tickets.filter((t) => t.reservation && t.reservation.date === today)
      .sort((a, b) => a.reservation.time.localeCompare(b.reservation.time));
    const guests = list.reduce((a, t) => a + t.reservation.guests, 0);
    $("#tonightSummary").textContent = `${list.length} הזמנות · ${guests} סועדים`;
    $("#tonightList").innerHTML = list.length ? list.map((t) => `<button class="ticket" data-id="${t.id}">
      <span class="ticket-emoji" style="background:var(--peach-soft)"><span class="res-time">${t.reservation.time}</span></span>
      <span class="ticket-main">
        <div class="ticket-subject">${esc(t.customer.name)} · ${t.reservation.guests} סועדים</div>
        <div class="ticket-meta">${esc(t.subject)}</div>
      </span>
      <span class="ticket-side"><span class="pill st-${t.status}">${STATUSES[t.status].label}</span></span>
    </button>`).join("") : `<div class="empty">אין הזמנות להערב</div>`;
  }

  // ---------- Drawer ----------
  let currentId = null;
  let lastFocus = null;
  function openDrawer(id) {
    currentId = id;
    lastFocus = document.activeElement;
    renderDrawer();
    $("#overlay").hidden = false;
    $("#drawer").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
    setTimeout(() => $(".d-close")?.focus(), 50);
  }
  function closeDrawer() {
    currentId = null;
    $("#overlay").hidden = true;
    $("#drawer").classList.remove("open");
    $("#drawer").setAttribute("aria-hidden", "true");
    lastFocus?.focus?.();
  }
  function renderDrawer() {
    const t = byId(currentId);
    if (!t) return;
    const c = CATEGORIES[t.category];
    const opts = (dict, sel) => Object.entries(dict).map(([v, d]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${d.label}</option>`).join("");
    $("#drawerBody").innerHTML = `
      <div class="d-head">
        <span class="ticket-emoji" style="background:${c.color}">${c.emoji}</span>
        <div><h3 id="dTitle">${esc(t.subject)}</h3>
          <div class="ticket-meta">${t.id} · ${c.label} · ${CHANNELS[t.channel].emoji} ${CHANNELS[t.channel].label} · ${fmtDateTime(t.createdAt)}</div></div>
        <button class="d-close" aria-label="סגירה">✕</button>
      </div>

      <div class="d-section">
        <dl class="kv"><dt>לקוח/ה</dt><dd>${esc(t.customer.name)}</dd><dt>טלפון</dt><dd dir="ltr" style="text-align:right">${esc(t.customer.phone)}</dd>
        ${t.reservation ? `<dt>הזמנה</dt><dd>📅 ${t.reservation.date.split("-").reverse().join(".")} · 🕘 ${t.reservation.time} · 👥 ${t.reservation.guests}</dd>` : ""}
        ${t.rating ? `<dt>דירוג</dt><dd>${"⭐".repeat(t.rating)}</dd>` : ""}</dl>
        <div class="d-actions">
          <a class="btn grow" href="tel:${t.customer.phone.replace(/\D/g, "")}">📞 התקשר</a>
          <a class="btn secondary grow" href="${waLink(t.customer.phone)}" target="_blank" rel="noopener">💬 וואטסאפ</a>
        </div>
      </div>

      <div class="d-section"><h2>הודעת הלקוח</h2><div class="d-msg">${esc(t.message)}</div></div>

      <div class="d-section">
        <h2>סטטוס</h2>
        <div class="seg" role="group" aria-label="סטטוס">
          ${Object.entries(STATUSES).map(([v, s]) => `<button data-status="${v}" aria-pressed="${t.status === v}">${s.emoji} ${s.label}</button>`).join("")}
        </div>
        <div class="fields" style="margin-top:10px">
          <div class="field"><label for="dAssignee">שיוך לנציג</label>
            <select id="dAssignee"><option value="">— ללא —</option>${window.NP_AGENTS.map((a) => `<option ${a.name === t.assignee ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>
          <div class="field"><label for="dPriority">עדיפות</label><select id="dPriority">${opts(PRIORITIES, t.priority)}</select></div>
        </div>
      </div>

      <div class="d-section">
        <h2>תשובה מהירה</h2>
        <div class="quick">${window.NP_QUICK_REPLIES.map((r, i) => `<button class="chip" data-quick="${i}">${esc(r)}</button>`).join("")}</div>
      </div>

      <div class="d-section">
        <h2>הערות פנימיות</h2>
        <div class="field"><label for="dNote" class="sr">הערה חדשה</label><textarea id="dNote" placeholder="כתבו הערה לצוות…"></textarea></div>
        <div class="d-actions"><button class="btn grow" id="dAddNote">➕ הוספת הערה</button></div>
        <ul class="timeline" style="margin-top:12px">
          ${[...t.notes].reverse().map((n) => `<li><div>${esc(n.text)}</div><div class="when">${esc(n.by)} · ${fmtDateTime(n.at)}</div></li>`).join("") || `<li class="when">אין עדיין הערות</li>`}
        </ul>
      </div>`;
  }

  // ---------- Rendering orchestration ----------
  function renderAll() {
    renderKpis();
    renderUrgent();
    renderTickets();
    renderTonight();
    if (activeView === "dashboard") renderCharts();
    if (currentId) renderDrawer();
  }

  let activeView = "dashboard";
  function showView(v) {
    activeView = v;
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${v}`));
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === v));
    if (v === "dashboard") renderCharts();
    window.scrollTo({ top: 0 });
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav-item");
    if (nav) return showView(nav.dataset.view);

    const card = e.target.closest(".ticket");
    if (card) return openDrawer(card.dataset.id);

    const chip = e.target.closest("[data-f]");
    if (chip) { filters[chip.dataset.f] = chip.dataset.v || null; renderFilters(); renderTickets(); return; }

    if (e.target.closest("#bellBtn")) {
      filters.status = "new"; renderFilters(); showView("tickets"); renderTickets(); return;
    }
    if (e.target.closest(".js-reset")) {
      if (!confirm("לאפס את כל השינויים בדמו?")) return;
      store.clear(); overrides = {}; buildState(); closeDrawer(); renderAll(); toast("הדמו אופס ↺"); return;
    }
    if (e.target.closest(".d-close") || e.target.id === "overlay") return closeDrawer();

    const st = e.target.closest("[data-status]");
    if (st && currentId) {
      const t = byId(currentId);
      if (t.status !== st.dataset.status) {
        const from = STATUSES[t.status].label, to = STATUSES[st.dataset.status].label;
        patch(currentId, { status: st.dataset.status });
        addNote(currentId, `סטטוס שונה: ${from} ← ${to}`);
        renderAll(); toast(`הסטטוס עודכן ל"${to}"`);
      }
      return;
    }
    const q = e.target.closest("[data-quick]");
    if (q && currentId) {
      const t = byId(currentId);
      addNote(currentId, `📤 נשלחה תשובה ללקוח: "${window.NP_QUICK_REPLIES[+q.dataset.quick]}"`);
      if (t.status === "new") patch(currentId, { status: "in_progress", assignee: t.assignee || ME });
      renderAll(); toast("התשובה תועדה (בדמו לא נשלחת הודעה אמיתית)"); return;
    }
    if (e.target.closest("#dAddNote") && currentId) {
      const text = $("#dNote").value.trim();
      if (!text) return toast("כתבו הערה קודם ✍️");
      addNote(currentId, text); renderAll(); toast("ההערה נוספה"); return;
    }
  });

  document.addEventListener("change", (e) => {
    if (!currentId) return;
    if (e.target.id === "dAssignee") { patch(currentId, { assignee: e.target.value || null }); renderAll(); toast("השיוך עודכן"); }
    if (e.target.id === "dPriority") { patch(currentId, { priority: e.target.value }); renderAll(); toast("העדיפות עודכנה"); }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && currentId) closeDrawer(); });
  $("#search").addEventListener("input", renderTickets);
  $("#sort").addEventListener("change", renderTickets);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => activeView === "dashboard" && renderCharts());

  // ---------- Init ----------
  $("#todayLabel").textContent = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  buildState();
  renderFilters();
  renderAll();
})();

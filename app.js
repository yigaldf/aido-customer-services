/* Neon Peach — customer service dashboard logic (vanilla JS, no build). */
(function () {
  "use strict";

  // ---------- Dictionaries (shared with airtable.js, defined in data.js) ----------
  const { categories: CATEGORIES, statuses: STATUSES, priorities: PRIORITIES, channels: CHANNELS } = window.NP_DICT;
  const ME = "מאיה";
  const TOKEN_KEY = "neon-peach-airtable-token";
  const BASE_KEY = "neon-peach-airtable-base";
  const AT = window.NPAirtable;

  // ---------- Settings (token lives only in this browser) ----------
  const settings = {
    get token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
    get baseId() { try { return localStorage.getItem(BASE_KEY) || window.NP_CONFIG.baseId; } catch { return window.NP_CONFIG.baseId; } },
    save(token, baseId) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(BASE_KEY, baseId);
      } catch { /* storage blocked: settings will last for this visit only */ }
      memory = { token, baseId };
    },
    clear() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(BASE_KEY); } catch { /* ignore */ } memory = null; },
  };
  let memory = null;
  const creds = () => memory || { token: settings.token, baseId: settings.baseId };
  const client = () => AT.createClient(creds());
  const connected = () => Boolean(creds().token);

  // ---------- State ----------
  let tickets = [];
  let agents = window.NP_AGENTS;
  let loading = false;
  const byId = (id) => tickets.find((t) => t.id === id);

  async function load() {
    if (!connected()) { tickets = []; renderAll(); showView("settings"); setStatus("not-connected"); return; }
    loading = true; setStatus("loading");
    try {
      const data = await AT.loadAll(client(), window.NP_DICT);
      tickets = data.tickets;
      if (data.agents.length) agents = data.agents;
      setStatus("ok");
    } catch (e) {
      setStatus("error", e);
    } finally {
      loading = false;
      renderAll();
    }
  }

  // Optimistic update: change the screen now, save in the background, roll back on failure.
  async function patch(id, fields) {
    const t = byId(id);
    const before = Object.fromEntries(Object.keys(fields).map((k) => [k, t[k]]));
    Object.assign(t, fields);
    renderAll();
    try {
      await AT.updateTicket(client(), t._rid, fields, window.NP_DICT);
      return true;
    } catch (e) {
      Object.assign(t, before);
      renderAll();
      toast("⚠️ השמירה ב-Airtable נכשלה, השינוי בוטל");
      console.error(e);
      return false;
    }
  }
  async function addNote(id, text) {
    const t = byId(id);
    const note = { by: ME, at: new Date().toISOString(), text };
    t.notes.push(note);
    renderAll();
    try {
      note._rid = await AT.addNote(client(), t._rid, note);
      return true;
    } catch (e) {
      t.notes.splice(t.notes.indexOf(note), 1);
      renderAll();
      toast("⚠️ שמירת ההערה ב-Airtable נכשלה");
      console.error(e);
      return false;
    }
  }
  async function createTicket(tk) {
    tk.notes = [];
    tk._rid = await AT.createTicket(client(), tk, window.NP_DICT);
    tickets.push(tk);
    renderAll();
  }
  function nextTicketId() {
    const max = tickets.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, ""), 10) || 0), 1000);
    return `BB-${max + 1}`;
  }

  // ---------- Connection status banner ----------
  function setStatus(state, err) {
    const el = $("#connStatus");
    const map = {
      loading: ["⏳ טוען נתונים מ-Airtable…", "info"],
      ok: ["", ""],
      "not-connected": ["🔌 המערכת עוד לא מחוברת ל-Airtable. הזינו מפתח גישה במסך ההגדרות.", "warn"],
      error: [`⚠️ לא הצלחנו לטעון נתונים מ-Airtable${err?.status === 401 || err?.status === 403 ? " — בדקו את מפתח הגישה בהגדרות" : ""}. ${err ? esc(err.message) : ""}`, "error"],
    };
    const [text, kind] = map[state];
    el.textContent = text;
    el.className = `conn ${kind}`;
    el.hidden = !text;
  }

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
            <select id="dAssignee"><option value="">— ללא —</option>${agents.map((a) => `<option ${a.name === t.assignee ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>
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

  // ---------- New ticket form ----------
  function openNewTicket() {
    if (!connected()) { toast("קודם צריך להתחבר ל-Airtable ⚙️"); return showView("settings"); }
    currentId = null;
    lastFocus = document.activeElement;
    const opts = (dict) => Object.entries(dict).map(([v, d]) => `<option value="${v}">${d.emoji ? d.emoji + " " : ""}${d.label}</option>`).join("");
    $("#drawerBody").innerHTML = `
      <div class="d-head">
        <span class="ticket-emoji" style="background:var(--peach)">➕</span>
        <div><h3 id="dTitle">פנייה חדשה</h3><div class="ticket-meta">תישמר ישירות ב-Airtable</div></div>
        <button class="d-close" aria-label="סגירה">✕</button>
      </div>
      <form id="newTicketForm" class="d-section form">
        <div class="fields">
          <div class="field"><label for="nName">שם הלקוח/ה *</label><input id="nName" required autocomplete="off"></div>
          <div class="field"><label for="nPhone">טלפון *</label><input id="nPhone" type="tel" required dir="ltr" placeholder="050-0000000"></div>
          <div class="field"><label for="nCategory">סוג פנייה</label><select id="nCategory">${opts(CATEGORIES)}</select></div>
          <div class="field"><label for="nChannel">ערוץ</label><select id="nChannel">${opts(CHANNELS)}</select></div>
          <div class="field"><label for="nPriority">עדיפות</label><select id="nPriority">${opts(PRIORITIES)}</select></div>
          <div class="field"><label for="nAssignee">שיוך לנציג</label><select id="nAssignee"><option value="">— ללא —</option>${agents.map((a) => `<option>${esc(a.name)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label for="nSubject">נושא *</label><input id="nSubject" required autocomplete="off"></div>
        <div class="field"><label for="nMessage">הודעת הלקוח *</label><textarea id="nMessage" required></textarea></div>
        <fieldset class="fields res-fields" id="nRes">
          <legend>פרטי הזמנה</legend>
          <div class="field"><label for="nDate">תאריך</label><input id="nDate" type="date"></div>
          <div class="field"><label for="nTime">שעה</label><input id="nTime" type="time" value="21:00"></div>
          <div class="field"><label for="nGuests">סועדים</label><input id="nGuests" type="number" min="1" max="200" value="2" inputmode="numeric"></div>
        </fieldset>
        <div class="d-actions"><button class="btn grow" type="submit" id="nSubmit">💾 שמירת פנייה</button></div>
      </form>`;
    $("#nPriority").value = "medium";
    $("#nDate").value = todayStr();
    syncResFields();
    $("#overlay").hidden = false;
    $("#drawer").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
    setTimeout(() => $("#nName")?.focus(), 50);
  }
  function syncResFields() {
    const res = $("#nRes");
    if (res) res.hidden = $("#nCategory").value !== "reservation";
  }
  async function submitNewTicket(e) {
    e.preventDefault();
    const val = (id) => $(id).value.trim();
    const tk = {
      id: nextTicketId(),
      createdAt: new Date().toISOString(),
      customer: { name: val("#nName"), phone: val("#nPhone") },
      channel: $("#nChannel").value,
      category: $("#nCategory").value,
      subject: val("#nSubject"),
      message: val("#nMessage"),
      priority: $("#nPriority").value,
      status: "new",
      assignee: $("#nAssignee").value || null,
      rating: null,
    };
    if (tk.category === "reservation") {
      tk.reservation = { date: $("#nDate").value, time: $("#nTime").value, guests: parseInt($("#nGuests").value, 10) || 1 };
    }
    const btn = $("#nSubmit");
    btn.disabled = true; btn.textContent = "⏳ שומר ב-Airtable…";
    try {
      await createTicket(tk);
      closeDrawer();
      toast(`הפנייה ${tk.id} נשמרה ב-Airtable 🎉`);
    } catch (err) {
      console.error(err);
      btn.disabled = false; btn.textContent = "💾 שמירת פנייה";
      toast("⚠️ שמירת הפנייה ב-Airtable נכשלה");
    }
  }

  // ---------- Settings ----------
  function renderSettings() {
    const c = creds();
    $("#setBase").value = c.baseId;
    $("#setToken").value = "";
    $("#setToken").placeholder = c.token ? "•••••• מפתח שמור בדפדפן הזה (השאירו ריק כדי לא לשנות)" : "pat…";
    $("#setState").innerHTML = c.token
      ? `<span class="pill st-resolved">🟢 מחובר</span> base: <code>${esc(c.baseId)}</code>`
      : `<span class="pill st-closed">⚪ לא מחובר</span>`;
    $("#setDisconnect").hidden = !c.token;
    $("#setSeed").disabled = !c.token;
  }
  async function saveSettings(e) {
    e.preventDefault();
    const token = $("#setToken").value.trim() || creds().token;
    const baseId = $("#setBase").value.trim();
    if (!token) return toast("הזינו מפתח גישה");
    if (!/^app[A-Za-z0-9]{14}$/.test(baseId)) return toast("מזהה base צריך להתחיל ב-app ולהכיל 17 תווים");
    const btn = $("#setSave");
    btn.disabled = true; btn.textContent = "⏳ בודק חיבור…";
    try {
      await AT.createClient({ baseId, token }).ping();
      settings.save(token, baseId);
      toast("החיבור ל-Airtable הצליח ✅");
      renderSettings();
      await load();
      showView("dashboard");
    } catch (err) {
      toast(err.status === 401 || err.status === 403 ? "⚠️ המפתח לא תקין או שאין לו גישה ל-base הזה" : err.status === 404 ? "⚠️ לא נמצאה טבלת Tickets ב-base הזה" : "⚠️ החיבור נכשל");
      console.error(err);
    } finally {
      btn.disabled = false; btn.textContent = "🔌 שמירה ובדיקת חיבור";
    }
  }
  async function reseed() {
    if (!connected()) return toast("קודם צריך להתחבר ל-Airtable ⚙️");
    if (!confirm("פעולה זו מוחקת את כל הנתונים ב-Airtable (לכל המשתמשים) וטוענת מחדש את 40 פניות הדמה. להמשיך?")) return;
    closeDrawer();
    const els = document.querySelectorAll(".js-reset");
    els.forEach((b) => (b.disabled = true));
    try {
      await AT.seedDemo(client(), { tickets: window.npBuildTickets(), agents: window.NP_AGENTS, dict: window.NP_DICT }, (m) => setStatusText(`⏳ ${m}`));
      await load();
      toast("נתוני הדמה נטענו מחדש ↺");
    } catch (err) {
      console.error(err);
      setStatus("error", err);
    } finally {
      els.forEach((b) => (b.disabled = false));
    }
  }
  function setStatusText(text) {
    const el = $("#connStatus");
    el.textContent = text; el.className = "conn info"; el.hidden = false;
  }

  // ---------- Rendering orchestration ----------
  function renderAll() {
    renderKpis();
    renderUrgent();
    renderTickets();
    renderTonight();
    renderSettings();
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
  document.addEventListener("click", async (e) => {
    const nav = e.target.closest(".nav-item");
    if (nav) return showView(nav.dataset.view);

    const card = e.target.closest(".ticket");
    if (card) return openDrawer(card.dataset.id);

    const chip = e.target.closest("[data-f]");
    if (chip) { filters[chip.dataset.f] = chip.dataset.v || null; renderFilters(); renderTickets(); return; }

    if (e.target.closest("#bellBtn")) {
      filters.status = "new"; renderFilters(); showView("tickets"); renderTickets(); return;
    }
    if (e.target.closest(".js-new")) return openNewTicket();
    if (e.target.closest("#refreshBtn")) { if (!loading) { await load(); toast("הנתונים עודכנו מ-Airtable 🔄"); } return; }
    if (e.target.closest(".js-reset")) return reseed();
    if (e.target.closest("#setDisconnect")) {
      if (!confirm("לנתק את הדפדפן הזה מ-Airtable? (הנתונים ב-Airtable לא יימחקו)")) return;
      settings.clear(); await load(); toast("נותק מ-Airtable"); return;
    }
    if (e.target.closest(".d-close") || e.target.id === "overlay") return closeDrawer();

    const st = e.target.closest("[data-status]");
    if (st && currentId) {
      const id = currentId, t = byId(id);
      if (t.status !== st.dataset.status) {
        const from = STATUSES[t.status].label, to = STATUSES[st.dataset.status].label;
        if (await patch(id, { status: st.dataset.status })) {
          toast(`הסטטוס עודכן ל"${to}"`);
          await addNote(id, `סטטוס שונה: ${from} ← ${to}`);
        }
      }
      return;
    }
    const q = e.target.closest("[data-quick]");
    if (q && currentId) {
      const id = currentId, t = byId(id);
      if (await addNote(id, `📤 נשלחה תשובה ללקוח: "${window.NP_QUICK_REPLIES[+q.dataset.quick]}"`)) {
        toast("התשובה תועדה (בדמו לא נשלחת הודעה אמיתית)");
        if (t.status === "new") await patch(id, { status: "in_progress", assignee: t.assignee || ME });
      }
      return;
    }
    if (e.target.closest("#dAddNote") && currentId) {
      const text = $("#dNote").value.trim();
      if (!text) return toast("כתבו הערה קודם ✍️");
      if (await addNote(currentId, text)) toast("ההערה נשמרה");
      return;
    }
  });

  document.addEventListener("change", async (e) => {
    if (e.target.id === "nCategory") return syncResFields();
    if (!currentId) return;
    if (e.target.id === "dAssignee" && await patch(currentId, { assignee: e.target.value || null })) toast("השיוך עודכן");
    if (e.target.id === "dPriority" && await patch(currentId, { priority: e.target.value })) toast("העדיפות עודכנה");
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id === "newTicketForm") return submitNewTicket(e);
    if (e.target.id === "settingsForm") return saveSettings(e);
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#drawer").classList.contains("open")) closeDrawer(); });
  $("#search").addEventListener("input", renderTickets);
  $("#sort").addEventListener("change", renderTickets);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => activeView === "dashboard" && renderCharts());

  // ---------- Init ----------
  $("#todayLabel").textContent = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  renderFilters();
  renderAll();
  load();
})();

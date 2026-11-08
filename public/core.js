/* Shared code for the organizer pages (home, today, college, tasks).
   Loads before each page's own script and exposes everything on window.O */
(() => {
  // ================= icons (injected once per page) =================
  const ICONS = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></symbol>
    <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-chev" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20.5V16h-4.5"/></g></symbol>
    <symbol id="i-user" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></g></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></g></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></g></symbol>
    <symbol id="i-warn" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/></g></symbol>
    <symbol id="i-cal" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></symbol>
    <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></symbol>
  </svg>`;

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const todayStr = () => dateStr(new Date());
  const parseDate = (ds) => new Date(ds + "T00:00");
  const addDays = (ds, n) => { const d = parseDate(ds); d.setDate(d.getDate() + n); return dateStr(d); };
  const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  const minToTime = (m) => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const round2 = (n) => Math.round(n * 100) / 100;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const weekStart = (ds) => addDays(ds, -parseDate(ds).getDay()); // weeks start on Sunday
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

  function fmtDur(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  }
  function relDay(ds) {
    const n = daysBetween(todayStr(), ds);
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n === -1) return "Yesterday";
    if (n > 1 && n < 7) return parseDate(ds).toLocaleDateString(undefined, { weekday: "long" });
    return parseDate(ds).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
  function countdown(ds) {
    const n = daysBetween(todayStr(), ds);
    return n < 0 ? `${-n}d ago` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
  }
  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Good night";
  }

  // ================= API =================
  let onUnauthorized = () => location.replace("/");
  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch("/api" + path, {
        method: opts.method || "GET",
        headers: opts.body ? { "Content-Type": "application/json" } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: "same-origin",
      });
    } catch {
      throw new Error("No connection. Check your internet and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "/login") { onUnauthorized(); throw new Error("Please log in again"); }
    if (!res.ok) throw new Error(data.error || "Server error");
    return data;
  }

  // ================= data =================
  const D = { classes: [], events: [], tasks: [], entries: [], active: null, settings: { rate: 40, currency: "₪", goal: 5000 }, college: {} };
  async function load(parts = ["classes", "events", "tasks", "entries", "active", "settings", "college"]) {
    const res = await Promise.all(parts.map((p) => api("/" + p)));
    parts.forEach((p, i) => { D[p] = p === "active" ? (res[i].start ? res[i] : null) : res[i]; });
    return D;
  }
  const money = (n) => `${D.settings.currency || "₪"}${round2(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const courses = () => [...new Set([...D.classes.map((c) => c.course), ...D.events.map((e) => e.course), ...D.tasks.map((t) => t.course)].filter(Boolean))].sort();
  const courseColor = (name) => (D.classes.find((c) => c.course === name) || {}).color;

  // ================= what each kind looks like =================
  const KIND = {
    class:    { icon: "🎓", label: "Class",       color: "#8b7bff" },
    shift:    { icon: "💼", label: "Work shift",  color: "#34d399" },
    work:     { icon: "💼", label: "Worked",      color: "#34d399" },
    live:     { icon: "⏱",  label: "On shift",    color: "#34d399" },
    event:    { icon: "📌", label: "Event",       color: "#f472b6" },
    study:    { icon: "📖", label: "Study",       color: "#fbbf24" },
    exam:     { icon: "📝", label: "Exam",        color: "#f87171" },
    personal: { icon: "🌿", label: "Personal",    color: "#a78bfa" },
  };
  const payLabel = (t) => (t === "in" ? "UNPAID" : "PAID");
  const payColor = (t) => (t === "in" ? "#60a5fa" : "#34d399");

  // ================= schedule engine =================
  // Everything happening on one date: weekly classes, events, planned shifts, logged work, live shift.
  function dayPlan(ds) {
    const items = [];
    const wd = parseDate(ds).getDay();
    const c = D.college || {};
    const inSemester = (!c.semesterStart || ds >= c.semesterStart) && (!c.semesterEnd || ds <= c.semesterEnd);
    if (inSemester) {
      D.classes.filter((x) => x.day === wd).forEach((x) => items.push({
        type: "class", kind: "class", ref: x, title: x.course, start: x.start, end: x.end, color: x.color,
        sub: [x.kind, x.room].filter(Boolean).join(" · "), cancelled: (x.skip || []).includes(ds),
      }));
    }
    const linked = new Set(D.events.map((e) => e.entryId).filter(Boolean));
    D.events.filter((e) => e.date === ds).forEach((e) => items.push({
      type: "event", kind: e.kind, ref: e, title: e.title, start: e.start, end: e.end,
      color: e.kind === "shift" ? payColor(e.payType) : e.kind === "study" ? courseColor(e.course) || KIND.study.color : KIND[e.kind].color,
      sub: e.kind === "shift" ? `${payLabel(e.payType)}${e.location ? " · " + e.location : ""}` : [e.course, e.location].filter(Boolean).join(" · "),
      logged: !!e.entryId,
    }));
    D.entries.filter((x) => x.date === ds && !linked.has(x.id)).forEach((x) => items.push({
      type: "work", kind: "work", ref: x, title: "Worked", start: x.start, end: x.end, color: payColor(x.type),
      sub: `${payLabel(x.type)} · ${round2(x.hours)} h · ${money(x.hours * x.rate)}`,
    }));
    if (D.active && ds === todayStr()) {
      const s = new Date(D.active.start);
      if (dateStr(s) === ds) items.push({ type: "live", kind: "live", title: "On shift now", start: timeStr(s), end: timeStr(new Date()), color: "#34d399", sub: payLabel(D.active.type) });
    }
    items.forEach((it) => { it.s = toMin(it.start); it.e = toMin(it.end); if (it.e <= it.s) it.e += 1440; it.clash = []; });
    items.sort((a, b) => a.s - b.s || a.e - b.e);

    // clashes: two real (not cancelled) things at the same time
    const real = items.filter((i) => !i.cancelled);
    for (let i = 0; i < real.length; i++)
      for (let j = i + 1; j < real.length; j++) {
        const a = real[i], b = real[j];
        if (a.e > b.s && b.e > a.s) { a.clash.push(b.title); b.clash.push(a.title); }
      }

    // busy time + free gaps (30 min or more) between things
    let busy = 0, end = -1;
    const gaps = [];
    real.forEach((it) => {
      if (end >= 0 && it.s - end >= 30) gaps.push({ s: end, e: it.s, before: it });
      busy += Math.max(0, it.e - Math.max(it.s, end));
      end = Math.max(end, it.e);
    });
    const tasks = D.tasks.filter((t) => t.due === ds);
    return { ds, items, real, gaps, busy, tasks, clashes: real.filter((i) => i.clash.length).length };
  }

  // ================= toast + confirm + sheets =================
  function toast(msg) {
    const t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function ask({ title, text = "", yes = "Delete", neutral = false }) {
    const d = $("confirmDlg");
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yes;
    $("confirmYes").classList.toggle("neutral", neutral);
    $("confirmIcon").classList.toggle("neutral", neutral);
    $("confirmIcon").innerHTML = neutral ? '<svg><use href="#i-check"/></svg>' : '<svg><use href="#i-trash"/></svg>';
    return new Promise((resolve) => {
      const done = (v) => { $("confirmYes").onclick = $("confirmNo").onclick = null; d.onclose = null; if (d.open) d.close(); resolve(v); };
      $("confirmYes").onclick = () => done(true);
      $("confirmNo").onclick = () => done(false);
      d.onclose = () => done(false);
      d.onclick = (e) => { if (e.target === d) done(false); };
      d.showModal();
      $("confirmNo").focus();
    });
  }

  function wireSheets(root = document) {
    root.querySelectorAll("dialog.sheet").forEach((d) => {
      if (d.dataset.wired) return;
      d.dataset.wired = "1";
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
      d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => d.close()));
    });
  }
  const openSheet = (id) => { const d = $(id); if (!d.open) d.showModal(); };

  // chip groups: <div data-pick="name"><button data-v="x" class="q">…</button></div>
  function pickGroup(el, onChange) {
    const btns = [...el.querySelectorAll("[data-v]")];
    const multi = el.hasAttribute("data-multi");
    const api = {
      get: () => (multi ? btns.filter((b) => b.classList.contains("on")).map((b) => b.dataset.v) : (btns.find((b) => b.classList.contains("on")) || {}).dataset?.v),
      set: (v) => btns.forEach((b) => b.classList.toggle("on", multi ? [].concat(v).map(String).includes(b.dataset.v) : b.dataset.v === String(v))),
    };
    btns.forEach((b) => (b.onclick = () => {
      if (multi) b.classList.toggle("on"); else api.set(b.dataset.v);
      onChange && onChange(api.get());
    }));
    return api;
  }

  // ================= shared form: event / planned shift / study / exam =================
  const EV_HTML = `
  <dialog class="sheet" id="evSheet">
    <div class="handle"></div>
    <div class="sheet-head"><h2 id="evHead">Add to schedule</h2><button class="icon-btn sm" data-close aria-label="Close"><svg><use href="#i-x"/></svg></button></div>
    <form id="evForm" autocomplete="off">
      <div class="kind-pick" id="evKinds">
        <button type="button" data-v="event">📌<span>Event</span></button>
        <button type="button" data-v="shift">💼<span>Shift</span></button>
        <button type="button" data-v="study">📖<span>Study</span></button>
        <button type="button" data-v="exam">📝<span>Exam</span></button>
        <button type="button" data-v="personal">🌿<span>Personal</span></button>
      </div>
      <label class="field"><span id="evTitleLabel">Title</span><input type="text" id="evTitle" maxlength="100" /></label>
      <div id="evShiftBox" class="stack">
        <div class="type-toggle">
          <label class="type-opt"><input type="radio" name="evPay" value="out" checked /><span><b>PAID</b><small>paid at end of day</small></span></label>
          <label class="type-opt"><input type="radio" name="evPay" value="in" /><span><b>UNPAID</b><small>paid next month</small></span></label>
        </div>
        <label class="field"><span>Hourly rate</span><input type="number" id="evRate" min="0" step="0.01" inputmode="decimal" /></label>
      </div>
      <label class="field" id="evCourseBox"><span>Course</span><input type="text" id="evCourse" list="courseList" maxlength="80" placeholder="e.g. Calculus 1" /></label>
      <div class="field">
        <span>Date</span>
        <div class="quick">
          <button type="button" class="q" data-evday="0">Today</button>
          <button type="button" class="q" data-evday="1">Tomorrow</button>
          <input type="date" id="evDate" required aria-label="Date" />
        </div>
      </div>
      <div class="two">
        <label class="field"><span>Start</span><input type="time" id="evStart" required /></label>
        <label class="field"><span>End</span><input type="time" id="evEnd" required /></label>
      </div>
      <div class="dur-chips quick" id="evDur">
        <button type="button" class="q" data-dur="60">1h</button>
        <button type="button" class="q" data-dur="90">1.5h</button>
        <button type="button" class="q" data-dur="120">2h</button>
        <button type="button" class="q" data-dur="240">4h</button>
        <button type="button" class="q" data-dur="480">8h</button>
      </div>
      <label class="field"><span>Location (optional)</span><input type="text" id="evLocation" maxlength="80" placeholder="e.g. Building 3, room 204" /></label>
      <label class="field"><span>Note (optional)</span><input type="text" id="evNote" maxlength="300" /></label>
      <div class="clash-box" id="evClash" hidden></div>
      <div class="logged-box" id="evLogged" hidden>✓ Logged in Work Hours</div>
      <div class="sheet-actions">
        <button type="button" class="btn danger" id="evDelete" hidden><svg><use href="#i-trash"/></svg></button>
        <button type="button" class="btn ghost" id="evLog" hidden>💼 Log hours</button>
        <button type="submit" class="btn primary big grow" id="evSave">Save</button>
      </div>
    </form>
  </dialog>`;

  const EV = { editing: null, onSaved: null, kind: "event" };
  let evKinds;
  const TITLE_HINT = { event: "e.g. Dentist, Meeting…", shift: "Work shift", study: "e.g. Study for exam", exam: "e.g. Calculus final", personal: "e.g. Gym, Family dinner" };

  function evSetKind(k) {
    EV.kind = k; evKinds.set(k);
    $("evShiftBox").hidden = k !== "shift";
    $("evCourseBox").hidden = !(k === "exam" || k === "study");
    $("evTitle").placeholder = TITLE_HINT[k];
    $("evTitleLabel").textContent = k === "shift" ? "Title (optional)" : "Title";
    evCheck();
  }
  function evCheck() {
    // live clash warning while filling the form
    const ds = $("evDate").value, s = $("evStart").value, e = $("evEnd").value;
    document.querySelectorAll("[data-evday]").forEach((b) => b.classList.toggle("on", ds === addDays(todayStr(), Number(b.dataset.evday))));
    const box = $("evClash");
    if (!ds || !s || !e || s === e) { box.hidden = true; return; }
    let a = toMin(s), b = toMin(e); if (b <= a) b += 1440;
    document.querySelectorAll("[data-dur]").forEach((x) => x.classList.toggle("on", b - a === Number(x.dataset.dur)));
    const hits = dayPlan(ds).real.filter((it) => !(EV.editing && it.ref && it.ref.id === EV.editing.id) && !(EV.editing?.entryId && it.ref?.id === EV.editing.entryId) && it.e > a && b > it.s);
    box.hidden = !hits.length;
    if (hits.length) box.innerHTML = `<svg><use href="#i-warn"/></svg><span><b>Clashes with</b> ${hits.map((h) => `${esc(h.title)} (${h.start}–${h.end})`).join(", ")}</span>`;
  }

  function initEventForm() {
    if ($("evSheet")) return;
    document.body.insertAdjacentHTML("beforeend", EV_HTML);
    wireSheets();
    evKinds = pickGroup($("evKinds"), (k) => evSetKind(k));
    ["evDate", "evStart", "evEnd"].forEach((id) => $(id).addEventListener("input", evCheck));
    document.querySelectorAll("[data-evday]").forEach((b) => (b.onclick = () => { $("evDate").value = addDays(todayStr(), Number(b.dataset.evday)); evCheck(); }));
    document.querySelectorAll("[data-dur]").forEach((b) => (b.onclick = () => {
      if (!$("evStart").value) $("evStart").value = minToTime(Math.ceil(nowMin() / 30) * 30);
      $("evEnd").value = minToTime(toMin($("evStart").value) + Number(b.dataset.dur)); evCheck();
    }));

    $("evForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        kind: EV.kind, title: $("evTitle").value.trim(), date: $("evDate").value, start: $("evStart").value, end: $("evEnd").value,
        location: $("evLocation").value.trim(), note: $("evNote").value.trim(), course: $("evCourse").value.trim(),
        payType: document.querySelector('input[name="evPay"]:checked').value, rate: Number($("evRate").value) || 0,
        entryId: EV.editing?.entryId || "",
      };
      if (!body.title && body.kind !== "shift") { toast("Give it a title ✏️"); $("evTitle").focus(); return; }
      if (!body.start || !body.end) { toast("Add a start and end time ⏰"); return; }
      $("evSave").disabled = true;
      try {
        let saved;
        if (EV.editing) {
          saved = await api(`/events/${EV.editing.id}`, { method: "PUT", body });
          D.events = D.events.map((x) => (x.id === saved.id ? saved : x));
          toast("Saved ✓");
        } else {
          saved = await api("/events", { method: "POST", body });
          D.events.push(saved);
          toast(`${KIND[saved.kind].icon} Added to ${relDay(saved.date).toLowerCase() === "today" ? "today" : relDay(saved.date)}`);
        }
        $("evSheet").close(); EV.onSaved && EV.onSaved(saved);
      } catch (err) { toast(err.message); }
      $("evSave").disabled = false;
    });

    $("evDelete").onclick = async () => {
      const x = EV.editing; if (!x) return;
      if (!(await ask({ title: `Delete “${x.title}”?`, text: `${relDay(x.date)} · ${x.start}–${x.end}${x.entryId ? ". The logged work hours stay saved." : ""}` }))) return;
      try {
        await api(`/events/${x.id}`, { method: "DELETE" });
        D.events = D.events.filter((e) => e.id !== x.id);
        $("evSheet").close(); toast("Deleted"); EV.onSaved && EV.onSaved(null);
      } catch (err) { toast(err.message); }
    };

    $("evLog").onclick = async () => {
      const x = EV.editing; if (!x) return;
      await logShift(x);
      $("evSheet").close(); EV.onSaved && EV.onSaved(x);
    };
  }

  // planned shift → real work day in Work Hours
  async function logShift(ev) {
    try {
      const entry = await api("/entries", { method: "POST", body: {
        type: ev.payType || "out", date: ev.date, start: ev.start, end: ev.end, breakMin: 0,
        rate: ev.rate || D.settings.rate || 0, bonus: 0, note: ev.title === "Work shift" ? ev.location : ev.title,
      } });
      D.entries.push(entry);
      const updated = await api(`/events/${ev.id}`, { method: "PUT", body: { ...ev, entryId: entry.id } });
      D.events = D.events.map((e) => (e.id === ev.id ? updated : e));
      Object.assign(ev, updated);
      toast(`💼 Logged ${round2(entry.hours)} h · +${money(entry.hours * entry.rate)}`);
      return entry;
    } catch (err) { toast(err.message); }
  }

  function openEventForm({ event = null, kind = "event", date = todayStr(), start = "", onSaved } = {}) {
    initEventForm();
    EV.editing = event; EV.onSaved = onSaved;
    $("evForm").reset();
    $("courseList") || document.body.insertAdjacentHTML("beforeend", '<datalist id="courseList"></datalist>');
    $("courseList").innerHTML = courses().map((c) => `<option value="${esc(c)}">`).join("");
    const e = event || {};
    $("evHead").textContent = event ? `Edit ${KIND[e.kind].label.toLowerCase()}` : "Add to schedule";
    $("evTitle").value = e.title && !(e.kind === "shift" && e.title === "Work shift") ? e.title : "";
    $("evDate").value = e.date || date;
    $("evStart").value = e.start || start;
    $("evEnd").value = e.end || (start ? minToTime(toMin(start) + 60) : "");
    $("evLocation").value = e.location || "";
    $("evNote").value = e.note || "";
    $("evCourse").value = e.course || "";
    $("evRate").value = e.rate ?? D.settings.rate ?? "";
    document.querySelector(`input[name="evPay"][value="${e.payType || "out"}"]`).checked = true;
    $("evDelete").hidden = !event;
    $("evLog").hidden = !(event && e.kind === "shift" && !e.entryId && e.date <= todayStr());
    $("evLogged").hidden = !(event && e.entryId);
    $("evKinds").hidden = !!event;
    $("evSave").textContent = event ? "Save changes" : "Add";
    evSetKind(e.kind || kind);
    openSheet("evSheet");
  }

  // ================= shared form: task =================
  const TK_HTML = `
  <dialog class="sheet" id="tkSheet">
    <div class="handle"></div>
    <div class="sheet-head"><h2 id="tkHead">New task</h2><button class="icon-btn sm" data-close aria-label="Close"><svg><use href="#i-x"/></svg></button></div>
    <form id="tkForm" autocomplete="off">
      <label class="field"><span>What do you need to do?</span><input type="text" id="tkTitle" maxlength="140" placeholder="e.g. Submit homework 3" /></label>
      <div class="field"><span>List</span>
        <div class="quick wrap" id="tkList">
          <button type="button" class="q" data-v="personal">🌿 Personal</button>
          <button type="button" class="q" data-v="college">🎓 College</button>
          <button type="button" class="q" data-v="work">💼 Work</button>
        </div>
      </div>
      <label class="field" id="tkCourseBox"><span>Course</span><input type="text" id="tkCourse" list="courseList" maxlength="80" placeholder="e.g. Calculus 1" /></label>
      <div class="field"><span>Due</span>
        <div class="quick wrap">
          <button type="button" class="q" data-tkday="none">No date</button>
          <button type="button" class="q" data-tkday="0">Today</button>
          <button type="button" class="q" data-tkday="1">Tomorrow</button>
          <button type="button" class="q" data-tkday="7">Next week</button>
        </div>
      </div>
      <div class="two">
        <label class="field"><span>Date</span><input type="date" id="tkDue" /></label>
        <label class="field"><span>Time (optional)</span><input type="time" id="tkTime" /></label>
      </div>
      <div class="field"><span>Priority</span>
        <div class="quick prio" id="tkPrio">
          <button type="button" class="q" data-v="low">Low</button>
          <button type="button" class="q" data-v="normal">Normal</button>
          <button type="button" class="q" data-v="high">🔥 High</button>
        </div>
      </div>
      <label class="field"><span>Note (optional)</span><input type="text" id="tkNote" maxlength="300" /></label>
      <div class="sheet-actions">
        <button type="button" class="btn danger" id="tkDelete" hidden><svg><use href="#i-trash"/></svg></button>
        <button type="submit" class="btn primary big grow" id="tkSave">Add task</button>
      </div>
    </form>
  </dialog>`;
  const TK = { editing: null, onSaved: null };
  let tkList, tkPrio;
  function tkSync() {
    const v = $("tkDue").value;
    $("tkCourseBox").hidden = tkList.get() !== "college";
    document.querySelectorAll("[data-tkday]").forEach((b) => b.classList.toggle("on",
      b.dataset.tkday === "none" ? !v : v === addDays(todayStr(), Number(b.dataset.tkday))));
  }
  function initTaskForm() {
    if ($("tkSheet")) return;
    document.body.insertAdjacentHTML("beforeend", TK_HTML);
    wireSheets();
    tkList = pickGroup($("tkList"), tkSync);
    tkPrio = pickGroup($("tkPrio"));
    $("tkDue").addEventListener("input", tkSync);
    document.querySelectorAll("[data-tkday]").forEach((b) => (b.onclick = () => {
      $("tkDue").value = b.dataset.tkday === "none" ? "" : addDays(todayStr(), Number(b.dataset.tkday));
      if (!$("tkDue").value) $("tkTime").value = "";
      tkSync();
    }));
    $("tkForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const x = TK.editing;
      const body = {
        title: $("tkTitle").value.trim(), list: tkList.get(), priority: tkPrio.get(),
        due: $("tkDue").value, dueTime: $("tkTime").value, course: tkList.get() === "college" ? $("tkCourse").value.trim() : "",
        note: $("tkNote").value.trim(), done: x ? x.done : false, doneAt: x ? x.doneAt : null,
      };
      if (!body.title) { toast("Write what you need to do ✏️"); $("tkTitle").focus(); return; }
      $("tkSave").disabled = true;
      try {
        let saved;
        if (x) { saved = await api(`/tasks/${x.id}`, { method: "PUT", body }); D.tasks = D.tasks.map((t) => (t.id === saved.id ? saved : t)); toast("Saved ✓"); }
        else { saved = await api("/tasks", { method: "POST", body }); D.tasks.push(saved); toast("✅ Task added"); }
        $("tkSheet").close(); TK.onSaved && TK.onSaved(saved);
      } catch (err) { toast(err.message); }
      $("tkSave").disabled = false;
    });
    $("tkDelete").onclick = async () => {
      const x = TK.editing; if (!x) return;
      if (!(await ask({ title: "Delete this task?", text: x.title }))) return;
      try {
        await api(`/tasks/${x.id}`, { method: "DELETE" });
        D.tasks = D.tasks.filter((t) => t.id !== x.id);
        $("tkSheet").close(); toast("Deleted"); TK.onSaved && TK.onSaved(null);
      } catch (err) { toast(err.message); }
    };
  }
  function openTaskForm({ task = null, list = "personal", due = "", course = "", onSaved } = {}) {
    initTaskForm();
    TK.editing = task; TK.onSaved = onSaved;
    $("tkForm").reset();
    $("courseList") || document.body.insertAdjacentHTML("beforeend", '<datalist id="courseList"></datalist>');
    $("courseList").innerHTML = courses().map((c) => `<option value="${esc(c)}">`).join("");
    const t = task || {};
    $("tkHead").textContent = task ? "Edit task" : "New task";
    $("tkTitle").value = t.title || "";
    tkList.set(t.list || list); tkPrio.set(t.priority || "normal");
    $("tkCourse").value = t.course || course;
    $("tkDue").value = task ? t.due || "" : due;
    $("tkTime").value = t.dueTime || "";
    $("tkNote").value = t.note || "";
    $("tkDelete").hidden = !task;
    $("tkSave").textContent = task ? "Save changes" : "Add task";
    tkSync();
    openSheet("tkSheet");
    if (!task) setTimeout(() => $("tkTitle").focus(), 80);
  }

  async function toggleTask(t) {
    const body = { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null };
    try {
      const saved = await api(`/tasks/${t.id}`, { method: "PUT", body });
      D.tasks = D.tasks.map((x) => (x.id === saved.id ? saved : x));
      if (saved.done) toast(["Nice! ✅", "Done ✓ keep going 💪", "One less thing 🙌", "Crushed it 🔥"][Math.floor(Math.random() * 4)]);
      return saved;
    } catch (err) { toast(err.message); }
  }

  function dueLabel(t) {
    if (!t.due) return "";
    const n = daysBetween(todayStr(), t.due);
    const time = t.dueTime ? ` ${t.dueTime}` : "";
    if (!t.done && n < 0) return `Overdue · ${relDay(t.due)}`;
    return relDay(t.due) + time;
  }

  // ================= page shell =================
  async function page({ needAuth = true } = {}) {
    document.body.insertAdjacentHTML("afterbegin", ICONS);
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="confirm" id="confirmDlg">
        <div class="confirm-icon" id="confirmIcon"><svg><use href="#i-trash"/></svg></div>
        <h2 id="confirmTitle">Are you sure?</h2>
        <p class="muted" id="confirmText"></p>
        <div class="confirm-actions"><button class="btn ghost" id="confirmNo">Cancel</button><button class="btn danger solid" id="confirmYes">Delete</button></div>
      </dialog>
      <div class="toast" id="toast"></div>`);
    wireSheets();
    if (!needAuth) return null;
    const me = await api("/me").catch(() => ({ loggedIn: false }));
    if (!me.loggedIn) { location.replace("/"); return new Promise(() => {}); }
    return me.username;
  }

  window.O = {
    $, pad, dateStr, timeStr, todayStr, parseDate, addDays, toMin, minToTime, nowMin, esc, round2, sleep, weekStart, daysBetween,
    fmtDur, relDay, countdown, greeting, api, D, load, money, courses, courseColor, KIND, payLabel, payColor, dayPlan,
    toast, ask, wireSheets, openSheet, pickGroup, openEventForm, openTaskForm, toggleTask, dueLabel, logShift, page,
    setUnauthorized: (fn) => (onUnauthorized = fn),
  };
})();

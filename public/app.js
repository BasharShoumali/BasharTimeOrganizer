(() => {
  const OLD_KEY = "workhours.entries.v1";   // data from the first browser-only version
  const SKIP_KEY = "workhours.importSkipped";
  const USER_KEY = "workhours.lastUser";
  const $ = (id) => document.getElementById(id);
  const label = (t) => (t === "out" ? "PAID" : "UNPAID");
  const RING = 2 * Math.PI * 52;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let entries = [];
  let username = "";
  let settings = { rate: 40, currency: "₪", goal: 5000, name: "" };
  let active = null;               // running shift { start, type }
  let viewMonth = firstOfMonth(new Date());
  let filter = "all";
  let editingId = null;
  let fromShift = false;
  let tick = null;

  // ================= API =================
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
    if (res.status === 401 && path !== "/login") { showLogin(); throw new Error("Please log in again"); }
    if (!res.ok) throw new Error(data.error || "Server error");
    return data;
  }

  // ================= splash (loading → welcome) =================
  function splash(state, title, sub) {
    const el = $("splash"), icon = $("splashIcon");
    el.classList.remove("gone");
    icon.className = "splash-icon" + (state === "ok" ? " ok" : state === "err" ? " err" : "");
    icon.innerHTML = state === "ok" ? '<svg><use href="#i-check"/></svg>'
      : state === "err" ? '<svg><use href="#i-x"/></svg>'
      : '<svg class="spin"><use href="#i-refresh"/></svg>';
    $("splashTitle").textContent = title;
    $("splashSub").textContent = sub;
  }
  const hideSplash = () => $("splash").classList.add("gone");

  function welcomeText() {
    const hr = new Date().getHours();
    const st = monthStats(monthKey(new Date()));
    const loggedToday = entries.some((e) => e.date === todayStr());
    return active ? "Your shift timer is running ⏱"
      : loggedToday ? "Today is already saved ✓ Nice work"
      : st.days.size ? `${st.days.size} day${st.days.size === 1 ? "" : "s"} logged this month · keep going 💪`
      : hr < 12 ? "Fresh start · let's log some hours" : "Ready when you are · log your shift";
  }

  // ================= login =================
  // logging in happens on the home page now
  function showLogin() {
    clearInterval(tick);
    location.replace("/");
  }

  async function loadAll() {
    const [s, e, a] = await Promise.all([api("/settings"), api("/entries"), api("/active")]);
    settings = s; entries = e; active = a.start ? a : null;
  }

  async function enterApp(isNewLogin) {
    $("login").hidden = true;
    splash("load", "Getting things ready…", "Loading your shifts");
    const t0 = Date.now();
    try {
      await loadAll();
    } catch (err) {
      if ($("login").hidden === false) return;   // session expired → login already shown
      splash("err", "Couldn't load your data", err.message);
      await sleep(2200);
      showLogin(); $("loginErr").textContent = err.message;
      return;
    }
    await sleep(Math.max(0, 350 - (Date.now() - t0)));        // let the spinner be seen
    render(); renderShift();
    $("app").hidden = false; $("bar").hidden = false;
    hideSplash();
    checkOldData();
    // links from the home page: work.html?add=1 / ?settings=1
    const q = new URLSearchParams(location.search);
    if (q.get("add")) { resetForm(); openSheet("addSheet"); }
    if (q.get("settings")) $("openSettings").click();
    if (q.toString()) history.replaceState(null, "", "work.html");
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginErr").textContent = "";
    $("loginBtn").disabled = true; $("loginBtn").textContent = "Checking…";
    try {
      const r = await api("/login", { method: "POST", body: { username: $("username").value.trim(), password: $("password").value } });
      username = r.username;
      try { localStorage.setItem(USER_KEY, $("username").value.trim()); } catch {}
      $("password").value = "";
      await enterApp(true);
    } catch (err) {
      $("loginErr").textContent = err.message;
      const f = $("loginForm"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    }
    $("loginBtn").disabled = false; $("loginBtn").textContent = "Log in";
  });
  $("togglePw").onclick = () => {
    const p = $("password"), show = p.type === "password";
    p.type = show ? "text" : "password";
    $("togglePw").classList.toggle("on", show);
    $("togglePw").setAttribute("aria-label", show ? "Hide password" : "Show password");
  };
  $("logoutBtn").onclick = async () => {
    const ok = await ask({ title: "Log out?", text: "You can log back in any time. Your shifts stay saved.", yes: "Log out", neutral: true });
    if (!ok) return;
    await api("/logout", { method: "POST" }).catch(() => {});
    try { sessionStorage.removeItem("welcomed"); } catch {}
    entries = []; active = null; username = ""; showLogin();
  };

  // refresh button: reload everything from the database
  $("refreshBtn").onclick = async () => {
    const b = $("refreshBtn");
    if (b.classList.contains("busy")) return;
    b.classList.add("busy");
    try {
      await Promise.all([loadAll(), sleep(500)]);
      render(); renderShift(); if ($("daysSheet").open) renderDays();
      toast("Up to date ✓");
    } catch (err) { toast(err.message); }
    b.classList.remove("busy");
  };

  // ================= confirm popup =================
  function ask({ title, text = "", yes = "Delete", neutral = false }) {
    const d = $("confirmDlg");
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yes;
    $("confirmYes").classList.toggle("neutral", neutral);
    $("confirmIcon").classList.toggle("neutral", neutral);
    $("confirmIcon").innerHTML = neutral ? '<svg><use href="#i-user"/></svg>' : '<svg><use href="#i-trash"/></svg>';
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

  // ================= old browser data =================
  function readOld() { try { return JSON.parse(localStorage.getItem(OLD_KEY)) || []; } catch { return []; } }
  function checkOldData() {
    let skipped = false;
    try { skipped = localStorage.getItem(SKIP_KEY) === "1"; } catch {}
    const old = readOld();
    if (old.length && !skipped) { $("importCount").textContent = old.length; $("importBanner").hidden = false; }
  }
  $("importSkip").onclick = () => { try { localStorage.setItem(SKIP_KEY, "1"); } catch {} $("importBanner").hidden = true; };
  $("importGo").onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("/import", { method: "POST", body: { entries: readOld() } });
      try { localStorage.removeItem(OLD_KEY); } catch {}
      $("importBanner").hidden = true;
      entries = await api("/entries"); render();
      toast(`Moved ${r.imported} days to the database`);
    } catch (err) { toast(err.message); }
    e.target.disabled = false;
  };

  // ================= helpers =================
  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const todayStr = () => dateStr(new Date());
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const round2 = (n) => Math.round(n * 100) / 100;
  const money = (n) => `${settings.currency}${round2(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const hrs = (n) => `${round2(n).toLocaleString()} h`;
  const pay = (e) => e.hours * e.rate;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function calcHours(start, end, breakMin) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 1440; // overnight shift
    mins -= Number(breakMin) || 0;
    return Math.max(0, mins / 60);
  }

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // smooth count-up animation for big numbers
  function countTo(el, value, fmt) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = value;
    if (from === value || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmt(value); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (value - from) * ease);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ================= sheets (popups) =================
  function openSheet(id) { const d = $(id); if (!d.open) d.showModal(); }
  document.querySelectorAll("dialog.sheet").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });     // tap outside
    d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => d.close()));
  });
  $("addSheet").addEventListener("close", () => { fromShift = false; });

  $("openAdd").onclick = () => { resetForm(); openSheet("addSheet"); };
  $("openDays").onclick = () => { renderDays(); openSheet("daysSheet"); };
  $("openSettings").onclick = () => {
    $("sUser").textContent = username; $("sAvatar").textContent = (username[0] || "?");
    $("sRate").value = settings.rate;
    $("sCurrency").value = settings.currency; $("sGoal").value = settings.goal;
    openSheet("settingsSheet");
  };

  // ================= add / edit form =================
  const form = $("entryForm");
  const getType = () => form.querySelector('input[name="type"]:checked').value;
  const setType = (t) => (form.querySelector(`input[name="type"][value="${t}"]`).checked = true);

  function lastType() {
    const last = [...entries].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
    return last ? last.type : "out";
  }

  const lastEntry = () => [...entries].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];

  function resetForm(date) {
    editingId = null; fromShift = false;
    form.reset();
    setType(lastType());
    $("date").value = date || todayStr();
    $("rate").value = settings.rate;
    $("breakMin").value = 0;
    $("formTitle").textContent = "Add a work day";
    $("saveBtn").textContent = "Save day";
    $("deleteEntry").hidden = true;
    const last = lastEntry();
    $("copyLast").hidden = !last;
    if (last) $("copyLastInfo").textContent = `· ${label(last.type)} ${last.start}–${last.end}`;
    updatePreview();
  }

  // "Same as last shift": fill everything except date, bonus and note
  $("copyLast").onclick = () => {
    const last = lastEntry(); if (!last) return;
    setType(last.type);
    $("start").value = last.start; $("end").value = last.end;
    $("breakMin").value = last.breakMin || 0; $("rate").value = last.rate;
    $("copyLast").hidden = true;
    updatePreview();
  };

  // quick date chips
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); };
  document.querySelectorAll("[data-day]").forEach((b) =>
    (b.onclick = () => { $("date").value = daysAgo(Number(b.dataset.day)); updatePreview(); })
  );
  // quick break chips
  document.querySelectorAll("[data-break]").forEach((b) =>
    (b.onclick = () => { $("breakMin").value = b.dataset.break; updatePreview(); })
  );

  function updatePreview() {
    const h = calcHours($("start").value, $("end").value, $("breakMin").value);
    const p = h * (Number($("rate").value) || 0);
    const bonus = Number($("bonus").value) || 0;
    $("pvHours").textContent = hrs(h);
    $("pvPay").textContent = money(p);
    $("pvWhen").textContent = getType() === "out" ? "paid today" : "paid next month";
    $("pvBonusBox").hidden = !bonus;
    $("pvBonus").textContent = money(bonus);
    // highlight the active chips
    document.querySelectorAll("[data-day]").forEach((b) => b.classList.toggle("on", $("date").value === daysAgo(Number(b.dataset.day))));
    document.querySelectorAll("[data-break]").forEach((b) => b.classList.toggle("on", Number($("breakMin").value || 0) === Number(b.dataset.break)));
  }
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
  document.querySelectorAll("[data-now]").forEach((b) =>
    b.addEventListener("click", () => { $(b.dataset.now).value = timeStr(new Date()); updatePreview(); })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      type: getType(), date: $("date").value, start: $("start").value, end: $("end").value,
      breakMin: Number($("breakMin").value) || 0, rate: Number($("rate").value) || 0,
      bonus: Number($("bonus").value) || 0, note: $("note").value.trim(),
    };
    if (!body.start || !body.end) { toast("Add a start and end time ⏰"); return; }
    if (calcHours(body.start, body.end, body.breakMin) <= 0) { toast("Check start / end times"); return; }

    $("saveBtn").disabled = true;
    try {
      let saved;
      if (editingId) {
        saved = await api(`/entries/${editingId}`, { method: "PUT", body });
        entries = entries.map((x) => (x.id === editingId ? saved : x));
        toast("Day updated ✓");
      } else {
        saved = await api("/entries", { method: "POST", body });
        entries.push(saved);
        if (fromShift) { await api("/active", { method: "DELETE" }).catch(() => {}); active = null; renderShift(); }
        const earned = pay(saved) + (saved.bonus || 0);
        toast(`+${money(earned)} ${saved.type === "out" ? "· paid today" : "· paid next month"} 🎉`);
        celebrate(saved.bonus ? 180 : 110);
      }
      viewMonth = firstOfMonth(new Date(saved.date + "T00:00"));
      $("addSheet").close();
      render(); if ($("daysSheet").open) renderDays();
    } catch (err) { toast(err.message); }
    $("saveBtn").disabled = false;
  });

  function startEdit(id) {
    const x = entries.find((e) => e.id === id); if (!x) return;
    editingId = id; fromShift = false;
    setType(x.type);
    $("date").value = x.date; $("start").value = x.start; $("end").value = x.end;
    $("breakMin").value = x.breakMin; $("rate").value = x.rate;
    $("bonus").value = x.bonus || ""; $("note").value = x.note || "";
    const d = new Date(x.date + "T00:00");
    $("formTitle").textContent = `Edit · ${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`;
    $("saveBtn").textContent = "Save changes";
    $("deleteEntry").hidden = false;
    $("copyLast").hidden = true;
    updatePreview();
    openSheet("addSheet");
  }

  $("deleteEntry").onclick = async () => {
    if (!editingId) return;
    const x = entries.find((e) => e.id === editingId);
    const ok = await ask({
      title: "Delete this day?",
      text: x ? `${new Date(x.date + "T00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · ${x.start}–${x.end} · ${money(pay(x))}` : "",
    });
    if (!ok) return;
    try {
      await api(`/entries/${editingId}`, { method: "DELETE" });
      entries = entries.filter((e) => e.id !== editingId);
      $("addSheet").close(); render(); if ($("daysSheet").open) renderDays();
      toast("Deleted");
    } catch (err) { toast(err.message); }
  };

  // ================= live shift timer =================
  $("startShift").onclick = async () => {
    try {
      active = await api("/active", { method: "PUT", body: { start: new Date().toISOString(), type: lastType() } });
      renderShift(); toast("Shift started · have a great one 💪");
    } catch (err) { toast(err.message); }
  };
  $("endShift").onclick = () => {
    if (!active) return;
    const s = new Date(active.start), now = new Date();
    resetForm(dateStr(s));
    fromShift = true;
    setType(active.type);
    $("start").value = timeStr(s);
    $("end").value = timeStr(now);
    $("formTitle").textContent = "Finish your shift";
    $("saveBtn").textContent = "Save shift";
    updatePreview();
    openSheet("addSheet");
  };
  $("discardShift").onclick = async () => {
    if (!(await ask({ title: "Discard this shift?", text: "The timer stops and nothing is saved.", yes: "Discard" }))) return;
    try { await api("/active", { method: "DELETE" }); active = null; renderShift(); } catch (err) { toast(err.message); }
  };

  function renderShift() {
    clearInterval(tick);
    $("shiftCard").classList.toggle("on", !!active);
    $("shiftIdle").hidden = !!active;
    $("shiftLive").hidden = !active;
    if (!active) return;
    const s = new Date(active.start);
    $("liveType").textContent = label(active.type);
    $("liveType").className = "live-type " + active.type;
    $("liveSince").textContent = `since ${timeStr(s)}`;
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - s) / 1000));
      $("liveTime").textContent = `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
      $("liveMoney").textContent = money((sec / 3600) * settings.rate);
    };
    update();
    tick = setInterval(update, 1000);
  }

  // ================= home render =================
  function monthStats(mk) {
    const list = entries.filter((e) => e.date.startsWith(mk));
    const st = { list, h: 0, outPay: 0, inPay: 0, bonus: 0, days: new Set() };
    list.forEach((e) => {
      st.h += e.hours; st.bonus += e.bonus || 0; st.days.add(e.date);
      if (e.type === "out") st.outPay += pay(e); else st.inPay += pay(e);
    });
    st.total = st.outPay + st.inPay + st.bonus;
    return st;
  }

  function render() {
    // header
    const now = new Date(), hr = now.getHours();
    const hi = hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Good night";
    $("greetLine").textContent = `${hi} · ${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}`;
    $("userName").textContent = "Work Hours";
    document.title = "Work Hours";

    const st = monthStats(monthKey(viewMonth));
    const allBonus = entries.reduce((s, e) => s + (e.bonus || 0), 0);

    $("monthName").textContent = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    countTo($("bonusTotal"), st.bonus, money);
    $("bonusAll").textContent = money(allBonus);
    countTo($("sumTotal"), st.total, money);
    $("sumHours").textContent = hrs(st.h);
    $("sumDays").textContent = `${st.days.size} day${st.days.size === 1 ? "" : "s"}`;
    $("sumOut").textContent = money(st.outPay);
    $("sumIn").textContent = money(st.inPay);

    // goal ring
    const goal = Number(settings.goal) || 0;
    const pct = goal ? st.total / goal : 0;
    $("ringFg").style.strokeDashoffset = RING * (1 - Math.min(1, pct));
    $("ringPct").textContent = goal ? `${Math.round(pct * 100)}%` : "—";
    $("goalMsg").textContent =
      !goal ? "Set a goal in Settings 🎯" :
      pct >= 1 ? "Goal smashed! 🏆" :
      pct >= 0.75 ? "Almost there 🔥" :
      pct >= 0.5 ? "Halfway there 🚀" :
      pct >= 0.25 ? "Great progress ⚡" :
      pct > 0 ? "Nice start 👏" : "Let's get started 💪";
    $("goalLeft").textContent = goal ? (pct >= 1 ? `${money(st.total - goal)} over your goal` : `${money(goal - st.total)} to go`) : "";

    renderWeek();
    renderLast();
  }

  function renderWeek() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sun = new Date(today); sun.setDate(today.getDate() - today.getDay()); // week starts Sunday
    const strip = $("weekStrip"); strip.innerHTML = "";
    let weekH = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun); d.setDate(sun.getDate() + i);
      const ds = dateStr(d);
      const dayEntries = entries.filter((e) => e.date === ds);
      const h = dayEntries.reduce((s, e) => s + e.hours, 0);
      weekH += h;
      const b = document.createElement("button");
      b.className = "wday" + (h ? " worked" : "") + (ds === todayStr() ? " today" : "") + (d > today ? " future" : "");
      b.innerHTML = `<span class="wl">${d.toLocaleDateString(undefined, { weekday: "narrow" })}</span><span class="wd">${d.getDate()}</span><span class="wh">${h ? round2(h) + "h" : ""}</span>`;
      b.onclick = () => {
        if (dayEntries.length === 1) startEdit(dayEntries[0].id);
        else if (dayEntries.length > 1) { viewMonth = firstOfMonth(d); render(); renderDays(); openSheet("daysSheet"); }
        else { resetForm(ds); openSheet("addSheet"); }
      };
      strip.appendChild(b);
    }
    $("weekHours").textContent = `${hrs(weekH)} this week`;
  }

  function renderLast() {
    const last = [...entries].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];
    $("lastCard").hidden = !last;
    if (!last) return;
    const d = new Date(last.date + "T00:00");
    $("lastRow").innerHTML = `
      <div><b>${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</b>
      <span class="muted small"> · ${last.start}–${last.end} · ${hrs(last.hours)}</span></div>
      <span class="badge ${last.type}">${label(last.type)} ${money(pay(last))}</span>`;
    $("lastCard").onclick = () => startEdit(last.id);
  }

  // ================= days sheet =================
  function renderDays() {
    const mk = monthKey(viewMonth);
    const st = monthStats(mk);
    $("dMonth").textContent = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    $("dSummary").innerHTML = `
      <div><b>${hrs(st.h)}</b><span>${st.days.size} day${st.days.size === 1 ? "" : "s"}</span></div>
      <div><b style="color:var(--out)">${money(st.outPay)}</b><span>PAID<small>paid today</small></span></div>
      <div><b style="color:var(--in)">${money(st.inPay)}</b><span>UNPAID<small>paid next month</small></span></div>`;

    const shown = st.list
      .filter((e) => filter === "all" || (filter === "bonus" ? e.bonus > 0 : e.type === filter))
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    const list = $("list"); list.innerHTML = "";
    $("empty").hidden = shown.length > 0;
    $("listHint").hidden = shown.length === 0;

    shown.forEach((e) => {
      const d = new Date(e.date + "T00:00");
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="date-box"><div class="d">${d.getDate()}</div><div class="w">${d.toLocaleDateString(undefined, { weekday: "short" })}</div></div>
        <div class="info">
          <div class="row1">
            <span class="badge ${e.type}">${label(e.type)}</span>
            <span class="time">${e.start}–${e.end}</span>
            ${e.bonus ? `<span class="badge bonus">🎁 ${money(e.bonus)}</span>` : ""}
          </div>
          <div class="meta">${hrs(e.hours)} × ${money(e.rate)}${e.breakMin ? ` · break ${e.breakMin}m` : ""}${e.note ? " · " + esc(e.note) : ""}</div>
        </div>
        <div class="amount">${money(pay(e))}<small>${e.type === "out" ? "paid today" : "paid next month"}</small></div>
        <svg class="chev"><use href="#i-chev"/></svg>`;
      li.onclick = () => startEdit(e.id);
      list.appendChild(li);
    });
  }

  const shiftMonth = (n) => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + n, 1); render(); if ($("daysSheet").open) renderDays(); };
  $("prevMonth").onclick = () => shiftMonth(-1);
  $("nextMonth").onclick = () => shiftMonth(1);
  $("dPrev").onclick = () => shiftMonth(-1);
  $("dNext").onclick = () => shiftMonth(1);
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active"); filter = c.dataset.filter; renderDays();
    })
  );

  // ================= settings =================
  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      settings = await api("/settings", { method: "PUT", body: {
        name: settings.name || "", rate: Number($("sRate").value) || 0,
        currency: $("sCurrency").value || "₪", goal: Number($("sGoal").value) || 0,
      } });
      $("settingsSheet").close(); render(); renderShift(); toast("Settings saved ✓");
    } catch (err) { toast(err.message); }
  });
  $("clearAll").onclick = async () => {
    if (!(await ask({ title: "Delete ALL data?", text: `This removes all ${entries.length} saved days from the database. It can't be undone, so make a Backup first.`, yes: "Delete all" }))) return;
    try {
      await api("/entries", { method: "DELETE" });
      entries = []; $("settingsSheet").close(); render(); toast("All data deleted");
    } catch (err) { toast(err.message); }
  };

  // ================= export / backup =================
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("exportCsv").onclick = () => {
    const mk = monthKey(viewMonth);
    const rows = [["Date", "Type", "Start", "End", "Break(min)", "Hours", "Rate", "Pay", "Bonus", "Paid", "Note"]];
    entries.filter((e) => e.date.startsWith(mk)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) =>
      rows.push([e.date, label(e.type), e.start, e.end, e.breakMin, e.hours.toFixed(2), e.rate, pay(e).toFixed(2), e.bonus, e.type === "out" ? "End of day" : "Next month", e.note])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`work-hours-${mk}.csv`, "﻿" + csv, "text/csv");
  };
  $("backupBtn").onclick = () => download(`work-hours-backup-${todayStr()}.json`, JSON.stringify({ entries, settings }, null, 2), "application/json");
  $("restoreFile").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.entries)) throw new Error("Invalid backup file");
      if (!(await ask({ title: "Restore this backup?", text: `Everything in the database is replaced with the ${data.entries.length} days in this file.`, yes: "Restore", neutral: true }))) return;
      const r = await api("/import", { method: "POST", body: { entries: data.entries, settings: data.settings, replace: true } });
      [settings, entries] = await Promise.all([api("/settings"), api("/entries")]);
      render(); renderDays(); toast(`Restored ${r.imported} days`);
    } catch (err) { toast(err.message || "Invalid backup file"); }
    finally { ev.target.value = ""; }
  };

  // ================= confetti =================
  function celebrate(n = 110) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = $("confetti"), ctx = c.getContext("2d"), dpr = devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ["#8b7bff", "#4fd1c5", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];
    const parts = Array.from({ length: n }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
      s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const alpha = Math.max(0, 1 - (t - t0) / 1800);
      parts.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (alpha > 0) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // refresh greeting/timer when coming back to the app
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || $("app").hidden) return;
    try {
      const [e, a] = await Promise.all([api("/entries"), api("/active")]);
      entries = e; active = a.start ? a : null; render(); renderShift();
    } catch {}
  });

  // ================= start =================
  api("/me")
    .then((r) => { if (r.loggedIn) { username = r.username || ""; enterApp(false); } else showLogin(); })
    .catch((err) => { splash("err", "Couldn't connect", err.message); });
})();

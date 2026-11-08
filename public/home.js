// Home screen: login → loading → welcome → pick what to organize
(async () => {
  const { $, D, api, load, esc, todayStr, addDays, relDay, countdown, fmtDur, nowMin, money, dayPlan, KIND, dueLabel, sleep } = O;
  const USER_KEY = "workhours.lastUser";
  let username = "";

  await O.page({ needAuth: false });
  O.setUnauthorized(() => showLogin());

  // ================= splash =================
  function splash(state, title, sub) {
    const icon = $("splashIcon");
    $("splash").classList.remove("gone");
    icon.className = "splash-icon" + (state === "ok" ? " ok" : state === "err" ? " err" : "");
    icon.innerHTML = state === "ok" ? '<svg><use href="#i-check"/></svg>' : state === "err" ? '<svg><use href="#i-x"/></svg>' : '<svg class="spin"><use href="#i-refresh"/></svg>';
    $("splashTitle").textContent = title;
    $("splashSub").textContent = sub;
  }
  const hideSplash = () => $("splash").classList.add("gone");

  // ================= login =================
  function showLogin() {
    hideSplash();
    $("app").hidden = true; $("bar").hidden = true; $("login").hidden = false;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    let last = ""; try { last = localStorage.getItem(USER_KEY) || ""; } catch {}
    if (last && !$("username").value) $("username").value = last;
    setTimeout(() => ($("username").value ? $("password") : $("username")).focus(), 60);
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
      await enter(true);
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
  };

  function welcomeText() {
    const plan = dayPlan(todayStr());
    const n = plan.real.length + plan.tasks.filter((t) => !t.done).length;
    if (D.active) return "Your shift timer is running ⏱";
    if (!n) return "Nothing planned today · a fresh page ✨";
    return `${n} thing${n === 1 ? "" : "s"} on your plate today · let's go 💪`;
  }

  async function enter(isNewLogin) {
    $("login").hidden = true;
    splash("load", "Getting things ready…", "Loading your day");
    const t0 = Date.now();
    try { await load(); }
    catch (err) {
      if (!$("login").hidden) return;
      splash("err", "Couldn't load your data", err.message);
      await sleep(2200); showLogin(); $("loginErr").textContent = err.message; return;
    }
    await sleep(Math.max(0, 650 - (Date.now() - t0)));
    let seen = false; try { seen = sessionStorage.getItem("welcomed") === "1"; } catch {}
    render();
    $("app").hidden = false; $("bar").hidden = false;
    if (isNewLogin || !seen) {
      splash("ok", `${isNewLogin ? "Welcome" : "Welcome back"}, ${username}!`, welcomeText());
      try { sessionStorage.setItem("welcomed", "1"); } catch {}
      await sleep(1300);
    }
    hideSplash();
  }

  // ================= render =================
  function render() {
    const now = new Date();
    $("greetLine").textContent = `${O.greeting()} · ${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}`;
    $("userName").textContent = username;
    $("avatar").textContent = username[0] || "?";
    document.title = `${username} · Organizer`;

    const today = todayStr();
    const plan = dayPlan(today);
    renderNow(plan);

    // option cards
    const open = plan.tasks.filter((t) => !t.done).length;
    const things = plan.real.length;
    $("optToday").textContent = things
      ? `${things} thing${things === 1 ? "" : "s"} today${plan.clashes ? " · ⚠ clash" : ""}`
      : "Nothing planned today";

    const mk = today.slice(0, 7);
    const monthPay = D.entries.filter((e) => e.date.startsWith(mk)).reduce((s, e) => s + e.hours * e.rate + (e.bonus || 0), 0);
    const nextShift = D.events.filter((e) => e.kind === "shift" && (e.date > today || (e.date === today && O.toMin(e.end) > nowMin()))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    $("optWork").textContent = D.active ? "⏱ On shift now"
      : nextShift ? `Next shift ${relDay(nextShift.date).toLowerCase() === "today" ? "today" : relDay(nextShift.date)} ${nextShift.start}`
      : `${money(monthPay)} this month`;

    const classesToday = plan.real.filter((i) => i.type === "class").length;
    const nextExam = D.events.filter((e) => e.kind === "exam" && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    $("optCollege").textContent = nextExam && O.daysBetween(today, nextExam.date) <= 14
      ? `📝 Exam ${countdown(nextExam.date)}`
      : classesToday ? `${classesToday} class${classesToday === 1 ? "" : "es"} today` : D.classes.length ? "No classes today" : "Add your timetable";

    const allOpen = D.tasks.filter((t) => !t.done);
    const overdue = allOpen.filter((t) => t.due && t.due < today).length;
    $("optTasks").textContent = overdue ? `⚠ ${overdue} overdue` : open ? `${open} due today` : allOpen.length ? `${allOpen.length} open` : "All clear ✓";

    renderUpcoming(today);
  }

  function renderNow(plan) {
    const m = nowMin();
    const items = plan.real;
    const cur = items.find((i) => i.s <= m && m < i.e);
    const next = items.find((i) => i.s > m);
    let pill = "Today", title, sub = "", meta = "";
    if (cur) {
      pill = "Now";
      title = `${KIND[cur.kind].icon} ${cur.title}`;
      sub = [cur.sub, cur.type === "live" ? "" : `until ${cur.end}`].filter(Boolean).join(" · ");
      if (next) meta = `Next: ${next.title} at ${next.start}`;
    } else if (next) {
      pill = "Next up";
      title = `${KIND[next.kind].icon} ${next.title}`;
      sub = [`${next.start}–${next.end}`, next.sub].filter(Boolean).join(" · ");
      meta = `in ${fmtDur(next.s - m)}`;
    } else if (items.length) {
      title = "You're done for today 🎉";
      sub = `${items.length} thing${items.length === 1 ? "" : "s"} done · ${fmtDur(plan.busy)} busy`;
    } else {
      title = "Your day is free ✨";
      sub = "Tap + to plan a shift, a class or a task";
    }
    $("nowPill").textContent = pill;
    $("nowPill").classList.toggle("live", pill === "Now");
    $("nowTitle").textContent = title;
    $("nowSub").textContent = sub;
    $("nowMeta").textContent = meta;
    $("nowCard").onclick = () => (location.href = "today.html");

    // mini day bar 07:00–23:00
    const S = 7 * 60, E = 23 * 60, span = E - S;
    const bar = $("dayBar");
    bar.innerHTML = items.map((i) => {
      const a = Math.max(S, i.s), b = Math.min(E, i.e);
      if (b <= a) return "";
      return `<span class="dseg${i.clash.length ? " clash" : ""}" style="left:${((a - S) / span) * 100}%;width:${((b - a) / span) * 100}%;background:${i.color}" title="${esc(i.title)}"></span>`;
    }).join("") + (m >= S && m <= E ? `<span class="now-line" style="left:${((m - S) / span) * 100}%"></span>` : "");
  }

  function renderUpcoming(today) {
    const end = addDays(today, 7);
    const ups = [];
    const m = nowMin();
    D.events
      .filter((e) => e.date <= end && (e.date > today || (e.date === today && O.toMin(e.end) > m && e.kind !== "shift")))
      .forEach((e) => ups.push({ when: e.date + e.start, ds: e.date, icon: KIND[e.kind].icon, title: e.title, sub: `${relDay(e.date)} · ${e.start}`, href: `today.html?date=${e.date}`, hot: e.kind === "exam" }));
    D.tasks.filter((t) => !t.done && t.due && t.due <= end)
      .forEach((t) => ups.push({ when: t.due + (t.dueTime || "23:59"), ds: t.due, icon: t.due < today ? "⚠️" : "✅", title: t.title, sub: dueLabel(t), href: "tasks.html", hot: t.due < today || t.priority === "high" }));
    ups.sort((a, b) => a.when.localeCompare(b.when));
    const shown = ups.slice(0, 5);
    $("upEmpty").hidden = shown.length > 0;
    $("upList").innerHTML = shown.map((u) => `
      <li><a class="up-item${u.hot ? " hot" : ""}" href="${u.href}">
        <span class="up-icon">${u.icon}</span>
        <span class="up-text"><b>${esc(u.title)}</b><small>${esc(u.sub)}</small></span>
        <svg class="chev"><use href="#i-chev"/></svg>
      </a></li>`).join("");
  }

  // ================= quick add + menu =================
  $("quickAdd").onclick = () => O.openSheet("addSheet");
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
    $("addSheet").close();
    const k = b.dataset.add;
    if (k === "task") O.openTaskForm({ onSaved: render });
    else O.openEventForm({ kind: k, onSaved: render });
  }));
  $("menuBtn").onclick = () => {
    $("mUser").textContent = username; $("mAvatar").textContent = username[0] || "?";
    O.openSheet("menuSheet");
  };
  $("logoutBtn").onclick = async () => {
    if (!(await O.ask({ title: "Log out?", text: "You can log back in any time. Everything stays saved.", yes: "Log out", neutral: true }))) return;
    await api("/logout", { method: "POST" }).catch(() => {});
    try { sessionStorage.removeItem("welcomed"); } catch {}
    username = ""; showLogin();
  };

  // keep "now / next" fresh
  setInterval(() => { if (!$("app").hidden) render(); }, 60e3);
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || $("app").hidden) return;
    try { await load(); render(); } catch {}
  });

  // ================= start =================
  try {
    const me = await api("/me");
    if (me.loggedIn) { username = me.username || ""; enter(false); } else showLogin();
  } catch (err) { showLogin(); $("loginErr").textContent = err.message; }
})();

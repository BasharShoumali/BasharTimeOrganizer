// My Schedule: one day at a time — classes, shifts, events, tasks, free time and clashes
(async () => {
  const { $, D, api, load, esc, todayStr, addDays, parseDate, weekStart, relDay, fmtDur, nowMin, minToTime, money, dayPlan, KIND, toast } = O;

  await O.page();
  const params = new URLSearchParams(location.search);
  let sel = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : todayStr();

  try { await load(); } catch (err) { toast(err.message); }
  render();
  if (params.get("add")) openAdd();

  // ================= render =================
  function render() {
    const today = todayStr();
    const r = relDay(sel), full = parseDate(sel).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    $("dayLabel").textContent = ["Today", "Tomorrow", "Yesterday"].includes(r) ? `${r} · ${full}` : full;
    $("goToday").hidden = sel === today;
    renderWeek(today);
    const plan = dayPlan(sel);
    renderChips(plan);
    renderTimeline(plan, today);
    renderDue(plan);
    history.replaceState(null, "", sel === today ? "today.html" : `today.html?date=${sel}`);
  }

  function renderWeek(today) {
    const ws = weekStart(sel);
    const we = addDays(ws, 6);
    const a = parseDate(ws), b = parseDate(we);
    $("weekLabel").textContent = a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${b.toLocaleDateString(undefined, { month: "long" })}`
      : `${a.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
    let html = "";
    for (let i = 0; i < 7; i++) {
      const ds = addDays(ws, i), d = parseDate(ds);
      const p = dayPlan(ds);
      const colors = p.real.slice(0, 4).map((x) => x.color);
      const tasks = p.tasks.filter((t) => !t.done).length;
      html += `<button class="dday${ds === sel ? " sel" : ""}${ds === today ? " today" : ""}${p.clashes ? " has-clash" : ""}" data-ds="${ds}">
        <span class="dl">${d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span class="dn">${d.getDate()}</span>
        <span class="dots">${colors.map((c) => `<i style="background:${c}"></i>`).join("")}${tasks ? '<i class="t"></i>' : ""}</span>
      </button>`;
    }
    $("dstrip").innerHTML = html;
    document.querySelectorAll(".dday").forEach((b) => (b.onclick = () => { sel = b.dataset.ds; render(); }));
  }

  function renderChips(plan) {
    const n = plan.real.length;
    const chips = [];
    chips.push(`<span class="sc">📋 ${n} thing${n === 1 ? "" : "s"}</span>`);
    if (plan.busy) chips.push(`<span class="sc">⏱ ${fmtDur(plan.busy)} busy</span>`);
    const free = plan.gaps.reduce((s, g) => s + (g.e - g.s), 0);
    if (free) chips.push(`<span class="sc">🌤 ${fmtDur(free)} free between</span>`);
    const work = plan.real.filter((i) => i.kind === "shift" || i.kind === "work").reduce((s, i) => s + (i.e - i.s), 0);
    if (work) chips.push(`<span class="sc">💼 ${fmtDur(work)} work</span>`);
    const cls = plan.real.filter((i) => i.type === "class").reduce((s, i) => s + (i.e - i.s), 0);
    if (cls) chips.push(`<span class="sc">🎓 ${fmtDur(cls)} classes</span>`);
    if (plan.clashes) chips.push(`<span class="sc warn">⚠ ${plan.clashes} clashing</span>`);
    $("sumChips").innerHTML = chips.join("");
  }

  function renderTimeline(plan, today) {
    const tl = $("timeline");
    if (!plan.items.length) {
      tl.innerHTML = `
        <div class="empty-day">
          <div class="empty-emoji">🌤</div>
          <b>Nothing planned ${sel === today ? "today" : "for " + relDay(sel)}</b>
          <p class="muted small">Plan a shift, add an event or block time to study.</p>
          <div class="row-gap center-row">
            <button class="btn ghost small" data-quick="shift">💼 Shift</button>
            <button class="btn ghost small" data-quick="event">📌 Event</button>
            <button class="btn ghost small" data-quick="study">📖 Study</button>
          </div>
        </div>`;
      tl.querySelectorAll("[data-quick]").forEach((b) => (b.onclick = () => O.openEventForm({ kind: b.dataset.quick, date: sel, onSaved: render })));
      return;
    }
    const isToday = sel === today;
    const m = nowMin();
    let nowPlaced = !isToday;
    let html = "";
    const nowMark = () => `<div class="now-mark"><span>Now · ${minToTime(m)}</span></div>`;

    plan.items.forEach((it, idx) => {
      const gap = plan.gaps.find((g) => g.before === it);
      const nowInGap = gap && !nowPlaced && m >= gap.s && m < gap.e;
      if (!nowPlaced && it.s > m && !nowInGap) { html += nowMark(); nowPlaced = true; }
      if (gap) {
        const left = nowInGap ? ` · ${fmtDur(gap.e - m)} left` : "";
        html += `<button class="gap" data-gap="${minToTime(nowInGap ? Math.ceil(m / 15) * 15 : gap.s)}">
          <span>🌤 Free · ${fmtDur(gap.e - gap.s)}${left}</span><span class="gap-add">+ plan</span>
        </button>`;
        if (nowInGap) { html += nowMark(); nowPlaced = true; }
      }
      const past = isToday ? it.e <= m : sel < today;
      const k = KIND[it.kind];
      const tag = it.type === "class" ? it.ref.kind : k.label;
      let extra = "";
      if (it.cancelled) extra += `<div class="tl-note">Cancelled this day</div>`;
      if (it.clash.length) extra += `<div class="tl-clash"><svg><use href="#i-warn"/></svg>Clashes with ${it.clash.map(esc).join(", ")}</div>`;
      if (it.kind === "shift") {
        if (it.logged) extra += `<div class="tl-ok">✓ Logged in Work Hours</div>`;
        else if (sel < today || (isToday && it.s <= m)) extra += `<button class="tl-log" data-log="${idx}">💼 Log these hours</button>`;
      }
      html += `
        <div class="tl-item${past ? " past" : ""}${it.cancelled ? " cancelled" : ""}${it.clash.length ? " clash" : ""}${it.type === "live" ? " live" : ""}" style="--c:${it.color}" data-idx="${idx}">
          <div class="tl-time"><b>${it.start}</b><small>${it.type === "live" ? "now" : it.end}</small></div>
          <div class="tl-card">
            <div class="tl-top"><span class="tl-icon">${k.icon}</span><b class="tl-title">${esc(it.title)}</b><span class="tl-tag">${esc(tag)}</span></div>
            <div class="tl-sub">${[esc(it.sub), fmtDur(it.e - it.s)].filter(Boolean).join(" · ")}</div>
            ${extra}
          </div>
        </div>`;
    });
    if (!nowPlaced) html += nowMark();
    tl.innerHTML = html;

    tl.querySelectorAll(".tl-item").forEach((el) => (el.onclick = (e) => {
      if (e.target.closest("[data-log]")) return;
      openItem(plan.items[Number(el.dataset.idx)]);
    }));
    tl.querySelectorAll("[data-log]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      await O.logShift(plan.items[Number(b.dataset.log)].ref);
      render();
    }));
    tl.querySelectorAll("[data-gap]").forEach((b) => (b.onclick = () => openAdd(b.dataset.gap)));
  }

  function renderDue(plan) {
    $("dueCard").hidden = !plan.tasks.length;
    $("dueList").innerHTML = plan.tasks
      .sort((a, b) => a.done - b.done || (a.dueTime || "99").localeCompare(b.dueTime || "99"))
      .map((t) => taskRow(t)).join("");
    bindTasks($("dueList"), plan.tasks);
  }

  function taskRow(t) {
    const meta = [t.dueTime, t.list === "college" ? `🎓 ${t.course || "College"}` : t.list === "work" ? "💼 Work" : "🌿 Personal", t.priority === "high" ? "🔥 High" : ""].filter(Boolean).join(" · ");
    return `<li class="task${t.done ? " done" : ""}${t.priority === "high" ? " high" : ""}" data-id="${t.id}">
      <button class="check" aria-label="Done"><svg><use href="#i-check"/></svg></button>
      <div class="task-text"><b>${esc(t.title)}</b><small>${esc(meta)}</small></div>
    </li>`;
  }
  function bindTasks(root, list) {
    root.querySelectorAll(".task").forEach((li) => {
      const t = () => D.tasks.find((x) => x.id === li.dataset.id);
      li.querySelector(".check").onclick = async (e) => {
        e.stopPropagation(); li.classList.toggle("done");
        await O.toggleTask(t()); render();
      };
      li.onclick = () => O.openTaskForm({ task: t(), onSaved: render });
    });
  }

  // ================= open things =================
  function openItem(it) {
    if (it.type === "event") return O.openEventForm({ event: it.ref, onSaved: render });
    if (it.type === "work" || it.type === "live") return (location.href = "work.html");
    if (it.type === "class") return openClass(it);
  }

  function openClass(it) {
    const c = it.ref;
    $("ciTitle").textContent = `🎓 ${c.course}`;
    $("ciRows").innerHTML = [
      ["Type", c.kind], ["When", `${parseDate(sel).toLocaleDateString(undefined, { weekday: "long" })} · ${c.start}–${c.end}`],
      ["Room", c.room], ["Lecturer", c.lecturer],
    ].filter((r) => r[1]).map((r) => `<div><span class="muted">${r[0]}</span><b>${esc(r[1])}</b></div>`).join("");
    const skipped = (c.skip || []).includes(sel);
    $("ciSkip").textContent = skipped ? "↩ Restore this day" : `🚫 Cancel just ${relDay(sel).toLowerCase() === "today" ? "today" : relDay(sel)}`;
    $("ciSkip").onclick = async () => {
      const skip = skipped ? c.skip.filter((d) => d !== sel) : [...(c.skip || []), sel];
      try {
        const saved = await api(`/classes/${c.id}`, { method: "PUT", body: { ...c, skip } });
        D.classes = D.classes.map((x) => (x.id === saved.id ? saved : x));
        $("classSheet").close(); render();
        toast(skipped ? "Class is back on ✓" : "Marked as cancelled this day");
      } catch (err) { toast(err.message); }
    };
    $("ciEdit").href = `college.html?edit=${c.id}`;
    O.openSheet("classSheet");
  }

  function openAdd(start = "") {
    $("addHead").textContent = `Add to ${relDay(sel).toLowerCase() === "today" ? "today" : relDay(sel)}${start ? " · " + start : ""}`;
    document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
      $("addSheet").close();
      const k = b.dataset.add;
      if (k === "task") O.openTaskForm({ due: sel, onSaved: render });
      else O.openEventForm({ kind: k, date: sel, start, onSaved: render });
    }));
    O.openSheet("addSheet");
  }

  // ================= nav =================
  $("addBtn").onclick = () => openAdd();
  $("prevWeek").onclick = () => { sel = addDays(sel, -7); render(); };
  $("nextWeek").onclick = () => { sel = addDays(sel, 7); render(); };
  $("goToday").onclick = () => { sel = todayStr(); render(); };

  // swipe left/right on the timeline to change day
  let sx = null;
  $("timeline").addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  $("timeline").addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 70) { sel = addDays(sel, dx < 0 ? 1 : -1); render(); }
  });

  setInterval(() => { if (sel === todayStr()) render(); }, 60e3);
  document.addEventListener("visibilitychange", async () => { if (!document.hidden) { try { await load(); render(); } catch {} } });
})();

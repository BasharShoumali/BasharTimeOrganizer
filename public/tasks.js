// Tasks: grouped by when they're due
(async () => {
  const { $, D, load, esc, todayStr, addDays, weekStart, dueLabel, toast } = O;
  await O.page();
  let filter = "all", showDone = false;
  try { await load(["tasks", "classes", "events", "settings"]); } catch (err) { toast(err.message); }

  function row(t) {
    const today = todayStr();
    const overdue = !t.done && t.due && t.due < today;
    const listTag = t.list === "college" ? `🎓 ${t.course || "College"}` : t.list === "work" ? "💼 Work" : "🌿 Personal";
    const meta = [dueLabel(t), listTag, t.note].filter(Boolean).join(" · ");
    return `<li class="task${t.done ? " done" : ""}${overdue ? " overdue" : ""}${t.priority === "high" ? " high" : ""}${t.priority === "low" ? " low" : ""}" data-id="${t.id}">
      <button class="check" aria-label="Mark done"><svg><use href="#i-check"/></svg></button>
      <div class="task-text"><b>${esc(t.title)}</b><small>${esc(meta)}</small></div>
      ${t.priority === "high" ? '<span class="flag">🔥</span>' : ""}
    </li>`;
  }

  function render() {
    const today = todayStr(), tomorrow = addDays(today, 1), week = addDays(today, 7);
    const mine = D.tasks.filter((t) => filter === "all" || t.list === filter);
    const open = mine.filter((t) => !t.done);
    const prio = { high: 0, normal: 1, low: 2 };
    const sort = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.dueTime || "99").localeCompare(b.dueTime || "99") || prio[a.priority] - prio[b.priority];

    const groups = [
      ["⚠️ Overdue", open.filter((t) => t.due && t.due < today), "overdue"],
      ["Today", open.filter((t) => t.due === today), "today"],
      ["Tomorrow", open.filter((t) => t.due === tomorrow), ""],
      ["This week", open.filter((t) => t.due > tomorrow && t.due <= week), ""],
      ["Later", open.filter((t) => t.due > week), ""],
      ["No date", open.filter((t) => !t.due), ""],
    ].filter((g) => g[1].length);

    $("groups").innerHTML = groups.map(([title, list, cls]) => `
      <section class="card tgroup ${cls}">
        <div class="card-head"><h2>${title}</h2><span class="count">${list.length}</span></div>
        <ul class="task-list">${list.sort(sort).map(row).join("")}</ul>
      </section>`).join("");
    $("tEmpty").hidden = groups.length > 0;

    const done = mine.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 20);
    $("doneToggle").hidden = !done.length;
    $("doneToggle").textContent = showDone ? "Hide completed" : `Show completed (${done.length})`;
    $("doneList").hidden = !showDone || !done.length;
    $("doneList").innerHTML = done.map(row).join("");

    // progress
    const todayAll = D.tasks.filter((t) => t.due === today);
    const todayDone = todayAll.filter((t) => t.done).length;
    const ws = weekStart(today);
    const weekDone = D.tasks.filter((t) => t.done && t.doneAt && String(t.doneAt).slice(0, 10) >= ws).length;
    $("progToday").textContent = `${todayDone} / ${todayAll.length} done`;
    $("progWeek").textContent = `${weekDone} completed`;
    $("progFill").style.width = todayAll.length ? `${(todayDone / todayAll.length) * 100}%` : "0%";
    const overdue = D.tasks.filter((t) => !t.done && t.due && t.due < today).length;
    $("progMsg").textContent = overdue ? `${overdue} overdue · let's clear ${overdue === 1 ? "it" : "them"} first 💪`
      : todayAll.length && todayDone === todayAll.length ? "Everything for today is done 🏆"
      : todayAll.length ? `${todayAll.length - todayDone} left for today · you've got this ⚡`
      : weekDone ? `${weekDone} done this week 🔥 nice momentum` : "Plan your day by adding a few tasks ✏️";
    const allOpen = D.tasks.filter((t) => !t.done).length;
    $("taskSub").textContent = allOpen ? `${allOpen} open` : "All clear ✓";

    document.querySelectorAll(".task").forEach((li) => {
      const t = () => D.tasks.find((x) => x.id === li.dataset.id);
      li.querySelector(".check").onclick = async (e) => {
        e.stopPropagation();
        li.classList.add("popping"); li.classList.toggle("done");
        await O.toggleTask(t());
        setTimeout(render, 350);
      };
      li.onclick = () => O.openTaskForm({ task: t(), onSaved: render });
    });
  }

  document.querySelectorAll("#filters .chip").forEach((c) => (c.onclick = () => {
    document.querySelectorAll("#filters .chip").forEach((x) => x.classList.toggle("active", x === c));
    filter = c.dataset.f; render();
  }));
  $("doneToggle").onclick = () => { showDone = !showDone; render(); };
  $("addBtn").onclick = () => O.openTaskForm({ list: filter === "all" ? "personal" : filter, onSaved: render });

  render();
  if (new URLSearchParams(location.search).get("add")) $("addBtn").click();
  document.addEventListener("visibilitychange", async () => { if (!document.hidden) { try { await load(["tasks"]); render(); } catch {} } });
})();

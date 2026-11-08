// College: weekly timetable + exams + homework
(async () => {
  const { $, D, api, load, esc, todayStr, parseDate, toMin, fmtDur, countdown, relDay, dueLabel, toast } = O;
  const COLORS = ["#8b7bff", "#4fd1c5", "#f472b6", "#fbbf24", "#60a5fa", "#34d399", "#fb923c", "#f87171"];
  const DAY_NAMES = [...Array(7)].map((_, i) => new Date(2026, 0, 4 + i).toLocaleDateString(undefined, { weekday: "long" })); // Jan 4 2026 = Sunday

  await O.page();
  const params = new URLSearchParams(location.search);
  let tab = params.get("tab") === "exams" ? "exams" : "timetable";
  let editing = null, color = COLORS[0], showDone = false;

  try { await load(); } catch (err) { toast(err.message); }

  // ================= class form =================
  const kindPick = O.pickGroup($("cKind"));
  const dayPick = O.pickGroup($("cDays"), checkClash);
  $("cColor").innerHTML = COLORS.map((c) => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Color"></button>`).join("");
  const setColor = (c) => { color = c; document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.c === c)); };
  document.querySelectorAll(".sw").forEach((b) => (b.onclick = () => setColor(b.dataset.c)));
  $("cCourse").addEventListener("input", () => { const c = O.courseColor($("cCourse").value.trim()); if (c) setColor(c); });
  ["cStart", "cEnd"].forEach((id) => $(id).addEventListener("input", checkClash));

  function nextColor() {
    const used = new Set(D.classes.map((c) => c.color));
    return COLORS.find((c) => !used.has(c)) || COLORS[D.classes.length % COLORS.length];
  }

  function openClassForm(c = null, day = null) {
    editing = c;
    $("classForm").reset();
    $("courseList") || document.body.insertAdjacentHTML("beforeend", '<datalist id="courseList"></datalist>');
    $("courseList").innerHTML = O.courses().map((x) => `<option value="${esc(x)}">`).join("");
    $("cHead").textContent = c ? "Edit lecture" : "Add a lecture";
    $("cSave").textContent = c ? "Save changes" : "Add lecture";
    $("cDelete").hidden = !c;
    $("cDaysLabel").textContent = c ? "Day · tap more days to copy it" : "Day(s) · every week";
    $("cCourse").value = c?.course || "";
    kindPick.set(c?.kind || "Lecture");
    dayPick.set(c ? [String(c.day)] : day !== null ? [String(day)] : []);
    $("cStart").value = c?.start || "";
    $("cEnd").value = c?.end || "";
    $("cRoom").value = c?.room || "";
    $("cLecturer").value = c?.lecturer || "";
    setColor(c?.color || nextColor());
    checkClash();
    O.openSheet("classSheet");
    if (!c) setTimeout(() => $("cCourse").focus(), 80);
  }

  function checkClash() {
    const s = $("cStart").value, e = $("cEnd").value, days = dayPick.get().map(Number);
    const box = $("cClash");
    if (!s || !e || !days.length || toMin(e) <= toMin(s)) { box.hidden = true; return; }
    const hits = D.classes.filter((x) => x.id !== editing?.id && days.includes(x.day) && toMin(x.end) > toMin(s) && toMin(e) > toMin(x.start));
    box.hidden = !hits.length;
    if (hits.length) box.innerHTML = `<svg><use href="#i-warn"/></svg><span><b>Overlaps</b> ${hits.map((h) => `${esc(h.course)} (${DAY_NAMES[h.day].slice(0, 3)} ${h.start}–${h.end})`).join(", ")}</span>`;
  }

  $("classForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const days = dayPick.get().map(Number).sort();
    const base = {
      course: $("cCourse").value.trim(), kind: kindPick.get(), start: $("cStart").value, end: $("cEnd").value,
      room: $("cRoom").value.trim(), lecturer: $("cLecturer").value.trim(), color, skip: editing?.skip || [],
    };
    if (!base.course) { toast("Add the course name ✏️"); return; }
    if (!days.length) { toast("Pick at least one day 📅"); return; }
    if (!base.start || !base.end || toMin(base.end) <= toMin(base.start)) { toast("Check start / end times ⏰"); return; }
    $("cSave").disabled = true;
    try {
      let rest = days;
      if (editing) {
        const keep = days.includes(editing.day) ? editing.day : days[0];
        const saved = await api(`/classes/${editing.id}`, { method: "PUT", body: { ...base, day: keep } });
        D.classes = D.classes.map((x) => (x.id === saved.id ? saved : x));
        rest = days.filter((d) => d !== keep);
      }
      for (const day of rest) D.classes.push(await api("/classes", { method: "POST", body: { ...base, skip: [], day } }));
      // keep the same color for every class of this course
      for (const x of D.classes.filter((x) => x.course === base.course && x.color !== color)) {
        const saved = await api(`/classes/${x.id}`, { method: "PUT", body: { ...x, color } });
        D.classes = D.classes.map((y) => (y.id === saved.id ? saved : y));
      }
      $("classSheet").close();
      toast(editing ? "Saved ✓" : `🎓 ${base.course} added · ${days.length} day${days.length === 1 ? "" : "s"} a week`);
      render();
    } catch (err) { toast(err.message); }
    $("cSave").disabled = false;
  });

  $("cDelete").onclick = async () => {
    const c = editing; if (!c) return;
    if (!(await O.ask({ title: `Delete ${c.course}?`, text: `${DAY_NAMES[c.day]} · ${c.start}–${c.end}. It's removed from every week.` }))) return;
    try {
      await api(`/classes/${c.id}`, { method: "DELETE" });
      D.classes = D.classes.filter((x) => x.id !== c.id);
      $("classSheet").close(); toast("Deleted"); render();
    } catch (err) { toast(err.message); }
  };

  // ================= semester =================
  function openSemester() {
    $("semStart").value = D.college.semesterStart || "";
    $("semEnd").value = D.college.semesterEnd || "";
    O.openSheet("semSheet");
  }
  $("semBtn").onclick = openSemester;
  $("semForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      D.college = await api("/college", { method: "PUT", body: { semesterStart: $("semStart").value, semesterEnd: $("semEnd").value } });
      $("semSheet").close(); toast("Semester saved ✓"); render();
    } catch (err) { toast(err.message); }
  });

  // ================= render =================
  function render() {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $("tabTimetable").hidden = tab !== "timetable";
    $("tabExams").hidden = tab !== "exams";
    const c = D.college;
    const fmt = (ds) => parseDate(ds).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    $("semLabel").textContent = c.semesterStart && c.semesterEnd ? `Semester ${fmt(c.semesterStart)} – ${fmt(c.semesterEnd)}`
      : c.semesterEnd ? `Semester ends ${fmt(c.semesterEnd)}` : "Your weekly timetable";
    renderTimetable();
    renderExams();
  }

  function renderTimetable() {
    const has = D.classes.length > 0;
    $("ttEmpty").hidden = has;
    $("ttChips").hidden = !has;
    if (!has) { $("ttDays").innerHTML = ""; return; }
    const mins = D.classes.reduce((s, x) => s + toMin(x.end) - toMin(x.start), 0);
    const nCourses = new Set(D.classes.map((x) => x.course)).size;
    $("ttChips").innerHTML = `<span class="sc">🎓 ${nCourses} course${nCourses === 1 ? "" : "s"}</span><span class="sc">📚 ${D.classes.length} class${D.classes.length === 1 ? "" : "es"} a week</span><span class="sc">⏱ ${fmtDur(mins)} a week</span>`;
    const todayWd = new Date().getDay();
    let html = "";
    for (let d = 0; d < 7; d++) {
      const list = D.classes.filter((x) => x.day === d).sort((a, b) => a.start.localeCompare(b.start));
      if (!list.length) {
        html += `<button class="free-day" data-addday="${d}"><b>${DAY_NAMES[d]}</b><span class="muted small">${d === todayWd ? "Today · " : ""}No classes · + add</span></button>`;
        continue;
      }
      html += `<section class="tt-day${d === todayWd ? " today" : ""}">
        <div class="tt-head"><b>${DAY_NAMES[d]}</b>${d === todayWd ? '<span class="pill">Today</span>' : ""}<span class="muted small">${fmtDur(list.reduce((s, x) => s + toMin(x.end) - toMin(x.start), 0))}</span></div>
        ${list.map((x) => `
          <button class="cls" style="--c:${x.color}" data-id="${x.id}">
            <span class="cls-time"><b>${x.start}</b><small>${x.end}</small></span>
            <span class="cls-body"><b>${esc(x.course)}</b><small>${[x.kind, x.room && "Room " + x.room, x.lecturer].filter(Boolean).map(esc).join(" · ")}</small></span>
            <svg class="chev"><use href="#i-chev"/></svg>
          </button>`).join("")}
      </section>`;
    }
    $("ttDays").innerHTML = html;
    document.querySelectorAll(".cls").forEach((b) => (b.onclick = () => openClassForm(D.classes.find((x) => x.id === b.dataset.id))));
    document.querySelectorAll("[data-addday]").forEach((b) => (b.onclick = () => openClassForm(null, Number(b.dataset.addday))));
  }

  function renderExams() {
    const today = todayStr();
    const exams = D.events.filter((e) => e.kind === "exam" && e.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    $("examEmpty").hidden = exams.length > 0;
    $("examList").innerHTML = exams.map((e) => {
      const n = O.daysBetween(today, e.date);
      return `<li><button class="exam${n <= 7 ? " soon" : ""}" data-id="${e.id}" style="--c:${O.courseColor(e.course) || "#f87171"}">
        <span class="exam-count"><b>${n === 0 ? "!" : n}</b><small>${n === 0 ? "today" : n === 1 ? "day" : "days"}</small></span>
        <span class="exam-body"><b>${esc(e.title)}</b><small>${[e.course, `${relDay(e.date)} · ${e.start}`, e.location].filter(Boolean).map(esc).join(" · ")}</small></span>
        <svg class="chev"><use href="#i-chev"/></svg>
      </button></li>`;
    }).join("");
    document.querySelectorAll(".exam").forEach((b) => (b.onclick = () => O.openEventForm({ event: D.events.find((x) => x.id === b.dataset.id), onSaved: render })));

    const hw = D.tasks.filter((t) => t.list === "college");
    const open = hw.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
    const done = hw.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 15);
    $("hwEmpty").hidden = open.length > 0;
    $("hwList").innerHTML = open.map(row).join("");
    $("hwDoneToggle").hidden = !done.length;
    $("hwDoneToggle").textContent = showDone ? "Hide completed" : `Show completed (${done.length})`;
    $("hwDone").hidden = !showDone;
    $("hwDone").innerHTML = done.map(row).join("");
    bind($("hwList")); bind($("hwDone"));
  }
  function row(t) {
    const overdue = !t.done && t.due && t.due < todayStr();
    const meta = [t.course && `🎓 ${t.course}`, dueLabel(t), t.priority === "high" ? "🔥" : ""].filter(Boolean).join(" · ");
    return `<li class="task${t.done ? " done" : ""}${overdue ? " overdue" : ""}${t.priority === "high" ? " high" : ""}" data-id="${t.id}">
      <button class="check" aria-label="Done"><svg><use href="#i-check"/></svg></button>
      <div class="task-text"><b>${esc(t.title)}</b><small>${esc(meta || "No due date")}</small></div>
    </li>`;
  }
  function bind(root) {
    root.querySelectorAll(".task").forEach((li) => {
      const t = () => D.tasks.find((x) => x.id === li.dataset.id);
      li.querySelector(".check").onclick = async (e) => { e.stopPropagation(); li.classList.toggle("done"); await O.toggleTask(t()); render(); };
      li.onclick = () => O.openTaskForm({ task: t(), onSaved: render });
    });
  }

  // ================= actions =================
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => {
    tab = b.dataset.tab; render();
    history.replaceState(null, "", tab === "exams" ? "college.html?tab=exams" : "college.html");
  }));
  $("ttFirst").onclick = () => openClassForm();
  $("addExam").onclick = () => O.openEventForm({ kind: "exam", onSaved: render });
  $("addHw").onclick = () => O.openTaskForm({ list: "college", onSaved: render });
  $("hwDoneToggle").onclick = () => { showDone = !showDone; render(); };
  $("addBtn").onclick = () => (tab === "exams" ? O.openTaskForm({ list: "college", onSaved: render }) : openClassForm());

  render();
  if (params.get("add") === "class") openClassForm();
  if (params.get("edit")) { const c = D.classes.find((x) => x.id === params.get("edit")); if (c) openClassForm(c); }
  if (params.get("semester")) openSemester();
  if (params.toString()) history.replaceState(null, "", tab === "exams" ? "college.html?tab=exams" : "college.html");
})();

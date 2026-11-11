// Money in & out — opened from the 💸 button on the Work Hours page.
// Other income (fixed monthly from another job, or one time) + expenses (fixed monthly or one time).
// Self-contained: it adds its own popups and talks to /api/expenses. Nothing in app.js depends on it.
(() => {
    const $ = (id) => document.getElementById(id);
    const pad = (n) => String(n).padStart(2, "0");
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); return monthOf(new Date(y, mo - 1 + n, 1)); };
    const daysInMonth = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
    const monthName = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
    const ordinal = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
  
    // money going out
    const CATS_OUT = {
      home:    ["🏠", "Rent / home"],
      phone:   ["📱", "Phone & internet"],
      car:     ["🚗", "Car & transport"],
      food:    ["🛒", "Food"],
      college: ["🎓", "College"],
      subs:    ["📺", "Subs & streaming"],
      health:  ["💊", "Health & gym"],
      family:  ["👨‍👩‍👧", "Family"],
      loan:    ["🏦", "Loan / bank"],
      other:   ["📦", "Other"],
    };
    // money coming in (besides your logged work hours)
    const CATS_IN = {
      job:    ["💼", "Another job"],
      family: ["👨‍👩‍👧", "Family"],
      grant:  ["🎓", "Scholarship / grant"],
      rent:   ["🏠", "Rent income"],
      gov:    ["🏛️", "Allowance"],
      gift:   ["🎁", "Gift"],
      refund: ["↩️", "Refund"],
      other:  ["💰", "Other"],
    };
    const HINT_OUT = { home: "e.g. Rent", phone: "e.g. Phone bill", car: "e.g. Fuel, insurance", food: "e.g. Groceries", college: "e.g. Tuition", subs: "e.g. Netflix, Spotify", health: "e.g. Gym", family: "e.g. Help at home", loan: "e.g. Loan payment", other: "e.g. Something else" };
    const HINT_IN = { job: "e.g. Weekend job, freelance", family: "e.g. Help from parents", grant: "e.g. Scholarship", rent: "e.g. Room rent", gov: "e.g. Student allowance", gift: "e.g. Birthday gift", refund: "e.g. Tax refund", other: "e.g. Sold something" };
    const SHORT = { job: "Side job" }; // short names for the category buttons
    const flowOf = (x) => (x.flow === "in" ? "in" : "out");
    const catsFor = (f) => (f === "in" ? CATS_IN : CATS_OUT);
    const catOf = (x) => catsFor(flowOf(x))[x.category] || catsFor(flowOf(x)).other;
  
    let items = [], entries = [], currency = "₪";
    let month = monthOf(new Date());
    let editing = null, flow = "out", kind = "monthly", cat = "home";
    const money = (n) => `${currency}${(Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  
    // ================= API (same session cookie as the rest of the site) =================
    async function api(path, opts = {}) {
      let res;
      try {
        res = await fetch("/api" + path, {
          method: opts.method || "GET",
          headers: opts.body ? { "Content-Type": "application/json" } : {},
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          credentials: "same-origin",
        });
      } catch { throw new Error("No connection. Check your internet and try again."); }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { location.replace("/"); throw new Error("Please log in again"); }
      if (!res.ok) throw new Error(data.error || "Server error");
      return data;
    }
  
    function toast(msg) {
      const t = $("toast"); if (!t) return;
      t.textContent = msg; t.classList.add("show");
      clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
    }
  
    // reuses the page's confirm popup
    function ask({ title, text = "", yes = "Delete" }) {
      const d = $("confirmDlg");
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      $("confirmYes").textContent = yes;
      $("confirmYes").classList.remove("neutral");
      $("confirmIcon").classList.remove("neutral");
      $("confirmIcon").innerHTML = '<svg><use href="#i-trash"/></svg>';
      return new Promise((resolve) => {
        const done = (v) => { $("confirmYes").onclick = $("confirmNo").onclick = null; d.onclose = null; if (d.open) d.close(); resolve(v); };
        $("confirmYes").onclick = () => done(true);
        $("confirmNo").onclick = () => done(false);
        d.onclose = () => done(false);
        d.onclick = (e) => { if (e.target === d) done(false); };
        d.showModal();
      });
    }
  
    // ================= popups =================
    document.body.insertAdjacentHTML("beforeend", `
    <dialog class="sheet ex-sheet" id="exSheet">
      <div class="handle"></div>
      <div class="sheet-head"><h2>💸 Money in &amp; out</h2><button class="icon-btn sm" data-exclose aria-label="Close"><svg><use href="#i-x"/></svg></button></div>
      <div class="ex-body">
        <div class="ex-month">
          <button class="icon-btn sm" id="exPrev" aria-label="Previous month"><svg><use href="#i-left"/></svg></button>
          <b id="exMonth"></b>
          <button class="icon-btn sm" id="exNext" aria-label="Next month"><svg><use href="#i-right"/></svg></button>
        </div>
  
        <section class="ex-summary">
          <div class="ex-nums">
            <div><span>💼 Work</span><b id="exEarned">0</b></div>
            <div><span>💰 Other income</span><b class="pos" id="exInTotal">0</b></div>
            <div><span>💸 Expenses</span><b class="neg" id="exTotal">0</b></div>
            <div class="ex-left"><span>Left</span><b id="exLeft">0</b></div>
          </div>
          <div class="ex-bar"><span id="exBarFill"></span></div>
          <div class="ex-msg" id="exMsg"></div>
          <div class="ex-paid" id="exPaid"></div>
        </section>
  
        <section class="ex-group">
          <div class="ex-group-head"><h3>💰 Other income</h3><span class="pos" id="exInSum"></span></div>
          <ul class="ex-list" id="exIn"></ul>
          <p class="ex-empty" id="exInEmpty">Money from another job, family, a scholarship… add it here.</p>
        </section>
  
        <div class="ex-cats" id="exCats"></div>
  
        <section class="ex-group">
          <div class="ex-group-head"><h3>🔁 Expenses every month</h3><span id="exMonthlySum"></span></div>
          <ul class="ex-list" id="exMonthly"></ul>
          <p class="ex-empty" id="exMonthlyEmpty">No fixed expenses yet. Rent, phone, gym…</p>
        </section>
  
        <section class="ex-group">
          <div class="ex-group-head"><h3>1️⃣ One-time expenses</h3><span id="exOnceSum"></span></div>
          <ul class="ex-list" id="exOnce"></ul>
          <p class="ex-empty" id="exOnceEmpty">No one-time expenses this month.</p>
        </section>
  
        <div class="ex-add-row">
          <button class="btn ex-add-in big" id="exAddIn"><svg><use href="#i-plus"/></svg>Income</button>
          <button class="btn primary big" id="exAdd"><svg><use href="#i-plus"/></svg>Expense</button>
        </div>
      </div>
    </dialog>
  
    <dialog class="sheet" id="exFormSheet">
      <div class="handle"></div>
      <div class="sheet-head"><h2 id="exFormHead">Add expense</h2><button class="icon-btn sm" data-exclose aria-label="Close"><svg><use href="#i-x"/></svg></button></div>
      <form id="exForm" autocomplete="off">
        <div class="ex-seg" id="exKind">
          <button type="button" data-k="monthly">🔁 Every month</button>
          <button type="button" data-k="once">1️⃣ One time</button>
        </div>
        <div class="field"><span>Category</span><div class="ex-catpick" id="exCatPick"></div></div>
        <label class="field"><span>Name</span><input type="text" id="exName" maxlength="80" /></label>
        <label class="field"><span>Amount</span>
          <div class="ex-amount" id="exAmountBox"><span id="exCur">₪</span><input type="number" id="exAmount" min="0" step="0.01" inputmode="decimal" placeholder="0" /></div>
        </label>
        <div class="field" id="exDayBox"><span id="exDayLabel">Day of the month it goes out</span>
          <div class="quick">
            <button type="button" class="q" data-day="1">1st</button>
            <button type="button" class="q" data-day="10">10th</button>
            <button type="button" class="q" data-day="15">15th</button>
            <input type="number" id="exDay" min="1" max="31" inputmode="numeric" aria-label="Day of month" />
          </div>
          <small class="ex-note" id="exFromNote"></small>
        </div>
        <label class="field" id="exDateBox"><span>Date</span><input type="date" id="exDate" /></label>
        <label class="field"><span>Note (optional)</span><input type="text" id="exNoteIn" maxlength="200" /></label>
        <div class="sheet-actions">
          <button type="button" class="btn danger" id="exDelete" hidden><svg><use href="#i-trash"/></svg></button>
          <button type="submit" class="btn primary big grow" id="exSave">Add</button>
        </div>
      </form>
    </dialog>`);
  
    ["exSheet", "exFormSheet"].forEach((id) => {
      const d = $(id);
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
      d.querySelectorAll("[data-exclose]").forEach((b) => (b.onclick = () => d.close()));
    });
  
    // ================= data helpers =================
    const activeIn = (x, m) => x.kind === "monthly" ? x.from <= m && (!x.until || m <= x.until) : x.date.startsWith(m);
    const isPaid = (x, m) => (x.kind === "monthly" ? (x.paid || []).includes(m) : !!x.paid);
  
    function dueInfo(x, m) {
      const inc = flowOf(x) === "in";
      if (isPaid(x, m)) return { text: inc ? "Received ✓" : "Paid ✓", cls: "ok" };
      const now = new Date(), cur = monthOf(now);
      const dueDay = x.kind === "monthly" ? Math.min(x.day, daysInMonth(m)) : Number(x.date.slice(8));
      if (m > cur) return { text: x.kind === "monthly" ? `On the ${ordinal(dueDay)}` : new Date(x.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }), cls: "" };
      if (m < cur) return { text: inc ? "Not marked as received" : "Not marked as paid", cls: inc ? "soon" : "late" };
      const diff = dueDay - now.getDate();
      if (diff < 0 && (x.kind === "once" || inc)) return { text: inc ? "Tap ○ when it arrives" : "Tap ○ when paid", cls: inc ? "soon" : "" };
      if (diff < 0) return { text: `Overdue · ${-diff} day${diff === -1 ? "" : "s"}`, cls: "late" };
      if (diff === 0) return { text: inc ? "Expected today" : "Due today", cls: "soon" };
      return { text: `${inc ? "Expected in" : "Due in"} ${diff} day${diff === 1 ? "" : "s"}`, cls: !inc && diff <= 3 ? "soon" : "" };
    }
  
    function earnedIn(m) {
      return entries.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.hours * e.rate + (e.bonus || 0), 0);
    }
  
    // ================= render list =================
    function row(x) {
      const inc = flowOf(x) === "in";
      const [emoji, label] = catOf(x);
      const due = dueInfo(x, month);
      const when = x.kind === "monthly" ? `Monthly · ${ordinal(x.day)}` : new Date(x.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      return `<li class="ex-row${inc ? " in" : ""}${isPaid(x, month) ? " paid" : ""}" data-id="${x.id}">
        <button class="ex-check" aria-label="${inc ? "Mark received" : "Mark paid"}"><svg><use href="#i-check"/></svg></button>
        <span class="ex-emoji" title="${esc(label)}">${emoji}</span>
        <span class="ex-text"><b>${esc(x.name)}</b><small>${esc(when)} · <em class="${due.cls}">${due.text}</em></small></span>
        <span class="ex-amt">${inc ? "+" : ""}${money(x.amount)}</span>
      </li>`;
    }
  
    function render() {
      $("exMonth").textContent = monthName(month);
      const list = items.filter((x) => activeIn(x, month));
      const incomes = list.filter((x) => flowOf(x) === "in").sort((a, b) => (a.kind === "monthly" ? pad(a.day) : a.date.slice(8)).localeCompare(b.kind === "monthly" ? pad(b.day) : b.date.slice(8)));
      const outs = list.filter((x) => flowOf(x) === "out");
      const monthly = outs.filter((x) => x.kind === "monthly").sort((a, b) => a.day - b.day);
      const once = outs.filter((x) => x.kind === "once").sort((a, b) => a.date.localeCompare(b.date));
      const sum = (arr) => arr.reduce((s, x) => s + x.amount, 0);
  
      const work = earnedIn(month), other = sum(incomes), moneyIn = work + other;
      const total = sum(outs), paid = sum(outs.filter((x) => isPaid(x, month)));
      const received = sum(incomes.filter((x) => isPaid(x, month)));
      const left = moneyIn - total;
  
      $("exEarned").textContent = money(work);
      $("exInTotal").textContent = (other ? "+" : "") + money(other);
      $("exTotal").textContent = money(total);
      $("exLeft").textContent = (left < 0 ? "−" : "") + money(Math.abs(left));
      $("exLeft").className = left < 0 ? "neg" : "pos";
      const pct = moneyIn > 0 ? Math.min(100, (total / moneyIn) * 100) : total > 0 ? 100 : 0;
      $("exBarFill").style.width = pct + "%";
      $("exBarFill").className = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";
      $("exMsg").textContent = !total && !other ? "Add your other income and fixed expenses to see what's left each month"
        : !moneyIn ? "No income this month yet"
        : !total ? `${money(moneyIn)} coming in this month 💪`
        : left >= 0 ? `Expenses take ${Math.round((total / moneyIn) * 100)}% of your income · ${money(left)} left 👍`
        : `Expenses are ${money(-left)} more than your income this month ⚠️`;
      const lines = [];
      if (other) lines.push(`<span>💰 Received ${money(received)} of ${money(other)}</span>`);
      if (total) lines.push(`<span>✓ Paid ${money(paid)}</span><span>⏳ Still to pay ${money(total - paid)}</span>`);
      $("exPaid").innerHTML = lines.join("");
  
      // expenses by category
      const byCat = {};
      outs.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + x.amount));
      $("exCats").innerHTML = Object.entries(byCat).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `<span class="ex-chip">${(CATS_OUT[c] || CATS_OUT.other)[0]} ${money(v)}</span>`).join("");
  
      $("exIn").innerHTML = incomes.map(row).join("");
      $("exMonthly").innerHTML = monthly.map(row).join("");
      $("exOnce").innerHTML = once.map(row).join("");
      $("exInEmpty").hidden = incomes.length > 0;
      $("exMonthlyEmpty").hidden = monthly.length > 0;
      $("exOnceEmpty").hidden = once.length > 0;
      $("exInSum").textContent = incomes.length ? "+" + money(other) : "";
      $("exMonthlySum").textContent = monthly.length ? money(sum(monthly)) : "";
      $("exOnceSum").textContent = once.length ? money(sum(once)) : "";
  
      document.querySelectorAll(".ex-row").forEach((li) => {
        const x = () => items.find((e) => e.id === li.dataset.id);
        li.querySelector(".ex-check").onclick = (e) => { e.stopPropagation(); togglePaid(x()); };
        li.onclick = () => openForm(x());
      });
    }
  
    async function togglePaid(x) {
      const nowPaid = !isPaid(x, month);
      const body = { ...x };
      if (x.kind === "monthly") body.paid = nowPaid ? [...(x.paid || []), month] : (x.paid || []).filter((m) => m !== month);
      else body.paid = nowPaid;
      try {
        const saved = await api(`/expenses/${x.id}`, { method: "PUT", body });
        items = items.map((e) => (e.id === saved.id ? saved : e));
        render();
        if (nowPaid) toast(flowOf(x) === "in" ? `💰 ${x.name} received` : `✓ ${x.name} paid`);
      } catch (err) { toast(err.message); }
    }
  
    // ================= form =================
    function setKind(k) {
      kind = k;
      document.querySelectorAll("#exKind button").forEach((b) => b.classList.toggle("on", b.dataset.k === k));
      $("exDayBox").hidden = k !== "monthly";
      $("exDateBox").hidden = k !== "once";
    }
    function setCat(c) {
      cat = c;
      document.querySelectorAll("#exCatPick button").forEach((b) => b.classList.toggle("on", b.dataset.c === c));
      $("exName").placeholder = (flow === "in" ? HINT_IN : HINT_OUT)[c] || "";
    }
    function setFlow(f) {
      flow = f;
      const cats = catsFor(f);
      $("exCatPick").classList.toggle("four", f === "in");
      $("exCatPick").innerHTML = Object.entries(cats).map(([k, [e, l]]) => `<button type="button" data-c="${k}"><span>${e}</span>${esc(SHORT[k] || l.split(" ")[0])}</button>`).join("");
      document.querySelectorAll("#exCatPick button").forEach((b) => (b.onclick = () => setCat(b.dataset.c)));
      $("exDayLabel").textContent = f === "in" ? "Day of the month it comes in" : "Day of the month it goes out";
      $("exFormSheet").classList.toggle("ex-income", f === "in");
    }
    function syncDayChips() {
      document.querySelectorAll("[data-day]").forEach((b) => b.classList.toggle("on", Number($("exDay").value) === Number(b.dataset.day)));
    }
    document.querySelectorAll("#exKind button").forEach((b) => (b.onclick = () => setKind(b.dataset.k)));
    document.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { $("exDay").value = b.dataset.day; syncDayChips(); }));
    $("exDay").addEventListener("input", syncDayChips);
  
    function openForm(x = null, newFlow = "out") {
      editing = x;
      $("exForm").reset();
      setFlow(x ? flowOf(x) : newFlow);
      const word = flow === "in" ? "income" : "expense";
      $("exCur").textContent = currency;
      $("exFormHead").textContent = x ? `Edit ${word}` : flow === "in" ? "Add other income" : "Add expense";
      $("exSave").textContent = x ? "Save changes" : "Add";
      $("exDelete").hidden = !x;
      $("exKind").hidden = !!x;
      setKind(x?.kind || "monthly");
      setCat(x?.category || (flow === "in" ? "job" : "home"));
      $("exName").value = x?.name || "";
      $("exAmount").value = x?.amount ?? "";
      $("exDay").value = x?.day || (flow === "in" ? 10 : 1);
      const today = dateStr(new Date());
      $("exDate").value = x?.date || (today.startsWith(month) ? today : `${month}-01`);
      $("exNoteIn").value = x?.note || "";
      $("exFromNote").textContent = x && x.kind === "monthly"
        ? `Since ${monthName(x.from)}${x.until ? ` · until ${monthName(x.until)}` : ""}`
        : `Starts from ${monthName(month)} and repeats every month`;
      syncDayChips();
      $("exFormSheet").showModal();
      if (!x) setTimeout(() => $("exName").focus(), 80);
    }
  
    $("exForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        flow, kind, category: cat, name: $("exName").value.trim(), amount: Number($("exAmount").value),
        note: $("exNoteIn").value.trim(),
      };
      if (!body.name) body.name = catsFor(flow)[cat][1].split(" /")[0];
      if (!(body.amount > 0)) { toast("Enter the amount 💰"); $("exAmount").focus(); return; }
      if (kind === "monthly") {
        body.day = Number($("exDay").value);
        if (!(body.day >= 1 && body.day <= 31)) { toast("Pick a day between 1 and 31"); return; }
        body.from = editing?.from || month; body.until = editing?.until || ""; body.paid = editing?.paid || [];
      } else {
        body.date = $("exDate").value;
        if (!body.date) { toast("Pick a date 📅"); return; }
        body.paid = editing?.paid || false;
      }
      $("exSave").disabled = true;
      try {
        if (editing) {
          const saved = await api(`/expenses/${editing.id}`, { method: "PUT", body });
          items = items.map((x) => (x.id === saved.id ? saved : x));
          toast("Saved ✓");
        } else {
          const saved = await api("/expenses", { method: "POST", body });
          items.push(saved);
          if (saved.kind === "once" && !saved.date.startsWith(month)) month = saved.date.slice(0, 7);
          toast(flow === "in" ? `💰 ${saved.name} added` : `💸 ${saved.name} added`);
        }
        $("exFormSheet").close(); render();
      } catch (err) { toast(err.message); }
      $("exSave").disabled = false;
    });
  
    $("exDelete").onclick = async () => {
      const x = editing; if (!x) return;
      try {
        if (x.kind === "monthly" && x.from < month) {
          // keep it in earlier months, stop it from the month you're looking at
          const ok = await ask({ title: `Stop “${x.name}”?`, text: `It won't count from ${monthName(month)} on. Earlier months keep it.`, yes: "Stop it" });
          if (!ok) return;
          const saved = await api(`/expenses/${x.id}`, { method: "PUT", body: { ...x, until: shiftMonth(month, -1) } });
          items = items.map((e) => (e.id === saved.id ? saved : e));
          toast("Stopped ✓");
        } else {
          const ok = await ask({ title: `Delete “${x.name}”?`, text: `${money(x.amount)}${x.kind === "monthly" ? " every month" : ""}` });
          if (!ok) return;
          await api(`/expenses/${x.id}`, { method: "DELETE" });
          items = items.filter((e) => e.id !== x.id);
          toast("Deleted");
        }
        $("exFormSheet").close(); render();
      } catch (err) { toast(err.message); }
    };
  
    // ================= open =================
    $("exPrev").onclick = () => { month = shiftMonth(month, -1); render(); };
    $("exNext").onclick = () => { month = shiftMonth(month, 1); render(); };
    $("exAdd").onclick = () => openForm(null, "out");
    $("exAddIn").onclick = () => openForm(null, "in");
  
    $("expensesBtn").onclick = async () => {
      const btn = $("expensesBtn");
      btn.disabled = true;
      try {
        const [ex, en, st] = await Promise.all([api("/expenses"), api("/entries"), api("/settings")]);
        items = ex; entries = en; currency = st.currency || "₪";
        render();
        $("exSheet").showModal();
      } catch (err) { toast(err.message); }
      btn.disabled = false;
    };
  })();
  
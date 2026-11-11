require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const {
  MONGODB_URI,
  APP_USERNAME,
  APP_PASSWORD,
  SESSION_SECRET,
  PORT = 3000,
  DB_NAME = "workhours",
} = process.env;

const missing = ["MONGODB_URI", "APP_USERNAME", "APP_PASSWORD", "SESSION_SECRET"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing settings in .env: ${missing.join(", ")} (see .env.example).`);
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use(express.json({ limit: "2mb" }));

// ---------- auth (signed cookie, no extra packages) ----------
const COOKIE = "wh_session";
const MAX_AGE_DAYS = 30;

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + MAX_AGE_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSession(req, res, token, maxAgeSec) {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}
function requireAuth(req, res, next) {
  if (readToken(getCookie(req, COOKIE))) return next();
  res.status(401).json({ error: "Not logged in" });
}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// simple brute-force protection: 10 wrong tries per 15 min per IP
const attempts = new Map();
function tooManyTries(ip) {
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  attempts.set(ip, a);
  return a.n >= 10;
}

app.post("/api/login", (req, res) => {
  if (tooManyTries(req.ip)) return res.status(429).json({ error: "Too many tries. Wait 15 minutes." });
  const userOk = safeEqual(String(req.body?.username ?? "").trim().toLowerCase(), APP_USERNAME.trim().toLowerCase());
  const passOk = safeEqual(req.body?.password ?? "", APP_PASSWORD);
  if (!userOk || !passOk) {
    attempts.get(req.ip).n++;
    return res.status(401).json({ error: "Wrong username or password" });
  }
  attempts.delete(req.ip);
  const username = APP_USERNAME.trim();
  setSession(req, res, makeToken(username), MAX_AGE_DAYS * 86400);
  res.json({ ok: true, username });
});
app.post("/api/logout", (req, res) => { setSession(req, res, "", 0); res.json({ ok: true }); });
app.get("/api/me", (req, res) => {
  const s = readToken(getCookie(req, COOKIE));
  res.json({ loggedIn: !!s, username: s?.u || null });
});

// ---------- validation ----------
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const num = (v, min = 0, max = 1e7) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
function calcHours(start, end, breakMin) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return Math.max(0, (mins - breakMin) / 60);
}
function cleanEntry(b) {
  if (!b || !["in", "out"].includes(b.type)) return { error: "Type must be IN or OUT" };
  if (!DATE.test(b.date || "")) return { error: "Bad date" };
  if (!TIME.test(b.start || "") || !TIME.test(b.end || "")) return { error: "Bad start/end time" };
  const breakMin = num(b.breakMin ?? 0, 0, 1440);
  const rate = num(b.rate ?? 0);
  const bonus = num(b.bonus ?? 0);
  if (breakMin === null || rate === null || bonus === null) return { error: "Bad number" };
  const hours = calcHours(b.start, b.end, breakMin);
  if (hours <= 0) return { error: "Hours must be more than 0" };
  return {
    entry: {
      type: b.type, date: b.date, start: b.start, end: b.end,
      breakMin, rate, bonus, hours,
      note: String(b.note || "").slice(0, 300),
    },
  };
}
// ---------- organizer validation ----------
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const COLOR = /^#[0-9a-fA-F]{6}$/;
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// weekly college class (lecture / practice / lab …)
function cleanClass(b) {
  const course = str(b?.course, 80);
  if (!course) return { error: "Course name is required" };
  const day = Number(b.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Bad day" };
  if (!TIME.test(b.start || "") || !TIME.test(b.end || "")) return { error: "Bad start/end time" };
  if (toMin(b.end) <= toMin(b.start)) return { error: "End must be after start" };
  const kinds = ["Lecture", "Practice", "Lab", "Seminar", "Other"];
  const skip = Array.isArray(b.skip) ? [...new Set(b.skip.filter((d) => DATE.test(d)))].slice(0, 60) : [];
  return {
    doc: {
      course, day, start: b.start, end: b.end,
      kind: kinds.includes(b.kind) ? b.kind : "Lecture",
      room: str(b.room, 60), lecturer: str(b.lecturer, 60),
      color: COLOR.test(b.color || "") ? b.color : "#8b7bff",
      skip,
    },
  };
}

// one-time item in the schedule: event / planned work shift / study session / exam
function cleanEvent(b) {
  const kinds = ["event", "shift", "study", "exam", "personal"];
  const kind = kinds.includes(b?.kind) ? b.kind : "event";
  const title = str(b?.title, 100) || (kind === "shift" ? "Work shift" : "");
  if (!title) return { error: "Title is required" };
  if (!DATE.test(b.date || "")) return { error: "Bad date" };
  if (!TIME.test(b.start || "") || !TIME.test(b.end || "")) return { error: "Bad start/end time" };
  if (b.start === b.end) return { error: "End must be different from start" };
  const doc = {
    kind, title, date: b.date, start: b.start, end: b.end,
    location: str(b.location, 80), note: str(b.note, 300), course: str(b.course, 80),
  };
  if (kind === "shift") {
    doc.payType = b.payType === "in" ? "in" : "out";
    doc.rate = num(b.rate ?? 0) ?? 0;
    doc.entryId = /^[a-f0-9]{24}$/.test(b.entryId || "") ? b.entryId : "";
  }
  return { doc };
}

// money going out: fixed every month, or one time
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const EXPENSE_CATS = ["home", "phone", "car", "food", "college", "subs", "health", "family", "loan", "other"];
const INCOME_CATS = ["job", "family", "grant", "rent", "gov", "gift", "refund", "other"];
// flow "out" = expense, flow "in" = other income (another job, family, scholarship…)
function cleanExpense(b) {
  const name = str(b?.name, 80);
  if (!name) return { error: "Name is required" };
  const amount = num(b.amount, 0.01);
  if (amount === null) return { error: "Amount must be more than 0" };
  const kind = b.kind === "once" ? "once" : "monthly";
  const flow = b.flow === "in" ? "in" : "out";
  const cats = flow === "in" ? INCOME_CATS : EXPENSE_CATS;
  const doc = {
    name, amount, kind, flow,
    category: cats.includes(b.category) ? b.category : "other",
    note: str(b.note, 200),
  };
  if (kind === "monthly") {
    const day = Number(b.day);
    if (!Number.isInteger(day) || day < 1 || day > 31) return { error: "Pick a day of the month (1–31)" };
    if (!MONTH.test(b.from || "")) return { error: "Bad start month" };
    if (b.until && !MONTH.test(b.until)) return { error: "Bad end month" };
    if (b.until && b.until < b.from) return { error: "End month is before start month" };
    doc.day = day; doc.from = b.from; doc.until = b.until || "";
    doc.paid = Array.isArray(b.paid) ? [...new Set(b.paid.filter((m) => MONTH.test(m)))].slice(-120) : [];
  } else {
    if (!DATE.test(b.date || "")) return { error: "Bad date" };
    doc.date = b.date;
    doc.paid = !!b.paid;
  }
  return { doc };
}

function cleanTask(b) {
  const title = str(b?.title, 140);
  if (!title) return { error: "Task title is required" };
  if (b.due && !DATE.test(b.due)) return { error: "Bad due date" };
  if (b.dueTime && !TIME.test(b.dueTime)) return { error: "Bad due time" };
  const done = !!b.done;
  return {
    doc: {
      title, due: b.due || "", dueTime: b.due ? b.dueTime || "" : "",
      list: ["personal", "college", "work"].includes(b.list) ? b.list : "personal",
      priority: ["low", "normal", "high"].includes(b.priority) ? b.priority : "normal",
      course: str(b.course, 80), note: str(b.note, 300),
      done, doneAt: done ? (b.doneAt && !isNaN(new Date(b.doneAt)) ? new Date(b.doneAt) : new Date()) : null,
    },
  };
}

const toClient = ({ _id, ...rest }) => ({ id: String(_id), ...rest });
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// ---------- start ----------
async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const Entries = db.collection("entries");
  const Settings = db.collection("settings");
  await Entries.createIndex({ date: 1 });
  console.log("Connected to MongoDB");

  const api = express.Router();
  api.use(requireAuth);

  api.get("/entries", async (_req, res) => {
    res.json((await Entries.find().sort({ date: -1, start: -1 }).toArray()).map(toClient));
  });

  api.post("/entries", async (req, res) => {
    const { entry, error } = cleanEntry(req.body);
    if (error) return res.status(400).json({ error });
    entry.createdAt = new Date();
    const r = await Entries.insertOne(entry);
    res.status(201).json(toClient({ _id: r.insertedId, ...entry }));
  });

  api.put("/entries/:id", async (req, res) => {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: "Bad id" });
    const { entry, error } = cleanEntry(req.body);
    if (error) return res.status(400).json({ error });
    entry.updatedAt = new Date();
    const r = await Entries.findOneAndUpdate({ _id }, { $set: entry }, { returnDocument: "after" });
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(toClient(r));
  });

  api.delete("/entries/:id", async (req, res) => {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: "Bad id" });
    const r = await Entries.deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  });

  api.delete("/entries", async (_req, res) => {
    const r = await Entries.deleteMany({});
    res.json({ deleted: r.deletedCount });
  });

  // bulk import (restore backup / move old browser data)
  api.post("/import", async (req, res) => {
    const list = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!list) return res.status(400).json({ error: "No entries" });
    const good = [];
    for (const b of list) {
      const { entry } = cleanEntry(b);
      if (entry) good.push({ ...entry, createdAt: new Date() });
    }
    if (req.body.replace) await Entries.deleteMany({});
    if (good.length) await Entries.insertMany(good);
    if (req.body.settings) {
      const s = cleanSettings(req.body.settings);
      if (s) await Settings.updateOne({ _id: "main" }, { $set: s }, { upsert: true });
    }
    res.json({ imported: good.length, skipped: list.length - good.length });
  });

  function cleanSettings(b) {
    const rate = num(b?.rate ?? 0);
    const goal = num(b?.goal ?? 0);
    if (rate === null || goal === null) return null;
    return {
      rate,
      goal,
      currency: String(b.currency || "₪").slice(0, 4),
      name: String(b.name || "").trim().slice(0, 30),
    };
  }

  api.get("/settings", async (_req, res) => {
    const s = await Settings.findOne({ _id: "main" });
    res.json({ rate: s?.rate ?? 40, currency: s?.currency ?? "₪", goal: s?.goal ?? 5000, name: s?.name ?? "" });
  });

  // live shift timer (shared by all your devices)
  api.get("/active", async (_req, res) => {
    const a = await Settings.findOne({ _id: "active" });
    res.json(a?.start ? { start: a.start, type: a.type } : {});
  });

  api.put("/active", async (req, res) => {
    const start = new Date(req.body?.start);
    const type = req.body?.type === "in" ? "in" : "out";
    if (isNaN(start) || start > new Date(Date.now() + 60e3) || Date.now() - start > 2 * 864e5) {
      return res.status(400).json({ error: "Bad start time" });
    }
    await Settings.updateOne({ _id: "active" }, { $set: { start: start.toISOString(), type } }, { upsert: true });
    res.json({ start: start.toISOString(), type });
  });

  api.delete("/active", async (_req, res) => {
    await Settings.deleteOne({ _id: "active" });
    res.json({ ok: true });
  });

  api.put("/settings", async (req, res) => {
    const s = cleanSettings(req.body);
    if (!s) return res.status(400).json({ error: "Bad settings" });
    await Settings.updateOne({ _id: "main" }, { $set: s }, { upsert: true });
    res.json(s);
  });

  // ---------- organizer: classes, events, tasks ----------
  function crud(name, col, clean, sort) {
    api.get(`/${name}`, async (_req, res) => {
      res.json((await col.find().sort(sort).toArray()).map(toClient));
    });
    api.post(`/${name}`, async (req, res) => {
      const { doc, error } = clean(req.body);
      if (error) return res.status(400).json({ error });
      doc.createdAt = new Date();
      const r = await col.insertOne(doc);
      res.status(201).json(toClient({ _id: r.insertedId, ...doc }));
    });
    api.put(`/${name}/:id`, async (req, res) => {
      const _id = oid(req.params.id);
      if (!_id) return res.status(400).json({ error: "Bad id" });
      const { doc, error } = clean(req.body);
      if (error) return res.status(400).json({ error });
      doc.updatedAt = new Date();
      const r = await col.findOneAndUpdate({ _id }, { $set: doc }, { returnDocument: "after" });
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(toClient(r));
    });
    api.delete(`/${name}/:id`, async (req, res) => {
      const _id = oid(req.params.id);
      if (!_id) return res.status(400).json({ error: "Bad id" });
      const r = await col.deleteOne({ _id });
      res.json({ deleted: r.deletedCount });
    });
  }
  const Classes = db.collection("classes");
  const Events = db.collection("events");
  const Tasks = db.collection("tasks");
  await Events.createIndex({ date: 1 });
  await Tasks.createIndex({ done: 1, due: 1 });
  crud("classes", Classes, cleanClass, { day: 1, start: 1 });
  crud("events", Events, cleanEvent, { date: 1, start: 1 });
  crud("tasks", Tasks, cleanTask, { done: 1, due: 1 });
  const Expenses = db.collection("expenses");
  crud("expenses", Expenses, cleanExpense, { kind: 1, day: 1, date: 1 });

  // semester dates (lectures only show between them, if set)
  api.get("/college", async (_req, res) => {
    const c = await Settings.findOne({ _id: "college" });
    res.json({ semesterStart: c?.semesterStart || "", semesterEnd: c?.semesterEnd || "" });
  });
  api.put("/college", async (req, res) => {
    const s = req.body?.semesterStart || "", e = req.body?.semesterEnd || "";
    if ((s && !DATE.test(s)) || (e && !DATE.test(e))) return res.status(400).json({ error: "Bad date" });
    if (s && e && e < s) return res.status(400).json({ error: "Semester end must be after start" });
    await Settings.updateOne({ _id: "college" }, { $set: { semesterStart: s, semesterEnd: e } }, { upsert: true });
    res.json({ semesterStart: s, semesterEnd: e });
  });

  // full backup of everything
  api.get("/export", async (_req, res) => {
    const [entries, classes, events, tasks, expenses, settings, college] = await Promise.all([
      Entries.find().toArray(), Classes.find().toArray(), Events.find().toArray(), Tasks.find().toArray(),
      Expenses.find().toArray(), Settings.findOne({ _id: "main" }), Settings.findOne({ _id: "college" }),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="organizer-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date(), entries: entries.map(toClient), classes: classes.map(toClient),
      events: events.map(toClient), tasks: tasks.map(toClient), expenses: expenses.map(toClient), settings, college,
    });
  });

  app.use("/api", api);
  app.use(express.static(path.join(__dirname, "public")));

  app.listen(PORT, () => console.log(`Organizer running on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error("Could not start:", err.message);
  process.exit(1);
});

# My Organizer — with MongoDB

Your daily organizer: work shifts, college lectures, exams, tasks and your whole day in one place. Everything is saved in your own MongoDB database, so it works on your phone and computer.

After you log in, the home screen shows **what's happening now / next** and lets you pick what to organize:

| Option | What it does |
|---|---|
| 📅 **My Schedule** | Your day as a timeline: lectures, planned shifts, events, study time, exams and tasks together. Shows **free time**, **clashes** and a **Now** line. Swipe left/right to change day. |
| 💼 **Work Hours** | Log worked days (**PAID** = money at end of day, **UNPAID** = paid next month), bonus counted on its own, shift timer, monthly goal. |
| 🎓 **College** | Weekly lecture timetable (add once, repeats every week), exams with countdown, homework. |
| ✅ **Tasks** | To-do list grouped by Overdue / Today / Tomorrow / This week, with priorities and lists. |

```
work-hours/
├── server.js          ← the server (API + login + MongoDB)
├── package.json
├── .env.example       ← copy to .env and fill in
└── public/            ← the website
    ├── index.html     ← login + home screen      (home.js)
    ├── today.html     ← My Schedule              (today.js)
    ├── college.html   ← College                  (college.js)
    ├── tasks.html     ← Tasks                    (tasks.js)
    ├── work.html      ← Work Hours               (app.js)
    ├── core.js        ← shared code: forms, schedule engine
    ├── style.css      ← shared design
    └── organizer.css  ← design for the new pages
```

---

## Step 1 — Create the free MongoDB database (Atlas)

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up (free).
2. Create a cluster → choose the **Free (M0)** option → any region close to you → **Create**.
3. It asks you to create a **database user**: pick a username and password and **save them**.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   This is needed because free hosting (Render) doesn't have a fixed IP. Your database is still protected by its user password.
5. **Connect** → **Drivers** → copy the connection string. It looks like:
   `mongodb+srv://myuser:<db_password>@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority`
   Replace `<db_password>` with the database user's password.

## Step 2 — Run it on your computer (to try it)

You need **Node.js 20 or newer**: https://nodejs.org

```bash
cd work-hours
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```

Open `.env` and fill in:

| Setting | What to put |
|---|---|
| `MONGODB_URI` | the connection string from Step 1 |
| `APP_USERNAME` | your username for the site (it's also shown at the top of the page) |
| `APP_PASSWORD` | the password you will type to log in to the site |
| `SESSION_SECRET` | any long random text (mash the keyboard, 30+ characters) |

Then:

```bash
npm start
```

Open **http://localhost:3000** and log in with your `APP_USERNAME` and `APP_PASSWORD`.

## Step 3 — Put it online for free (Render)

1. Put the `work-hours` folder in a GitHub repository (the `.gitignore` keeps your `.env` private, so never upload `.env`).
2. Go to **https://render.com** → sign up → **New** → **Web Service** → pick your repository.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Under **Environment**, add the same four values: `MONGODB_URI`, `APP_USERNAME`, `APP_PASSWORD`, `SESSION_SECRET`.
5. Click **Deploy**. You get a link like `https://work-hours-xxxx.onrender.com`. Open it on your phone and use **Add to Home Screen**.

> On Render's free plan the site "sleeps" after 15 minutes without use, so the first open can take ~30–60 seconds. Your data is safe in MongoDB.

---

## Moving data from the old version

If you used the first (browser-only) version on a device, open the new site **in that same browser** and log in. A blue bar offers to **move the old days into the database**: one click.

## Using it on your phone

- On the home screen, the big **+** lets you add anything: plan a shift, log a work day, lecture, exam, task, event, study time.
- **Plan a shift** in My Schedule. After it happens, tap **Log these hours** and it's saved in Work Hours automatically.
- **Lectures** are added once in College and show up every week. Lecture cancelled? Tap it in My Schedule, then **Cancel just today**.
- Set your **semester dates** (⚙ in College) so lectures stop showing after the semester ends.
- If two things overlap you'll see **⚠ Clashes with…** while adding and in the timeline.
- Tap a **Free** gap in the timeline to plan something in it.
- **Work Hours:** **Start shift** runs a live timer; **Details** lists every day of the month; tap a day to edit it.
- **Money in & out (💸 on the Work Hours page):** add **other income** (a side job, family, scholarship… fixed every month or one time) and **expenses** (rent, phone, gym… fixed or one time). See **Work + Other income − Expenses = Left** for each month, tap ○ to mark something received / paid, and use ‹ › to switch months. Deleting a monthly item in a later month only stops it from that month on.
- **Menu (⚙ on home) → Download full backup** saves everything as one file.
- In your phone browser's menu, tap **Add to Home Screen** to open it like an app.

## Backups

- **Backup** downloads all your data as a `.json` file.
- **Restore** replaces everything in the database with a backup file.
- **Export CSV** downloads the month you're viewing to open in Excel.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing settings in .env: …` when starting | add the setting it names to `.env` (for example `APP_USERNAME=YourName`) |
| `Could not start: … authentication failed` | wrong database username/password in `MONGODB_URI` |
| `Could not start: … timed out` / `ECONNREFUSED` | add `0.0.0.0/0` in Atlas → Network Access |
| "Too many tries" on login | 10 wrong passwords: wait 15 minutes |
| Want to change your username or password | change `APP_USERNAME` / `APP_PASSWORD` in `.env` (or in Render → Environment) and restart |

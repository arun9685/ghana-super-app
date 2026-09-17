# Beginner Setup Guide (assumes zero coding experience)

This guide assumes you've never used a terminal or written code before.
Every step is spelled out — nothing is assumed.

Being upfront: a few of these steps (typing commands, editing a text file)
are inherently a little technical, even with every click explained. If you
get stuck anywhere, that's normal, not a sign you're doing it wrong — copy
the error message you see and send it to me, or to a developer, and it's
usually a two-minute fix. Nobody gets this right on the first try alone the
first time.

**Time needed:** about 30–40 minutes, mostly waiting for downloads to install.

---

## Part 1 — Install three free programs

You need three pieces of software on your computer. Install them in this
order.

### 1. Node.js

This is the "engine" the app's backend code runs on.

- Go to **https://nodejs.org**
- Click the big green button that says **LTS** (it will say something like
  "20.x.x LTS")
- Open the file you downloaded and click Next/Continue through the
  installer, accepting the defaults, until it says it finished.

### 2. Docker Desktop

This is a program that creates a small self-contained "box" on your
computer to run the app's database in, without you needing to set up a
real database by hand.

- Go to **https://www.docker.com/products/docker-desktop**
- Download the version for your computer (Mac or Windows)
- Install it the same way — open the file, click through the installer
- **Important:** after installing, actually open the Docker Desktop app
  (search for "Docker" in your Applications/Start menu). You'll see a
  whale icon appear. Leave Docker Desktop open in the background for
  everything below — if it's not running, nothing else will work.

### 3. Visual Studio Code (VS Code)

This is a text editor that also gives you an easy way to type commands,
without needing to hunt for a separate "terminal" program.

- Go to **https://code.visualstudio.com**
- Click **Download**
- Install it the same way as above.

---

## Part 2 — Get the project files onto your computer

1. Find the project zip file you downloaded from me.
2. **Double-click it** to unzip it. This creates a folder called
   `ghana-super-app`.
3. Move that folder somewhere you'll remember — e.g., your Desktop, or a
   folder called "Projects" in your Documents.

---

## Part 3 — Open the project in VS Code

1. Open **VS Code** (the program you installed in Part 1).
2. Click **File → Open Folder...**
3. Select the `ghana-super-app` folder you just unzipped, and click Open.
4. You'll now see a list of files and folders on the left side. That's the
   project.

---

## Part 4 — Open a "terminal" inside VS Code

A terminal is just a place to type instructions for your computer instead
of clicking buttons. It looks intimidating but you're only ever going to
copy-paste lines from this guide into it.

1. In VS Code, click **Terminal** in the top menu bar, then **New Terminal**.
2. A panel opens at the bottom of the screen with a blinking cursor. This
   is the terminal, and it's already pointed at your project folder — you
   don't need to navigate anywhere.

Every "run this" instruction below means: **click into that terminal
panel, paste the text, and press Enter.**

---

## Part 5 — Create your settings file

The project needs two small settings files that aren't included by default
(on purpose — one of them is meant to hold secrets you create yourself, not
ones I hand you): one for the backend, one for the frontend (the website
part you'll actually click around in).

1. In the terminal, paste this and press Enter:
   ```
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Nothing visible happens — that's correct. It just made copies of two files.
   The frontend one needs no further changes — only the backend one does,
   in the next step.

2. In the file list on the left side of VS Code, open the **`backend`**
   folder, and inside it find the file named **`.env`** (files starting
   with a dot are sometimes hidden by default; if you don't see it, click
   the three-dot menu at the top of the file list and choose "Show Hidden
   Files", or just ask me for help finding it).

3. In that file, find these two lines:
   ```
   JWT_ACCESS_SECRET=change_me_dev_only_access_secret
   JWT_REFRESH_SECRET=change_me_dev_only_refresh_secret
   ```
   Change the text after each `=` sign to any random string of letters and
   numbers, at least 16 characters long. For example (don't use this exact
   one — make up your own):
   ```
   JWT_ACCESS_SECRET=kj3h4kjh2b4kj23hb4k2jh3b4k2jh
   JWT_REFRESH_SECRET=98asd7f98asd7f98asd7f98asd7f9
   ```
   Just mash your keyboard for each one — it doesn't need to mean anything.

4. Save the file: **Ctrl+S** (Windows) or **Cmd+S** (Mac).

---

## Part 6 — Install the app's building blocks

The project depends on other pieces of code that aren't included in the
zip (this is completely normal for how software is built) — this step
downloads them.

1. In the terminal, run:
   ```
   cd backend
   ```
   This moves you "into" the backend folder. (`cd` means "change directory" —
   directory is just an old word for folder.)

2. Now run:
   ```
   npm install
   ```
   This will print out a lot of text and take a minute or two. That's
   normal — it's downloading everything the backend needs. Wait until you
   see your cursor blinking on an empty line again, with no more text
   appearing.

3. Go back to the main project folder, then do the same thing for the
   frontend (the website part):
   ```
   cd ..
   cd frontend
   npm install
   cd ..
   ```
   This one downloads a different set of building blocks (for the part you
   see in your browser) and will also take a minute or two.

---

## Part 7 — Start the database

The app needs a database to store things like user accounts. Docker will
run this for you in the background.

1. Run:
   ```
   docker compose up -d postgres redis
   ```
   This starts two small programs (the database, and a fast temporary
   storage system called Redis) inside Docker. You should see some text
   and then your cursor back.

2. Wait about 10 seconds — the database needs a moment to fully start.

3. Now set up the actual structure of the database (which tables it has,
   etc.) — this is a one-time step:
   ```
   cd backend
   npm run prisma:migrate -- --name init
   ```
   (This uses a small helper — `dotenv-cli` — that explicitly hands the
   settings file to the database tool. Prisma's own built-in way of
   finding that file is unreliable across different computers, so the
   project is set up to sidestep it entirely rather than rely on it.)
   You'll see some text, and it may ask you to confirm something — if so,
   just press Enter to accept the default. Wait until you see a message
   like `Your database is now in sync with your schema.`

4. Still inside the `backend` folder, fill the database with some starting
   data every fresh install needs (ride pricing, and one admin account you
   can log in with):
   ```
   npm run prisma:seed
   ```
   You'll see a line printed confirming it seeded pricing rules and an
   admin account — remember the phone number it prints (it will be
   `0200000000`), you'll use it later to open the admin screens.

5. Go back to the main folder:
   ```
   cd ..
   ```

**If this step gives you a red error message about not being able to
connect** — Docker Desktop probably isn't fully started yet. Check that
the whale icon (Docker Desktop) is open and says "running," wait 15
seconds, and try the `npm run prisma:migrate -- --name init` command again.

---

## Part 8 — Start the app

Run:
```
docker compose up --build
```

This will print a lot of text (this is normal — it's building and
starting the backend, the database connections, and the website) and then
settle into showing ongoing log messages. When you see a line like:

```
Ghana Super App backend listening on port 3000 (development)
```

...the app is running. **Leave this terminal window open** — closing it
stops everything. If you need to type more commands, open a second
terminal (Terminal → New Terminal again) rather than closing this one.

---

## Part 9 — Check that it actually works

Open your web browser and go to:

```
http://localhost:5173
```

You should see the Sankofa login screen. Type in any Ghana-style phone
number, e.g. `0244123456`, and click **Send verification code**.

Now look at your **first** terminal (the one running the app) — scroll up
a little and you'll see a line containing a 6-digit code, something like:
```
[DEV SMS] OTP for 0244123456 is 483920 (valid 5 min)
```

Type that 6-digit number into the browser and click **Verify & continue**.
You should land on the dashboard — you've just registered a user and
logged them in, for real, using the code I built for you.

From here you can click **Move** to book a ride between two real Accra
locations and see a live fare estimate. To see the driver side of the same
ride, open a **second** browser window in **Incognito/Private mode** (so it
doesn't share your login), go to `http://localhost:5173` again, register a
*different* phone number, click **Become a driver**, and fill in the short
form. Then, back in your first window, log out and log in as the admin
account from Part 7 step 4 (phone `0200000000`) — you'll land in a normal
account, so click **Admin** in the top menu, then **Driver verification**,
and approve the driver you just registered. That driver can now go online
at `/drive` in their own window, and will be matched to a ride requested
from your first account, live, with no page refresh needed.

If you'd rather test with raw commands instead of the browser, that still
works — see `SETUP.md`'s curl examples, which exercise the same backend
underneath.

---

## Part 10 — Stopping everything

When you're done for the day:

1. Click into the terminal running the app and press **Ctrl+C** to stop it.
2. Run:
   ```
   docker compose down
   ```
   This stops the database too, cleanly.

Next time, you only need **Part 8** (and optionally Part 9) to start
everything again — Parts 1–7 are one-time setup.

---

## If something goes wrong

This is genuinely normal — nobody, technical or not, gets a first-time
project setup running with zero hiccups. When you hit an error:

1. Don't panic or assume you broke something permanently — you didn't.
2. Select and copy the red error text from the terminal.
3. Paste it to me (or to a developer) along with which numbered step you
   were on. That's usually enough to diagnose it in under a minute.

A few common ones, explained in plain language:

- **"Cannot connect to the Docker daemon"** — Docker Desktop isn't open.
  Open the Docker Desktop app and wait for the whale icon to settle.
- **"Port already in use"** — something else on your computer is already
  using that address. Usually means the app is already running from
  before — check if you have another terminal tab already running it.
- **Anything mentioning "ENOENT" or "command not found"** — usually means
  a step got run from the wrong folder. Check you ran `cd backend` /
  `cd ..` at the right points above.

---

## What you just did, in plain terms

You now have a real, working copy of the whole app running on your own
computer — the same backend code, database, and website that would run on
a live server. It's not connected to the internet or to real phone numbers
or payments yet (that's `SMS_PROVIDER=console` in your `.env` file, and the
mock payment provider — see `README.md`'s "Simplifications" section for
exactly what's real vs. stood-in-for). But the ride booking, matching,
tracking, ratings, and admin approval flow you just clicked through is
real and running end to end, not a mockup.

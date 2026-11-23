# School Competition Voting System: Requirements & Technical Specification

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 21 November 2026 |
| **Status** | Ready for build (3 non-blocking open items in §16) |
| **Usage** | One-time event, temporary hosting, torn down afterwards |
| **UI language** | **Arabic only, right-to-left (RTL). No English UI anywhere.** |

---

## 1. Overview

A web-based voting system for a school competition. Projects (websites, apps, and so on) are grouped into **sections** (categories such as "Best Website" or "Best App"), and each project belongs to one **school**. Voters choose up to **3 distinct projects in total, from any sections**, after entering their four-part Arabic name.

Voting happens through two channels:

1. **QR / phone:** a voter scans one QR code, opens the site on their own phone, and votes.
2. **Tablet (kiosk):** an operator walks around with a tablet and enters votes for people who are not comfortable with technology. The tablet **resets automatically** after every voter.

An admin dashboard manages all content, controls the voting window, and produces results.

---

## 2. Decisions Summary

| Area | Decision |
|---|---|
| Front end | Angular (standalone components, signals), RTL, Arabic only |
| Back end | **Cloudflare Pages Functions** (serverless API) |
| Database | **Cloudflare D1** (SQLite-compatible, shared by all devices) |
| Hosting | Cloudflare Pages, default `*.pages.dev` address |
| Vote limit | Max **3 votes in total**, any sections, **distinct projects only** |
| Minimum votes | At least **1** vote is required to submit *(assumption, see §15)* |
| Project structure | Each project belongs to **exactly one section** and **one school** |
| Voter's own school | Not asked, no restriction on voting for it |
| Name | **4 separate fields** (first, father, grandfather, family), **each at least 3 Arabic letters** |
| Duplicate names | **Warn, then allow**; flagged for admin review |
| Voting window | Scheduled start/end **plus manual override** by the admin |
| Results visibility | **Admin only** until the admin publishes them |
| Ties | **Admin picks the winner manually** |
| Admin auth | **One shared password**, enforced server-side |
| Kiosk access | **Requires admin login** on the tablet |
| Kiosk timing | Thank-you screen **5 seconds**, with a **Skip / Next voter button** |
| QR code | **One QR** for the whole site |
| Images | Admin can **upload a file or paste a URL** |
| Project link | "Visit project" link shown **only if the project has a URL** |
| Outputs | Dashboard, winners announcement screen, printable report, CSV export |
| Voter names | **Kept** in the dashboard and exports |
| Scale | About 100–500 voters, 30–100 projects |
| After the event | Delete the Pages project, API, and D1 database (see §14) |

> **Why Functions + D1?** SQLite inside the browser (sql.js) exists only on each device, so votes from phones would never reach the admin or the tablet. D1 gives the same SQL/SQLite experience, hosted once and shared by everyone, with no server to manage.

---

## 3. Roles and Access

| Role | How they enter | Can do |
|---|---|---|
| **Voter (phone)** | Scans QR, opens `/` | Browse projects, vote once per session |
| **Tablet operator** | Logs in as admin on the tablet, opens `/kiosk` | Enter votes for others; cannot see the dashboard from the kiosk screen |
| **Admin** | `/admin/login` with the shared password | Everything: content, schedule, results, exports, reset |

**Kiosk votes are trusted as `channel = tablet` only when the admin session cookie is present.** Phone votes are always recorded as `channel = qr`. A phone cannot claim to be a tablet.

---

## 4. Architecture

```
 Phone / Tablet / Admin browser
            │  (HTTPS)
            ▼
   Cloudflare Pages ── Angular static app (RTL, Arabic)
            │
            │  /api/*
            ▼
   Pages Functions (TypeScript, Hono router)
            │  D1 binding "DB"
            ▼
   Cloudflare D1 (SQLite)
```

### Recommended project layout

```
voting-app/
├─ src/                         # Angular app
│  ├─ app/
│  │  ├─ core/                  # api.service, auth.guard, voting-status.service
│  │  ├─ voter/                 # home, name-step, select-step, review-step, done
│  │  ├─ kiosk/                 # kiosk shell, inactivity service, kiosk-reset service
│  │  ├─ admin/                 # login, overview, sections, schools, projects,
│  │  │                         # voters, results, settings, qr, report
│  │  └─ winners/               # projector announcement screen
│  └─ styles.css                # RTL base, Arabic font (Cairo / Noto Kufi Arabic)
├─ functions/
│  └─ api/[[route]].ts          # single catch-all Hono app for all /api/* routes
├─ migrations/
│  └─ 0001_init.sql
├─ public/_routes.json          # send only /api/* to Functions
└─ wrangler.toml
```

### Configuration

- **D1 binding:** `DB`
- **Secrets (set with Wrangler, never committed):** `ADMIN_PASSWORD`, `SESSION_SECRET`
- **Time zone:** store timestamps in UTC. The admin enters schedule times in **Asia/Amman (UTC+3)** and the UI converts them.

`public/_routes.json`:

```json
{ "version": 1, "include": ["/api/*"], "exclude": [] }
```

`wrangler.toml` (essentials):

```toml
name = "school-voting"
pages_build_output_dir = "dist/voting-app/browser"
compatibility_date = "2026-11-01"

[[d1_databases]]
binding = "DB"
database_name = "school-voting"
database_id = "<filled in after `wrangler d1 create`>"
```

---

## 5. Data Model (D1 / SQLite)

`migrations/0001_init.sql`:

```sql
-- Images uploaded by the admin (compressed in the browser first)
CREATE TABLE images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mime       TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  data       BLOB NOT NULL,                       -- max ~300 KB enforced by the API
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key/value settings
-- keys: voting_mode ('auto' | 'open' | 'closed'), voting_start, voting_end (UTC ISO),
--       results_published ('0' | '1'), event_name
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE schools (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  logo_image_id INTEGER REFERENCES images(id)
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  image_id    INTEGER REFERENCES images(id),      -- uploaded image, OR
  image_url   TEXT,                               -- pasted image URL
  url         TEXT,                               -- optional project link (http/https only)
  section_id  INTEGER NOT NULL REFERENCES sections(id),
  school_id   INTEGER NOT NULL REFERENCES schools(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (id, section_id)                         -- enables the composite FK on votes
);
CREATE INDEX idx_projects_section ON projects(section_id);

CREATE TABLE voters (
  id               TEXT PRIMARY KEY,              -- UUID generated by the API
  request_id       TEXT NOT NULL UNIQUE,          -- client UUID: makes retries idempotent
  first_name       TEXT NOT NULL,
  father_name      TEXT NOT NULL,
  grandfather_name TEXT NOT NULL,
  family_name      TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,                 -- see §7.2
  channel          TEXT NOT NULL CHECK (channel IN ('qr','tablet')),
  is_duplicate     INTEGER NOT NULL DEFAULT 0,    -- voted after a duplicate warning
  voided           INTEGER NOT NULL DEFAULT 0,    -- admin cancelled this voter's votes
  void_reason      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_voters_normalized ON voters(normalized_name);

CREATE TABLE votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id   TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  UNIQUE (voter_id, project_id),                  -- no voting for the same project twice
  FOREIGN KEY (project_id, section_id) REFERENCES projects(id, section_id)  -- project must belong to that section
);
CREATE INDEX idx_votes_project ON votes(project_id);

-- Hard guarantee of "max 3 votes per voter", even if the API had a bug
CREATE TRIGGER trg_votes_max3
BEFORE INSERT ON votes
WHEN (SELECT COUNT(*) FROM votes WHERE voter_id = NEW.voter_id) >= 3
BEGIN
  SELECT RAISE(ABORT, 'MAX_3_VOTES');
END;

-- Manual tie-break / winner chosen by the admin
CREATE TABLE section_winners (
  section_id INTEGER PRIMARY KEY REFERENCES sections(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple brute-force protection for admin login
CREATE TABLE login_attempts (
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts ON login_attempts(ip, attempted_at);
```

**Atomic submission:** the API inserts the voter row and all vote rows in a single `DB.batch([...])` call, which D1 runs as one transaction. Either everything is saved or nothing is.

**Capacity check:** each voter produces at most 4 rows, so 500 voters means about 2,000 writes. That is far below the free-tier limits.

---

## 6. API

All responses are JSON. Errors use `{ "error": "CODE", "message": "..." }` with Arabic messages for display.

### 6.1 Public endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/public/ballot` | Active sections with their active projects (name, description, image, school, optional URL) and the current voting status |
| GET | `/api/public/status` | `{ state: 'not_started' \| 'open' \| 'closed', opensAt, closesAt }` |
| POST | `/api/votes` | Submit a phone vote (`channel = qr`) |
| GET | `/api/public/results` | Winners and ranking. Returns **403 `RESULTS_NOT_PUBLISHED`** until published |
| GET | `/api/images/:id` | Serves an uploaded image (cacheable) |

**`POST /api/votes` request**

```json
{
  "requestId": "6f1c0c0e-....",
  "name": {
    "first": "محمد",
    "father": "أحمد",
    "grandfather": "خالد",
    "family": "العبدالله"
  },
  "selections": [
    { "sectionId": 1, "projectId": 12 },
    { "sectionId": 3, "projectId": 27 }
  ],
  "confirmDuplicate": false
}
```

**Responses**

| Status | Code | Meaning |
|---|---|---|
| 201 | `OK` | Saved |
| 200 | `ALREADY_SAVED` | Same `requestId` was already processed (safe retry) |
| 409 | `DUPLICATE_NAME` | Same normalized name already voted. Client shows the warning and, if confirmed, resubmits with `confirmDuplicate: true` |
| 403 | `VOTING_CLOSED` / `VOTING_NOT_STARTED` | Outside the voting window |
| 422 | `VALIDATION_ERROR` | See §7 (includes which field failed) |

### 6.2 Kiosk endpoint (admin cookie required)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/kiosk/votes` | Same body and responses as `/api/votes`, recorded as `channel = tablet`. Returns 401 without a valid admin session |

### 6.3 Admin endpoints (admin cookie required)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/login` | Body `{ password }`. On success sets the session cookie |
| POST | `/api/admin/logout` | Clears the cookie |
| GET | `/api/admin/me` | Session check (used by route guards) |
| GET/POST/PUT/DELETE | `/api/admin/sections[/:id]` | Section CRUD (+ reorder) |
| GET/POST/PUT/DELETE | `/api/admin/schools[/:id]` | School CRUD |
| GET/POST/PUT/DELETE | `/api/admin/projects[/:id]` | Project CRUD |
| POST | `/api/admin/images` | Upload an image (`multipart/form-data`), returns `{ id }` |
| GET/PUT | `/api/admin/settings` | Read/update voting schedule, mode override, publish flag, event name |
| GET | `/api/admin/voters` | Voters list with channel, time, duplicate flag, voided flag |
| POST | `/api/admin/voters/:id/void` | Cancel a voter's votes (with reason). Excluded from results, kept in the log |
| POST | `/api/admin/voters/:id/restore` | Undo a void |
| GET | `/api/admin/results` | Per-section ranking, totals, tie flags |
| PUT | `/api/admin/winners/:sectionId` | Choose the winner of a section (used for ties) |
| GET | `/api/admin/export/results.csv` | Results export |
| GET | `/api/admin/export/voters.csv` | Voters + their picks export |
| POST | `/api/admin/reset` | Danger zone: delete votes only, or everything. Requires a typed confirmation |

### 6.4 Voting status logic (checked on every vote, server-side)

```
mode = settings.voting_mode
if mode == 'open'   → open
if mode == 'closed' → closed
if mode == 'auto'   → open only if voting_start <= now <= voting_end
                      (before start → not_started, after end → closed)
```

---

## 7. Voting Rules and Validation

### 7.1 Server-side checks (all enforced in the API, never only in Angular)

1. Voting is currently **open** (§6.4).
2. `selections` contains **1 to 3** items.
3. **No two selections share a project** (also enforced by `UNIQUE(voter_id, project_id)`). Multiple selections in the same section are allowed.
4. Every `projectId` exists, is **active**, and **belongs to the given `sectionId`** (also enforced by the composite FK).
5. Name parts pass §7.2.
6. `requestId` is a valid UUID. If it already exists, return `ALREADY_SAVED` and insert nothing.
7. Duplicate-name check (§7.3).

### 7.2 Name validation (four fields)

| Field | Arabic label | Rules |
|---|---|---|
| First name | الاسم الأول | Required |
| Father's name | اسم الأب | Required |
| Grandfather's name | اسم الجد | Required |
| Family name | اسم العائلة | Required |

For **each** field:
- Trim and collapse repeated spaces. Remove tatweel (ـ) and diacritics before counting.
- **Only Arabic letters** (U+0621–U+064A) and single inner spaces (to allow names such as "عبد الله").
- **At least 3 letters** (spaces not counted), maximum 30 characters.
- No digits, Latin letters, or symbols.

`full_name` = the four parts joined with a single space.

**Normalization for duplicate matching (`normalized_name`):**

```ts
export function normalizeArabic(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')                      // alef variants → ا
    .replace(/ى/g, 'ي')                           // ى → ي
    .replace(/ة/g, 'ه')                           // ة → ه
    .replace(/\s+/g, ' ')
    .trim();
}
// normalized_name = [first, father, grandfather, family].map(normalizeArabic).join(' ')
```

### 7.3 Duplicate names: warn, then allow

1. API looks for non-voided voters with the same `normalized_name`.
2. If found and `confirmDuplicate` is not `true` → respond **409 `DUPLICATE_NAME`**.
3. The client shows the warning (§12). If the person confirms, it resubmits with `confirmDuplicate: true`.
4. The new voter is saved with `is_duplicate = 1`. The vote **counts**.
5. The admin sees duplicate groups in the Voters page and can void any of them if they are clearly the same person voting twice.

On **phones** the voter sees the same warning with wording suited to a voter. On the **tablet** the warning is addressed to the operator. Both result in a flagged but counted vote.

### 7.4 Selection behavior in the UI

- Projects are browsed on one page with **filter tabs per section ("All" + each category with counts), search, and alphabetical sort**. Each card shows the category badge, team/school, a 2-line description, a **Details dialog** (full description, school, "Visit project" link when a URL exists), and a **Vote / Selected toggle button**.
- Tapping the vote button selects a project; tapping it again **deselects** it and frees a vote slot.
- A live counter shows "الأصوات المستخدمة: N من 3" with three dot indicators, in the header and on the ballot page.
- When 3 projects are selected, the other cards' vote buttons are **disabled** with a message telling the voter to remove one of the 3 selections to change a vote.
- The **Review & Submit drawer** lists the selected projects with a remove button per vote and the warning that votes cannot be changed after sending; "رجوع للتعديل" returns to the ballot.
- The Submit/Continue button is disabled until at least 1 project is selected.
- The submit button is disabled while the request is in flight (prevents double taps). A retry after a network failure reuses the same `requestId`.

---

## 8. Voter Experience

### 8.1 Phone flow (QR channel)

```
Scan QR → Home (browse sections & cards, read-only, sticky "ابدأ التصويت" button)
        → Name (4 fields)
        → Select (cards, max 1 per section, max 3 total)
        → Review → Submit
        → Thank you
```

- The **home page is split into sections** (Best Website, Best App, and so on), each with its project cards. This satisfies the original home-page requirement.
- If voting is closed or not started, the home page stays browsable but the start button is replaced by the status message.
- After submission, the thank-you screen offers a **"تصويت شخص آخر"** button that resets the form (name, selections, request ID) so another person can vote on the same phone. As a **soft deterrent only** (not security), the app remembers on that phone that a vote was submitted and shows "تم التصويت من هذا الجهاز" on revisits.

### 8.2 Card content

Each project card shows:
- **Image** (uploaded or URL, with a neutral placeholder if missing or broken)
- **Project name**
- **Description**
- **School name** (and logo if set)
- **"زيارة المشروع" link**, opens in a new tab, **only when the project has a URL**
- Selected state (clear highlight and check mark)

---

## 9. Kiosk (Tablet) Mode

**Route:** `/kiosk`, guarded by the admin session. If the session is missing or expires, the tablet shows the admin login and returns to `/kiosk` after login.

### 9.1 Flow

```
Welcome (big "ابدأ التصويت")
  → Name (4 fields) → Select → Review → Submit
  → Thank you (5 seconds, with "المصوّت التالي" button)
  → Welcome   ← automatic reset
```

### 9.2 Timing (decided)

| Event | Behavior |
|---|---|
| Thank-you screen | Shows for **5 seconds** with a visible countdown, then resets automatically |
| **Skip button** | **"المصوّت التالي"** on the thank-you screen resets immediately so the operator does not have to wait |
| Inactivity | **60 seconds** without any touch/keyboard activity resets the session |
| Inactivity warning | At **50 seconds**, an overlay "هل ما زلت هنا؟" with a 10-second countdown and a **"نعم، أنا هنا"** button |
| Manual reset | A **"ابدأ من جديد"** button is always visible. If the voter already entered data, it asks for confirmation first |

### 9.3 Reset procedure (must clear everything so the next voter never sees the previous one's data)

A single `KioskResetService.reset()` is called by all four triggers above and does the following:

1. Destroys and recreates the voting form (all four name fields empty).
2. Clears the selections, the counter, and any error/duplicate-warning state.
3. Generates a **new `requestId`** for the next voter.
4. Cancels all pending timers (thank-you countdown, inactivity, warning).
5. Navigates to the Welcome screen and scrolls to the top.
6. Does **not** store voter data in `localStorage`/`sessionStorage`. Inputs use `autocomplete="off"` so the keyboard does not suggest the previous person's name.

### 9.4 Kiosk UI requirements

- Large touch targets (at least 56 px high) and large fonts (at least 18 px body).
- Arabic on-screen keyboard supported (the tablet's own keyboard, input `lang="ar"`).
- The admin dashboard link is **not shown** anywhere in kiosk screens.
- Works with **multiple tablets** at once, since each one logs in with the admin password. Every vote still goes through the same API.
- Recommended: set the tablet to full screen (install as PWA / "Add to Home Screen") with screen auto-lock turned off.

---

## 10. Admin Dashboard (`/admin`)

| Page | Contents |
|---|---|
| **Overview** | Voting state (open/closed/scheduled), total voters, votes per channel (phone/tablet), results-published flag |
| **Sections** | Add, edit, reorder, hide. Cannot delete a section that has projects |
| **Schools** | Add, edit (name, optional logo). Cannot delete a school that has projects |
| **Projects** | Add/edit: name, description, **section**, **school**, image (upload or URL), optional URL, order, active flag |
| **Voters** | Searchable table: name, channel, time, duplicate flag, voided flag. Group view by normalized name. Void/restore with reason |
| **Results** | Per-section ranking with vote counts and totals. **Tie flag** and winner picker. "Publish results" toggle |
| **Settings** | Event name, voting start/end (Asia/Amman), mode: **Auto / Force open / Force closed** |
| **QR code** | Generates the QR for the site URL (client-side), with PNG/SVG download and a print-friendly page |
| **Reports** | Printable report (browser Print → Save as PDF), CSV downloads, link to the winners screen |
| **Danger zone** | Reset votes only / reset everything, each needing a typed confirmation word |

### Content-editing safeguards

- Once the **first vote exists**, deleting sections/projects and changing a project's section are **blocked**. Text edits, images, and the active/hidden flag remain allowed. This protects vote integrity.
- Project URLs must start with `http://` or `https://`.
- Image upload: PNG/JPEG/WebP, **resized and compressed in the browser** (max 1200 px wide, target at most 200 KB). The API rejects anything over 300 KB.

---

## 11. Results, Ties, and Announcement

### 11.1 Counting
- A project's total = number of votes from **non-voided** voters.
- Each section is ranked by votes (highest first).

### 11.2 Ties
- A section is flagged **"تعادل"** when the highest count is shared by two or more projects (and the count is above 0).
- The admin picks the winner in the Results page (stored in `section_winners`).
- **Publishing is blocked with a warning** while any section has an unresolved tie.

### 11.3 Publishing
- `results_published = 0`: only the admin sees results. `/api/public/results` returns 403.
- `results_published = 1`: the public results page and the **winners screen** are available.
- The public results show each section's winner and the ranked list with vote counts *(assumption, see §15)*.

### 11.4 Winners announcement screen (`/winners`)
- Full-screen, projector-friendly layout in Arabic RTL.
- Shows one section at a time with winner card(s): image, name, school, vote count. Next/Previous controls (and arrow keys) let the presenter reveal sections one by one.
- The admin can open it at any time as a preview. Everyone else can open it only after results are published.

### 11.5 Exports
- **CSV** files are UTF-8 **with BOM** so Arabic text opens correctly in Excel.
- `results.csv`: section, project, school, votes, rank, winner flag.
- `voters.csv`: full name (four parts), channel, time, duplicate flag, voided flag, and the chosen project per section.
- **Printable report:** a dedicated print stylesheet with the event name, date, per-section tables, and winners.

---

## 12. Arabic Interface Text (RTL)

The whole UI is Arabic. Numbers use Western digits (0–9). Suggested copy (final wording can be adjusted):

| Where | Text |
|---|---|
| Home title | منافسة المشاريع المدرسية: التصويت |
| Start button | ابدأ التصويت |
| Name step title | أدخل اسمك الرباعي |
| Name fields | الاسم الأول · اسم الأب · اسم الجد · اسم العائلة |
| Name error | يجب أن يتكوّن كل اسم من 3 أحرف عربية على الأقل |
| Selection hint | اختر حتى 3 مشاريع من أي فئة |
| Counter | الأصوات المستخدمة: {n} من 3 |
| Max reached | وصلت إلى الحد الأقصى (3 أصوات). ألغِ اختياراً لتتمكن من تغييره |
| Minimum | اختر مشروعاً واحداً على الأقل |
| Review title | مراجعة اختياراتك |
| Review warning | بعد الإرسال لا يمكن تعديل الأصوات |
| Buttons | تأكيد وإرسال · رجوع للتعديل |
| Thank you | شكراً لمشاركتك! تم تسجيل صوتك |
| Kiosk countdown | سيتم الانتقال للمصوّت التالي خلال {n} ثوانٍ |
| Kiosk skip button | المصوّت التالي |
| Duplicate (voter) | هذا الاسم سبق أن صوّت. إذا كنت شخصاً مختلفاً بنفس الاسم يمكنك المتابعة |
| Duplicate (operator) | تنبيه: هذا الاسم سبق أن صوّت. إذا كان شخصاً مختلفاً بنفس الاسم يمكنك المتابعة |
| Duplicate buttons | متابعة التصويت · تعديل الاسم |
| Inactivity | هل ما زلت هنا؟ ستتم إعادة الضبط خلال {n} ثانية |
| Inactivity button | نعم، أنا هنا |
| Start over | ابدأ من جديد |
| Start over confirm | سيتم مسح الاسم والاختيارات. هل أنت متأكد؟ (نعم / لا) |
| Visit link | زيارة المشروع |
| Voting closed | التصويت مغلق حالياً |
| Not started | لم يبدأ التصويت بعد. يبدأ في {time} |
| Already voted (device) | تم التصويت من هذا الجهاز |
| Network error | تعذّر الإرسال، حاول مرة أخرى |
| Tie label | تعادل: يرجى اختيار الفائز |

**RTL implementation notes:** `<html lang="ar" dir="rtl">`, CSS logical properties (`margin-inline-start`, `padding-inline-end`, and so on), mirrored icons (arrows, back/next), and Arabic-friendly fonts (Cairo or Noto Kufi Arabic). Dates and times are shown in Arabic wording with Asia/Amman time.

---

## 13. Security and Abuse Protection

| Topic | Approach |
|---|---|
| **Admin password** | Stored only as the secret `ADMIN_PASSWORD`. Compared in constant time. Never in the Angular bundle |
| **Session** | On login the Function issues an **HMAC-signed token** (signed with `SESSION_SECRET`, 12-hour expiry) in a cookie with `HttpOnly; Secure; SameSite=Strict`. Every `/api/admin/*` and `/api/kiosk/*` request verifies it |
| **Route guards** | Angular guards improve the UX only. **The real protection is in the API** |
| **Login brute force** | Max 5 failed attempts per IP per 10 minutes (via `login_attempts`), then HTTP 429 |
| **Vote flooding** | Vote endpoints get a generous rate limit (for example 30 per minute per IP, via a Cloudflare rate-limiting rule or in code). **Caution:** many phones may share one venue Wi-Fi IP, so do not set it too low |
| **Idempotency** | `requestId` stops double submissions from flaky networks |
| **Identity** | Name-only voting is weak identity by design. It is accepted, and mitigated by duplicate warnings, flags, and admin void |
| **Input safety** | Parameterized SQL only (`prepare().bind()`); Angular's default output escaping; project URLs restricted to http/https; uploads limited by type and size |
| **Privacy** | Real names are stored, so the dashboard and exports are admin-only. Teardown (§14) removes them |
| **Transport** | HTTPS by default on `*.pages.dev` |

---

## 14. Deployment, Operations, and Teardown

### 14.1 First-time setup (commands)

```bash
# 1. Create the database
npx wrangler d1 create school-voting
#    → copy the database_id into wrangler.toml

# 2. Apply the schema
npx wrangler d1 migrations apply school-voting --remote

# 3. Create the Pages project and set secrets
npx wrangler pages project create school-voting
npx wrangler pages secret put ADMIN_PASSWORD  --project-name school-voting
npx wrangler pages secret put SESSION_SECRET  --project-name school-voting   # long random string

# 4. Build and deploy
ng build
npx wrangler pages deploy dist/voting-app/browser --project-name school-voting
```

Local development: `npx wrangler pages dev dist/voting-app/browser --d1 DB=school-voting` (use `--local` migrations for a local DB).

### 14.2 Before the event
- Enter schools, sections, and projects. Check every image and link.
- Set the voting schedule (or leave the mode on **Force closed** until the start).
- Print the QR code from the dashboard and test it with at least two phones.
- Log in on each tablet and run through a full test vote, then **void/reset the test data** using the danger zone.

### 14.3 During the event
- Keep mode on **Auto**, and use **Force closed** as an emergency stop.
- Monitor the Overview page (votes per channel) and the Voters page (duplicate flags).

### 14.4 After the event: teardown checklist

> **Important:** deleting the Pages project does **not** delete the D1 database. They are separate resources, and the voters' real names stay in D1 until it is deleted too.

- [ ] Resolve all ties, then **publish** results and run the winners screen
- [ ] Download `results.csv`, `voters.csv`, and the printed/PDF report (**before** deleting anything)
- [ ] Delete the **Pages project** (this also removes the Functions and its secrets)
- [ ] Delete the **D1 database**: `npx wrangler d1 delete school-voting`
- [ ] Confirm in the Cloudflare dashboard that no Pages project, D1 database, or R2 bucket remains for this event
- [ ] Store the exported files securely (they contain real names), or delete them per school policy

---

## 15. Assumptions Made (change any of these if needed)

| # | Assumption |
|---|---|
| 1 | A voter must pick **at least 1** project (a zero-vote submission is not allowed) |
| 2 | On phones, the **duplicate-name warning is also shown to the voter** (they can continue). The vote is flagged either way |
| 3 | Names accept **Arabic letters only** (no Latin letters or digits), 3 to 30 characters per part |
| 4 | The **public results page shows vote counts** and not just the winners, once published |
| 5 | Images are stored **in D1** (compressed, up to ~300 KB each), so **no R2 bucket is needed** |
| 6 | After the first vote, **structural deletes are blocked** (hide instead of delete) |
| 7 | Home page on phones is **browsable before the name step**. The kiosk home is a simple welcome screen |
| 8 | Numbers are shown with **Western digits (0–9)** |

---

## 16. Open Items (non-blocking)

1. **Event name, logo, and colors** for the header, QR print page, and winners screen.
2. **Voting dates and times** (start and end), to be entered in Settings at setup.
3. **Number of tablets** planned. The design supports any number, and this only matters for event logistics.

---

## 17. Acceptance Criteria (test checklist)

- [ ] Home page shows sections, each with cards (image, name, description, school); "Visit project" appears only when a URL exists
- [ ] Name step rejects empty fields, fewer than 3 letters, Latin letters, and digits
- [ ] A voter cannot choose the same project twice or more than 3 projects in total, in the UI **and** when calling the API directly (tested with a hand-crafted request); two votes in the **same section are accepted**
- [ ] A voter cannot submit with 0 selections
- [ ] A voter cannot vote for a project that does not belong to the given section or is inactive
- [ ] Voting is rejected before the start, after the end, and when forced closed. It is accepted when forced open
- [ ] A repeated name (with أ/ا or ة/ه differences) triggers the warning, and the confirmed vote is flagged and counted
- [ ] A double tap or retried request creates **one** voter and one set of votes
- [ ] A failed insert (for example a forced error on the 3rd vote row) leaves **no** partial data
- [ ] Kiosk: thank-you shows 5 s then resets. The skip button resets immediately. 60 s idle resets (with 50 s warning). "Start over" resets with confirmation
- [ ] After any kiosk reset, the next voter sees empty fields, no selections, and no previous name suggestions
- [ ] `/kiosk` and `/api/kiosk/*` are inaccessible without the admin session. A phone request cannot be recorded as `tablet`
- [ ] `/api/admin/*` returns 401 without a valid session. Login is rate-limited
- [ ] Results are invisible to the public until published. Publishing is blocked while a tie is unresolved
- [ ] CSV files open correctly in Excel with Arabic text. The printable report renders correctly in RTL
- [ ] The whole UI is Arabic RTL, with no English text visible to voters or admins
- [ ] Load test: 100 simulated concurrent submissions produce exactly the expected vote totals

---

## 18. Suggested Build Order

| Step | Deliverable |
|---|---|
| 1 | Scaffold Angular + Pages Functions + D1 migration + admin login/session |
| 2 | Admin CRUD: sections, schools, projects, image upload, settings |
| 3 | Voting API (validation, normalization, duplicate warning, atomic batch) |
| 4 | Voter UI (home, name, select, review, thank-you) with RTL styling |
| 5 | Kiosk mode (guard, 5 s reset + skip, inactivity, reset service) |
| 6 | Results, ties, publishing, winners screen, CSV and printable report, QR page |
| 7 | Acceptance testing, test-data cleanup, deploy, teardown at the end of the event |

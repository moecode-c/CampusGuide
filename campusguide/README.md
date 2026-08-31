# CampusGuide

A student platform built with Next.js: GPA tools, attendance tracking, a weekly
schedule calendar, a Cloudflare-backed file drive, videos, an FAQ, and an
interactive campus map — with an admin side for verifying MIU students,
managing accounts, and watching site activity.

## Admin

| Page | What it does |
| --- | --- |
| `/admin` | Daily/weekly/monthly active users, signup trend, recent activity |
| `/admin/verification` | Approve or reject students who sent their ID photo |
| `/admin/users` | Search every account; inspect data, ban, unban, delete |
| `/admin/resources` | The file drive — folders, uploads, links |
| `/admin/rooms` | Room codes and map coordinates |

Ban, delete, account inspection and per-account logs are available from both the
verification and users pages.

## Requirements

- Node.js 20.6+ (the test runner uses `node:test` via `tsx`)
- A MongoDB instance (local or Atlas)

## Setup

Create `.env.local` in this directory — the app throws at runtime without it:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/campusguide
NEXTAUTH_SECRET=<a random string of at least 20 characters>
NEXTAUTH_URL=http://localhost:3000
```

`NEXTAUTH_URL` must match the origin you actually browse to — sign-in redirects
are built from it, so a mismatched port sends you to a dead address after login.

### Student verification

Registration is restricted to MIU students. A student ID looks like `2024/15832`
and the university email must embed the last two digits of the year plus the
serial (`ahmed2415832@miuegypt.edu.eg`) — the two are cross-checked, so a
mismatched pair cannot register. Sign-in accepts either the ID or the email.

New accounts start as **pending**: they can hold a session but every student API
and page redirects them to `/pending`, which tells them to send a photo of their
ID card on WhatsApp. Approve or reject them at `/admin/verification`.

```bash
VERIFY_WHATSAPP_NUMBER=+201012345678
```

Without it, the pending screen renders but shows no number to contact.

Account status is read from the database on every guarded request (cached for
30 seconds), so a ban takes effect on the banned user's next click rather than
when their token expires. Admin actions clear that cache immediately.

### File storage (Cloudflare R2)

The resources section is a file drive. Uploads go straight from the browser to a
Cloudflare R2 bucket, and deleting or replacing a resource in the admin UI
deletes the object from R2 as well. Add to `.env.local`:

```bash
R2_ACCOUNT_ID=<Cloudflare account id>
R2_ACCESS_KEY_ID=<R2 API token access key id>
R2_SECRET_ACCESS_KEY=<R2 API token secret>
R2_BUCKET=<bucket name>
R2_PUBLIC_BASE_URL=https://files.example.com
```

Without these the app still runs — folders and links keep working and the admin
page shows a banner — but uploads are refused with a 503.

### Analytics

**Vercel Web Analytics** (`@vercel/analytics`) loads from the root layout
(`src/components/Analytics.tsx`). Enable it once in the Vercel project under
Analytics → Enable. After the next deploy, page views show in that dashboard.
No env var is required.

In the Cloudflare dashboard:

1. **R2 → Create bucket.**
2. **Manage R2 API Tokens → Create token** with *Object Read & Write* on that
   bucket. The access key id and secret go in the two variables above.
3. **Bucket → Settings → Public access.** Enable the `r2.dev` subdomain or
   connect a custom domain, and put that origin in `R2_PUBLIC_BASE_URL`.
   Anything in this bucket is then readable by anyone holding the link.
4. **Bucket → Settings → CORS policy.** The browser uploads directly, so the
   bucket must allow `PUT` from your app's origin:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app-domain"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Object keys are `resources/<uuid>/<file name>` and are unrelated to the folder
tree, which lives only in MongoDB — so renaming or moving a folder never touches
R2. The upload cap is 200 MB per file (`MAX_UPLOAD_BYTES` in
`src/server/storage/r2.ts`).

Then:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Seeding

```bash
npm run seed
```

Runs everything in `seeders/`. Today that is the default admin accounts
(`admin@campusguide.local` and `superadmin@campusguide.local`, password
`Admin@12345` unless `SEED_ADMIN_PASSWORD` is set). It is idempotent — re-running
it just resets those accounts. Pass a name to run one seeder: `npm run seed admins`.

Set `SEED_ADMIN_PASSWORD` before running this against anything but a local
database; the default password is public knowledge.

For a single custom admin:

```bash
npm run create:admin -- --email you@example.com --password 'YourPass123'
```

Either way the account unlocks `/admin` for managing rooms and resources.
`npm run seed:rooms` loads a starter room list — note that it overwrites the x/y
coordinates of any room whose code it already knows.

## Tests

Unit tests cover the pure logic (recurrence expansion, GPA scales, URL and time
normalization, storage key sanitization and size formatting) and need nothing
running — no database, no Cloudflare credentials:

```bash
npm test
```

The API tests drive a real server against a real database. Start a **fresh**
server first — the suites deliberately spend the registration rate-limit budget
down to its last request, and that limiter lives in process memory:

```bash
npm run build && ACCOUNT_STATE_TTL_MS=1000 npx next start -p 3102
```

```bash
BASE_URL=http://localhost:3102 ACCOUNT_STATE_TTL_MS=1000 npm run test:api
```

`ACCOUNT_STATE_TTL_MS` shortens the account-status cache. One test approves an
account by writing to the database directly — which, unlike a real approval
through the admin API, doesn't clear that cache — so it has to wait the window
out. Leave the variable unset and the suite still passes, just 30 seconds slower.

They create a throwaway student and admin account, exercise the routes, and
delete everything they created on the way out.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (no server needed) |
| `npm run test:api` | End-to-end API tests (needs a running server) |
| `npm run seed` | Run every seeder in `seeders/` (default admin accounts) |
| `npm run create:admin` | Create or update an admin account |
| `npm run seed:rooms` | Seed campus rooms |

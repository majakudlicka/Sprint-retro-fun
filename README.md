# Sprint retro fun

A self-hosted sprint retrospective. Teams sign in with Google, run a facilitator-led retro, and keep action items for the next one.

The board moves through **Write → Group → Vote → Discuss → Actions → Closed**. During Write, other people's notes are withheld by the server (not just hidden in CSS). After that, drag notes together, spend a vote budget, discuss in vote order, and record actions. Open actions from earlier retros on the same team are shown at the top of the next one.

Anonymous mode stores the author and never sends that name to anyone else.

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + TypeScript, served by `@sveltejs/adapter-node`
- Postgres and [Drizzle ORM](https://orm.drizzle.team)
- [Auth.js](https://authjs.dev) (`@auth/sveltekit`) with Google, JWT sessions in **httpOnly** cookies
- WebSockets (`ws`) on the same Node server as the SvelteKit handler
- Zod for every command and form payload that changes data

SvelteKit 3 is out, but `@auth/sveltekit` 1.11 still declares support for Kit 2 only, so this app stays on Kit 2 and `adapter-node` 5.

Live updates use an in-memory fan-out. Run **one app instance** (or accept that people on different instances will not see each other's updates until refresh). A shared store such as Redis is the scale-up path, and it is not in this MVP.

## Local setup

You need Node.js 22+, and Postgres. Docker is the usual way to get Postgres:

```bash
docker compose up -d
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL. The compose file uses `postgres://retro:retro@localhost:5432/retro`. |
| `AUTH_SECRET` | Random string, at least 32 characters. `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `ORIGIN` | Public site origin, no trailing slash. Locally `http://localhost:5173`. |
| `AUTH_URL` | Same origin as `ORIGIN`. Auth.js uses it for callback URLs. |
| `AUTH_TRUST_HOST` | `true` when the app sits behind a reverse proxy. |
| `ALLOWED_EMAIL_DOMAIN` | Optional. Example: `example.com`. Only verified Google accounts on that domain can sign in. The `hd` hint is also sent to Google's account chooser. The server still checks the verified email domain, because the hint can be removed. |
| `DEV_LOGIN_SECRET` | Optional, **development only**. See below. Leave it unset in production. |
| `MIGRATE_ON_START` | Set to `true` to run SQL migrations before the server listens. Use on a single instance. |
| `PORT` | Defaults to `3000` for `npm start`. Vite dev uses `5173`. |

### Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → OAuth consent screen. Create an app (Internal if you are restricting a Workspace domain).
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized JavaScript origins: `http://localhost:5173` and your production origin.
4. Authorized redirect URI: `http://localhost:5173/auth/callback/google` and `https://YOUR_DOMAIN/auth/callback/google`.
5. Copy the client id and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

### Run it

```bash
npm install
npm run db:migrate
npm run dev
```

Open <http://localhost:5173>. Sign in with Google. Create a team, invite people with a link or by email, and start a retro.

`npm run dev` attaches WebSockets to the Vite server. Production uses a small custom server so the HTTP app and the sockets share a process:

```bash
npm run build
npm start
```

`npm start` listens on `PORT` (default 3000) and `HOST` (default `0.0.0.0`). If a variable is not already set in the environment, the process fills it from a `.env` file in the working directory. On a hosted deploy, set the variables in the platform and do not ship a `.env` file.

### Optional local sign-in

Google's consent screen can take a while to approve. For localhost UI work only:

1. Set `DEV_LOGIN_SECRET` in `.env`.
2. Run `npm run dev` (not `npm start`).
3. Open <http://localhost:5173/dev/login> and submit the secret, a name, and an email.

The route is compiled out of the development check in production builds (`vite dev` only), and it also requires `NODE_ENV !== 'production'` and a localhost hostname. Do not set the secret in production.

### Tests

```bash
npm test
```

The tests cover team/facilitator authorization, the per-person vote budget (including stacking votes on one item), discussion sort order, write-phase and anonymous redaction, Zod validation, origin checks, and rate limiting. They do not need Postgres.

`npm run check` runs `svelte-check`.

## How a retro works

1. Any team member can create a retro and becomes its facilitator.
2. **Write.** Add notes to the columns of the chosen format (Start/Stop/Continue, Mad/Sad/Glad, 4Ls, or Went well / To improve / Action ideas). The API returns your own notes and, for everyone else, a placeholder with no text and no author.
3. **Group.** Drag a note onto another, or use "Group with". Groups can be named. A group of one is dissolved.
4. **Vote.** Each person has 3, 4, or 5 votes, chosen when the retro is created. Several votes can go on one note or group. The limit is enforced in a database transaction with an advisory lock. Grouped notes are voted on as one group.
5. **Discuss.** Notes and groups are ordered by vote count, highest first. Ties break toward the earlier item.
6. **Actions.** Text, optional owner (a teammate), optional due date, optional link to a note or group.
7. **Closed.** The board is read-only. Action items can still be checked off.

Open actions from earlier retros on the team stay visible until someone marks them done, including at the start of the next retro.

Invite links last 14 days and can be used more than once until they are revoked. Adding an email joins the account immediately if it already exists, or the next time that person signs in with Google.

## Security

- Every page, form action, JSON command, and socket subscribe checks the session. Retro and team data also checks team membership. Changing the phase is facilitator-only. Missing access is a 404.
- Auth.js session cookies are httpOnly and `SameSite=Lax`. They are `Secure` when the site is HTTPS.
- SvelteKit checks the `Origin` header on form posts. JSON commands and the WebSocket upgrade do the same, and they also accept `ORIGIN` when a proxy's internal host differs from the public origin.
- Redirect targets after sign-in stay on this site.
- Inputs are parsed with Zod. Note text is rendered as text, never as HTML (`{@html` is not used).
- Writes are rate-limited per user, in memory, on that process.
- Secrets come from environment variables. `.env` is gitignored. `.env.example` has empty secrets.
- `ALLOWED_EMAIL_DOMAIN` requires a verified email on that domain. A mismatched Google `hd` claim is rejected too.

## Deployment

Build a container with the `Dockerfile`, or run `npm run build` and `node build/retro-server.js` on a host that supports WebSockets. Set the environment variables from `.env.example`. Run migrations once before traffic:

```bash
npm run db:migrate
```

or set `MIGRATE_ON_START=true` on a single instance.

Set `ORIGIN` and `AUTH_URL` to the public `https://` origin. The Google redirect URI must be `https://YOUR_DOMAIN/auth/callback/google`.

Behind a proxy, forward `X-Forwarded-Proto` and `X-Forwarded-Host`, and set:

```bash
ORIGIN=https://YOUR_DOMAIN
AUTH_URL=https://YOUR_DOMAIN
AUTH_TRUST_HOST=true
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

Keep a single app instance so the in-memory WebSocket fan-out reaches everyone in the retro.

### Fly.io

Fly supports WebSockets. `fly launch`, set `[http_service] internal_port = 3000`, and keep `min_machines_running = 1` with a single machine for this MVP. Put `DATABASE_URL` and the Auth.js variables in `fly secrets`.

### Render

Use a Web Service (not a static site) with start command `node build/retro-server.js`. Render proxies WebSockets. Pin the service to one instance.

### Cloud Run

WebSockets work with session affinity, `--timeout=3600`, and minimum instances of 1, but Cloud Run will still freeze CPU between requests on some configurations and drop sockets. Prefer Fly.io or Render for this app. If you use Cloud Run, set CPU to be always allocated and run one instance.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server and WebSockets |
| `npm run build` | SvelteKit build plus the Node server bundle |
| `npm start` | Production server |
| `npm test` | Unit tests |
| `npm run check` | Type check |
| `npm run db:generate` | Create a Drizzle migration from the schema |
| `npm run db:migrate` | Apply migrations |

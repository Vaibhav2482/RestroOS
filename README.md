# RestroOS

A multi-tenant restaurant ordering and POS platform. One shared API backs three independently deployed frontends:

| App | Path | Audience |
|---|---|---|
| **server** | `server/` | Express + Postgres API, all business logic |
| **storefront** | `storefront/` | Customer-facing ordering (dine-in/delivery, per-tenant branded) |
| **tenant-admin** | `tenant-admin/` | Restaurant staff/owner console — POS, menu, orders, inventory, reports |
| **platform-admin** | `platform-admin/` | Operator console for onboarding/managing restaurant tenants |

Each app is its own `npm` project with its own `package.json`, deployed as its own Vercel project.

## Prerequisites

- Node.js 22+
- A Postgres database (local, or a hosted one like [Neon](https://neon.tech) — free tier works)

## First-time setup

1. **Database.** Create an empty Postgres database, then run the 5 baseline schema files in `database/` **in this order** (there's no single provisioning command yet — see `docs/` for the roadmap item to fix that):

   ```
   psql <connection-string> -f database/schema.sql
   psql <connection-string> -f database/schema-core.sql
   psql <connection-string> -f database/schema-ordering.sql
   psql <connection-string> -f database/schema-menu-options.sql
   psql <connection-string> -f database/schema-coupons.sql
   ```

2. **Server.**

   ```
   cd server
   cp .env.example .env      # fill in DATABASE_URL at minimum; everything else is optional
   npm install
   npm run migrate           # applies every migration since the baseline schema (server/src/config/migrations.js)
   npm run dev                # http://localhost:5100
   ```

   Every optional integration (Cloudinary, Razorpay, Pusher, Resend, Twilio, Sentry) is genuinely optional — the app runs and serves core functionality with any or all of them unconfigured. `.env.example` explains what each one unlocks.

3. **First platform admin.** With the server running, bootstrap the one account that can create tenants (works exactly once — refuses after the first platform admin exists):

   ```
   curl -X POST http://localhost:5100/api/v1/platform-admin/auth/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"fullName":"Your Name","email":"you@example.com","password":"at-least-8-chars"}'
   ```

4. **Frontends.** For each of `storefront/`, `tenant-admin/`, `platform-admin/`:

   ```
   cd <app>
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Onboard your first restaurant tenant through platform-admin (`/tenants` → "Onboard Restaurant") — that's the only way tenants get created; there's no self-service signup, by design.

## Testing

```
cd server && npm test          # vitest — unit + repository + controller tests
cd storefront && npm test      # vitest + React Testing Library
cd tenant-admin && npm test
cd platform-admin && npm run build   # no test suite yet for this app
```

CI (`.github/workflows/ci.yml`) runs `npm audit --audit-level=high`, tests, and builds on every push/PR to `master`. It does not deploy — deploys are a separate, manual step (see below).

## Deployment

All 4 apps are separate Vercel projects. There's no CI-gated deploy yet (see `docs/RestroOS-Remediation-Roadmap.pdf` and the production-readiness audit for why that's flagged), so a deploy today is:

```
cd <app>
vercel --prod
```

`server`'s migrations run automatically on the next cold start after a deploy (advisory-lock-guarded, safe under concurrent instances — see the comment in `server/src/config/migrate.js`). There's no down-migration mechanism; a bad migration is fixed by shipping a new forward migration, not a rollback.

## Repository layout notes

- No ORM — raw parameterized SQL via `pg`, Controller → Service → Repository layering throughout `server/src/`.
- Schema-as-code: `server/src/config/migrations.js` is the source of truth for everything past the baseline `database/*.sql` snapshot.
- Three frontends share no package/workspace tooling (no monorepo) — a handful of small files (`axiosClient.js`, `pusherClient.js`) are intentionally near-duplicated across apps rather than extracted prematurely.

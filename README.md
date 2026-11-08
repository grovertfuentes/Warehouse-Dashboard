# The Event Rental Guys — Warehouse Dashboard

Private warehouse calendar built with Next.js and deployed from this GitHub repository to Vercel.

## Features

- Monday–Sunday calendar with two expandable weeks ahead.
- Daily and weekly delivery, pickup, and will-call totals. Will calls count customer pickups only; customer returns are excluded.
- Exact-day, exact-time, and short-window movements shown in red and sorted first.
- Full client names, venues, addresses, calendar descriptions, and automatic Google Maps in event details.
- Inventory needed over the next seven days.
- Hourly refresh, manual refresh, and fallback to the last successfully saved schedule.

## Vercel deployment

Import this repository, use the Next.js framework preset, Node.js 22.x, `npm ci`, and `npm run build`. Keep the default `.next` output. The connected `main` branch deploys automatically.

The Vercel project is `warehouse-dashboard` in the `dance-floors-guys` team.

### Access

The production dashboard uses a shared warehouse password and encrypted, HttpOnly, Secure cookies. Set `WAREHOUSE_PASSWORD_HASH` (salt:scrypt hash) and a random `WAREHOUSE_SESSION_SECRET` in Vercel environment variables. Never put the password or either value in GitHub. Missing configuration denies access.

“Remember this warehouse TV” keeps a device signed in for 30 days since its latest renewal, including across restarts. The open dashboard renews every 15 minutes, on returning to the page, and on calendar refresh. The password is never stored in the browser. Signing out clears this browser’s cookie. Changing the password hash or session secret invalidates existing sessions after deployment.

Login attempts are limited using conditional writes to private Blob storage: five per client per 15 minutes and 20 total per hour, including successful sign-ins. Already signed-in devices continue refreshing during a login cooldown. IP addresses are keyed with HMAC and are not stored directly. Cross-origin login, logout, and renewal requests are rejected.

Use **Standard Protection** (`prod_deployment_urls_and_all_previews`) for Vercel Authentication. Production domains show the application password screen; preview and deployment-specific URLs retain Vercel protection. Keep this protection on older deployments that predate application authentication. Never roll production back to an older, account-auth-only build without restoring Vercel Authentication for all domains first.

### Private calendar storage

Connect a **private** Vercel Blob store to the project. Vercel provisions `BLOB_READ_WRITE_TOKEN` or the OIDC store binding automatically. The connection and cached calendar are stored together in one private JSON document. Conditional writes prevent an older refresh from overwriting a newer connection. Production and preview use separate storage paths.

Open the protected dashboard, choose **Connect calendar**, and enter the Google Calendar **Secret address in iCal format** for **Contract Signed - GSPro**. This is shared by authorized viewers of this warehouse dashboard. The URL stays server-side and is never returned by the calendar API.

Calendar connections and event data are not stored in GitHub and must be connected once on the Vercel deployment. Preview deployments have their own connection state.

## Local development

Use Node.js 22.x, then:

```sh
npm ci
npm run dev
```

Open the local address printed by Next.js. Configure a separate test password hash and session secret in ignored `.env.local`. Local development stores any development calendar connection in ignored `.warehouse-local/` files. Use **Preview layout** to inspect sample jobs without connecting a calendar. Never commit local connection files or secrets.

## Validation

```sh
npm test
npm run build
```

The build includes TypeScript validation. Tests cover date boundaries, Monday–Sunday weeks, movement counts, will calls versus returns, priorities, full descriptions, recurrence exceptions, inventory, refresh behavior, and deployment access checks.

## Migration note

The original Sites version used Vinext, Cloudflare Workers/D1, and Sites-provided sign-in. Those build and runtime dependencies are removed from this Vercel version. The existing ChatGPT-hosted dashboard is a separate deployment and is not changed by pushes to this repository.

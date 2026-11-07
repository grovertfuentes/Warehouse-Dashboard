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

Keep **Vercel Authentication enabled** for every `.vercel.app` deployment. The application uses that platform access boundary rather than trusting browser-supplied identity headers. Set `WAREHOUSE_VERCEL_AUTH=enabled` only on the protected Vercel project. The application refuses production requests outside Vercel and on custom domains; add verified application authentication before enabling a custom domain or disabling Vercel protection.

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

Open the local address printed by Next.js. Local development is restricted to localhost and stores any development calendar connection in ignored `.warehouse-local/` files. Use **Preview layout** to inspect sample jobs without connecting a calendar. Never commit local connection files or secrets.

## Validation

```sh
npm test
npm run build
```

The build includes TypeScript validation. Tests cover date boundaries, Monday–Sunday weeks, movement counts, will calls versus returns, priorities, full descriptions, recurrence exceptions, inventory, refresh behavior, and deployment access checks.

## Migration note

The original Sites version used Vinext, Cloudflare Workers/D1, and Sites-provided sign-in. Those build and runtime dependencies are removed from this Vercel version. The existing ChatGPT-hosted dashboard is a separate deployment and is not changed by pushes to this repository.

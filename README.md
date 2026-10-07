This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database

Data lives in **MongoDB**, reached through the official driver
(`src/lib/mongo.ts`). Collections: `users`, `teams`, `players`,
`playerCategories`, `playerTags`, `walletTransactions`, plus the single-document
`auctionSettings` and `auctionState` (both keyed `global`).

Set in `.env.local`:

- `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017` locally, or an Atlas
  `mongodb+srv://` string.
- `MONGODB_DB` — database name. Optional when the URI already names one.

No replica set is required. Every atomic claim the auction makes is a
single-document `findOneAndUpdate`, and the wallet ledger serialises its appends
with a unique index rather than a transaction, so a plain standalone `mongod`
is enough.

`src/lib/db.ts` is the small query layer the collections are built on. It sorts
in memory rather than in the database, keeping the ordering rules (nulls last,
locale-aware string compare) identical for every collection, and it backs the
unique fields — team name, category name, tag name, user email, and
(`teamId`, `seq`) on the ledger — with real unique indexes, created on first
use. `_id` is an ObjectId in the database and a string everywhere above that
file.

Seed a first login with `npm run seed:admin`.

Check the data layer and the auction service against a live database with
`npx tsx scripts/check-db.ts`. It runs against its own scratch database and
wipes it, so it can never touch real auction data.

## Live updates

Screens are kept current by Socket.IO where one is reachable, and by polling
`/api/auction/version` where it is not. Vercel cannot hold a WebSocket open, so
production uses the standalone relay in [`socket-server/`](socket-server) —
see its README for AWS deployment. With no relay configured the room still works,
about 1.5s behind.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Runner

A mobile-first stock and handover app for one restaurant. Everyone with the deployed URL can read and update the venue workspace without signing in.

## Run locally

Use Node.js 22.12+ or 24 LTS. From the folder containing `package.json` run:

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. Development starts with example counts and stores saves in an ignored `.runner-local/` directory. To use MongoDB locally, copy `.env.example` to `.env.local`, set `MONGODB_URI`, and restart Vite.

```sh
npm test
npm run build
npm run preview
```

The preview command serves the production frontend and the development API adapter. Vercel uses the serverless function in `api/workspace.js`.

## GitHub → Vercel

1. Extract the project. Commit the contents of the folder containing `package.json`, including the lockfile, `api/`, `server/`, `shared/`, and `vercel.json`, to your Git repository. Keep local environment files and `node_modules/` out of Git.
2. Create a MongoDB Atlas cluster (or another reachable MongoDB server), create a database user, allow connections from Vercel, and copy its connection string.
3. Import the Git repository into Vercel. Select **Vite**, Node **24.x**, build command **npm run build**, and output directory **dist**. If the app is inside a subfolder, set **Root Directory** to that folder.
4. Set the server environment variables below before deploying. Configure a different namespace for Preview or use a separate preview database.
5. Deploy. Open the production URL on two devices. Change a count on one and save. Within about ten seconds the other device should show the new count. Send a handover and open Tomorrow on the other device to check the receipt and note.

| Server variable      | Purpose                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `MONGODB_URI`        | Required. MongoDB connection string with a read/write database user; keep this server-side. |
| `MONGODB_DATABASE`   | Database name. Default `runner`.                                                             |
| `RUNNER_NAMESPACE`   | Workspace document key. Use a separate value per venue/environment. Default `runner`.        |
| `VENUE_TIME_ZONE`    | Venue service date and timestamps. Default `Europe/London`.                                  |

Production opens with zero counts until a runner enters the first inventory. Missing MongoDB configuration shows a setup error. The deployment URL grants shared editing access. Use Vercel's access settings to control the audience if the venue requires restricted access.

## Five-screen flow

- **Shared stock** lists Chemicals first, then Paper supplies and Linen. The stockroom dashboard shows saved clean counts and restock reminders.
- **Update stock** saves shelf quantities. Hand wash increments by 0.5 L. Packs, rolls and pieces use whole numbers.
- **Tablecloth stock** keeps separate clean and laundry counts for hand towels and three tablecloth labels. Save commits both tabs together.
- **Tomorrow & handover** takes tomorrow’s bookings, expected covers and shift note. Send captures all eight saved counts and the four laundry quantities for the venue’s next calendar day.
- **Handover sent** confirms the submitted list. Later stock edits leave its snapshot intact. An explicit revised send replaces the current handover. This release retains the latest handover.

The client refreshes shared state on focus and every ten seconds while visible. In-page navigation preserves editing drafts. Refreshing the browser discards unsaved edits. Saves compare edited quantities with their original saved values. A conflicting save keeps the draft and returns the latest counts for review. MongoDB applies accepted writes atomically and deduplicates recent retried requests.

## Venue setup

The initial labels are **70 × 70**, **63**, and **70 × 90**. Confirm the venue’s label for **63** before changing it. The sample restock cutoffs are below 3 L of hand wash and below 8 rolls of toilet paper. Catalog labels, units and cutoffs are in `shared/inventory.js`. Typeface files are bundled with the frontend.

## Project map

| Path                  | Responsibility                                                             |
| --------------------- | -------------------------------------------------------------------------- |
| `src/`                | React + TypeScript screens, stock editors and Tailwind styles              |
| `shared/inventory.js` | Catalog, quantity units, initial state and service date                    |
| `api/workspace.js`    | Vercel Node function                                                       |
| `server/`             | Validation, request handling, MongoDB persistence and local storage adapter |
| `test/`               | Regression tests for edits, concurrency, retries and handover snapshots    |

Design reference: [Runner’s five Figma screens](https://www.figma.com/design/BfjQHMXzDssJ4fk5WiSG8T?node-id=3-67).

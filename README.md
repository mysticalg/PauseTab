# PauseTab

PauseTab is a privacy-first Chrome extension that adds intentional friction before distracting websites. This repository contains the extension, a lightweight marketing site, the billing/license/sync backend, and launch documentation.

## Workspaces

- `extension/`: Manifest V3 Chrome extension
- `website/`: product site and pricing page
- `backend/`: Stripe-backed billing, licensing, and sync API
- `docs/`: privacy policy, permissions justification, Web Store copy, and QA plan

## Commands

```bash
npm install
npm run build
npm run test
npm run release:check
```

## Environment

- `backend/.env.example`: Stripe keys, webhook secret, price IDs, token pepper, and optional extension-origin restrictions
- `website/.env.example`: backend API base URL and public support email
- `extension/.env.example`: backend API base URL, site URL, and a dev-only local-trial toggle

## Production path

1. Configure Stripe prices and webhook signing in `backend/.env`.
2. Set the support email in `website/.env`.
3. Deploy `website/` and `backend/` to the same public environment.
4. Build `extension/` with the production API/site URLs.
5. Run `npm run release:check` to produce the uploadable extension zip in `artifacts/`.
6. Complete the launch checklist in [`docs/test-plan.md`](docs/test-plan.md), [`docs/support.md`](docs/support.md), and [`docs/permissions.md`](docs/permissions.md).

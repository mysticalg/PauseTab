# PauseTab

PauseTab is a privacy-first Chrome extension that adds intentional friction before distracting websites. This repository contains the extension, a lightweight marketing site, backend/license stubs, and launch documentation.

## Workspaces

- `extension/`: Manifest V3 Chrome extension
- `website/`: product site and pricing page
- `backend/`: license and sync API scaffolding
- `docs/`: privacy policy, Web Store copy, and QA plan

## Commands

```bash
npm install
npm run build
npm run test
```

## Environment

- `backend/.env.example`: Stripe keys, webhook secret, price IDs, and token pepper
- `website/.env.example`: backend API base URL for checkout and activation
- `extension/.env.example`: backend API base URL and site URL for activation and billing portal returns

## Production path

1. Configure Stripe prices and webhook signing in `backend/.env`.
2. Deploy `website/` and `backend/` to the same public environment.
3. Build `extension/` with the production API/site URLs.
4. Complete the launch checklist in [`docs/test-plan.md`](docs/test-plan.md) and [`docs/support.md`](docs/support.md).

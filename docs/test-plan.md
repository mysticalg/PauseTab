# PauseTab Test Plan

## Functional

- Install the extension in Chrome stable
- Complete onboarding with at least one preset site
- Complete paid checkout and claim an activation code from the website
- Activate a paid license in the extension Plan tab
- Add, edit, and delete a custom rule
- Verify delay UI appears on matching URLs
- Verify allowlist paths bypass the delay
- Verify budgets and session caps block once exhausted
- Verify temporary passes unlock the current site only
- Verify global pause temporarily disables interventions
- Verify import/export round-trip works
- Verify push and pull work against cloud sync endpoints
- Verify Stripe customer portal opens from the website and extension

## Browser and platform

- Chrome stable on Windows 11
- Chrome stable on macOS
- Chrome beta
- Multiple DPI scales

## Edge cases

- Multiple protected tabs opened at once
- Browser restart during an active pass
- Clock/timezone changes
- Sync on and off
- Incognito disabled and enabled

## Launch hardening

- Validate permissions justification
- Re-check privacy disclosures against actual code paths
- Build Web Store screenshots from the finished UI
- Run a final packaging smoke test from the production build
- Confirm webhook handling with real Stripe test events before switching live keys

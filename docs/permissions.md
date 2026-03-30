# PauseTab Permissions Justification

## Extension permissions

- `storage`
  Stores rules, counters, passes, preferences, and license state locally.
- `tabs`
  Reads the active tab URL for the "Protect site" shortcut and can close the current tab when the user explicitly chooses to leave from a gate screen.
- `alarms`
  Runs periodic cleanup for cooldowns, expired passes, and session-state housekeeping.

## Host permissions

- `http://*/*`
- `https://*/*`

PauseTab needs broad host permissions because the user can protect arbitrary websites, not just a fixed allowlist. The content script runs locally in the browser, checks the current URL against the user's saved rules, and injects the gate UI only when a rule matches.

## Privacy rationale

- Page content is not transmitted to the backend.
- The extension matches against URLs and locally stored rules only.
- Billing, activation, and sync are the only remote services in the product.

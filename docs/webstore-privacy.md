# Chrome Web Store Privacy Tab Draft

Use this wording when filling the Chrome Web Store Privacy tab for PauseTab.

## Single purpose

PauseTab helps users add intentional friction before opening distracting websites they choose themselves. It uses page URL matching, delay gates, prompts, budgets, and optional sync to support that single focus-control purpose.

## Permissions and data handling summary

- `storage`: saves rules, counters, passes, preferences, and license state
- `tabs`: reads the active tab URL for the quick-add flow and can close a tab when the user explicitly chooses to leave from a gate
- `alarms`: cleanup for passes, cooldowns, and session housekeeping
- `http://*/*` and `https://*/*`: required because the user can protect arbitrary websites, not a fixed allowlist

## Data categories handled

- Browsing activity / page URL data:
  Used locally to match the current site against the user's own rules and decide whether to show a gate or update local stats.
- Account and billing data:
  Email address, Stripe customer references, license status, activation-code hash, and sync-token hash for paid plans.
- User-configured settings:
  Rules and preferences only when the user explicitly activates paid sync and pushes settings to the backend.

## Data categories not handled

- Page text or page content
- Passwords
- Personal communications
- Keystrokes outside PauseTab prompts
- Full browsing-history exports sent to the backend

## Limited Use certification basis

- Data is used only to provide or improve PauseTab's single purpose.
- Data is not sold.
- Data is not used for advertising.
- Data is not transferred except as required for billing, licensing, sync, fraud prevention, security, or legal compliance.
- Human access is limited to user-requested support, security investigation, or legal compliance.

## Public disclosure URL

[https://wu3hi2atx3.eu-west-2.awsapprunner.com/privacy.html](https://wu3hi2atx3.eu-west-2.awsapprunner.com/privacy.html)

## Support URL

[https://wu3hi2atx3.eu-west-2.awsapprunner.com/support.html](https://wu3hi2atx3.eu-west-2.awsapprunner.com/support.html)

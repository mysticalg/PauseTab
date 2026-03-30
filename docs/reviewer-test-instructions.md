# Chrome Web Store Reviewer Test Instructions Draft

Paste a cleaned-up version of this into the Chrome Web Store Test Instructions field.

## Core free-flow review

1. Install the extension and open the options page.
2. In the Rules section, add a rule for `youtube.com` or use a preset.
3. Open a matching site such as `https://www.youtube.com/`.
4. Confirm PauseTab shows a delay gate before allowing the page through.
5. Use the popup to verify quick-add, pause controls, and local stats.

## Pro review path

Use the dedicated reviewer activation code provided in the dashboard test instructions field to unlock Pro features without requiring a purchase.

After activation:

1. Open the Plan tab and paste the reviewer activation code.
2. Confirm the status changes to `PRO`.
3. In Rules, verify Pro-only controls are enabled:
   - schedules
   - daily minute budgets
   - daily session caps
   - cooldowns
4. In Privacy, enable sync and verify Push/Pull controls are available in Plan.

## Billing portal review

1. After activation, use the `Manage billing` action in the Plan tab.
2. Confirm it opens the PauseTab Stripe customer portal flow.

## Notes for reviewer

- PauseTab does not collect page text or message content.
- Broad host permissions are required because users can choose any site to protect.
- The public privacy policy and Limited Use disclosure are available at:
  [https://wu3hi2atx3.eu-west-2.awsapprunner.com/privacy.html](https://wu3hi2atx3.eu-west-2.awsapprunner.com/privacy.html)

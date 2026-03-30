# PauseTab Support And Launch Notes

## Support surface

Before launch, publish a support email address and link it in:

- Chrome Web Store listing
- website footer
- privacy policy
- billing receipts / Stripe customer portal branding

## Activation flow

1. User completes checkout on the PauseTab website.
2. Website claims the Stripe Checkout Session and shows an activation code.
3. User pastes that code into the extension Plan tab.
4. Extension exchanges the code for account and sync credentials.

## Production configuration checklist

- Set real Stripe secret key and webhook secret
- Set monthly, annual, and lifetime Stripe price IDs
- Replace the default token pepper with a long random secret
- Set `VITE_PAUSETAB_API_BASE_URL` and `VITE_PAUSETAB_SITE_URL` to production domains
- Register the Stripe webhook endpoint for subscription and checkout events

## Remaining non-code launch work

- Generate final Chrome Web Store screenshots and promo art
- Prepare trader / seller verification where required
- Set real public domain and privacy-policy URL
- Create support inbox and refund workflow

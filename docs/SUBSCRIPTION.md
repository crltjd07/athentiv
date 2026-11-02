# Subscription model & payments

> **Proposed prices, not live.** Payments currently run in a sandbox. No gateway is connected and no money moves. Every sandbox transaction is stored with `is_test = 1` and labelled "test payment" in the UI.

## Proposed pricing (Philippine student market)

| Plan | Price | Per month | Rationale |
|---|---|---|---|
| Weekly Premium | **₱29** / 7 days | ≈ ₱126 | Lower than a milk-tea; for exam weeks. Deliberately the worst value per month |
| Monthly Premium | **₱99** / month | ₱99 | Below ₱100, priced in line with common student mobile-load promos. Expected default ("Popular") |
| Annual Premium | **₱799** / year | ≈ ₱67 | **33% off** monthly (₱1,188/yr). Covers a full school year |

Stand owners also get the one-time **30-day trial** on their first tap, which bundles Premium value into the hardware.

Suggested launch promotions (not implemented): ₱49 first month for new accounts; ₱699 annual during enrolment season (June–August); a "barkada" referral month.

## How it works

```
Premium page → POST /api/billing/checkout {plan}       → subscription_transactions (pending)
            → /premium/checkout/:id (sandbox screen)
            → POST /api/billing/sandbox/:id {outcome}  → paid → user_subscriptions row
```

- **Periods stack.** A new period starts at `max(now, current expiry)`, so buying while active extends the expiry (tested: monthly then weekly gives exactly +7 days).
- **Idempotent.** `user_subscriptions.transaction_id` is UNIQUE, so the same payment can't be applied twice.
- Calendar months clamp (31 Jan + 1 month = 28/29 Feb).
- Renewal is manual in sandbox mode. Users get an in-app reminder 3 days before expiry, and another when it ends.
- `PAYMENTS_SANDBOX=off` disables simulated purchases entirely.

## Connecting a real gateway (next step)

[PayMongo](https://developers.paymongo.com) supports GCash, Maya, cards and GrabPay:

1. Add `provider = 'paymongo'` to the CHECK constraint (new migration).
2. Create a Checkout Session in `createCheckout()` and redirect to its `checkout_url`.
3. Add `/api/billing/webhook` that verifies the `Paymongo-Signature` header with the webhook secret (env var, server only), then calls the same settle logic used by the sandbox.
4. Never trust the browser redirect for activation; only the verified webhook activates Premium.

This adapter is **not** written yet, so it isn't presented as working.

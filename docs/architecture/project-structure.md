# Project structure and feature boundaries

This document describes where new website behavior belongs. Keep Next.js route URLs stable; route files are adapters, while domain behavior lives under `src/features`.

```text
src/
  app/                 Next.js pages, layouts, and HTTP route adapters
  components/          Shared presentation components
  context/             App-wide client state and providers
  features/
    ai/
      customer/        Neo chat UI, customer assistant, product/order context
      admin/           Admin AI modules, snapshots, and saved daily insights
    orders/             Order lifecycle and status-transition policy
    logistics/         Carrier tracking adapters and status normalization
    payments/          Payment policy and recorded-payment rules
    pricing/           Exchange-rate integration and canonical price calculator
    purchasing/        Purchase-task lifecycle and admin workflow
  lib/                 Shared infrastructure: Prisma, auth, mail, API-key pools,
                       static seed content, and common policies
  types/               Shared TypeScript data contracts
prisma/                Database schema and seed data
docs/
  architecture/        Structure, boundaries, and staged AI roadmap
```

## Dependency rules

- `src/app/**/route.ts` validates the HTTP request, authenticates it, calls feature logic, and maps the result to an HTTP response. Keep public URL structure here.
- Feature modules may depend on shared infrastructure in `src/lib`, but shared infrastructure should not import a feature module.
- Put business rules beside the feature that owns them. Price arithmetic lives in `features/pricing`; payment transitions live in `features/payments`; carrier-specific behavior lives in `features/logistics`.
- Keep AI as an assistant over server-owned data. It can explain, summarize, and suggest. Server code owns prices, order status, inventory reservations, authorization, and writes.
- A customer-provided order code is an identifier, not proof of ownership. Guest order access needs a signed email link; account access needs the matching customer session.
- `Product.stockSlots` represents orderable website slots, not verified physical inventory. Product copy and AI prompts must preserve that meaning.
- Snapshot data sent to an external AI provider should be aggregated and should exclude raw customer chat, email, phone, and address.

## Database changes

Prisma schema changes must be additive and reviewed with a generated client before deployment. This repository currently synchronizes schema during a Vercel Production build through `scripts/vercel-build.js`; do not run `prisma db push` from a local checkout that might point at Neon Production. Preview environments may not receive schema synchronization, so features backed by new tables can remain unavailable in Preview until the deployment workflow is adjusted or the schema is applied to a separate Preview database.

## Stage 1 scope

- Group existing code into feature-oriented folders without changing route URLs.
- Centralize price calculation and keep the AI from inventing shipping weight, availability, or final prices.
- Protect guest order detail with email verification and persist the admin daily insight for later review.
- Keep all verification on local/isolated data. No Neon, SMTP, carrier, payment-provider, or production cron call is needed to build this stage.

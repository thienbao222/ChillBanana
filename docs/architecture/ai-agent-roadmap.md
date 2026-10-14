# ChillBanana AI Agent roadmap

## Stage 1 — Safe foundation (implemented in this branch)

- Organize domain code under `src/features` and keep Next.js route URLs as thin adapters.
- Use one server-owned price calculator for cart orders and Neo's product-link estimate. The quote marks unknown shipping as unknown and never invents product availability.
- Treat an order code as a locator, not an access credential. Guest details require the signed email link; account details require the matching customer session.
- Persist the daily admin insight and let an administrator review or regenerate it. Send the model aggregate metrics rather than raw customer messages.

## Stage 2 — Reliable customer-support tools

**Implemented on the isolated Stage 2 branch.** The chat API runs server-owned read-only support tools before calling Gemini:

- Current catalog search with request-slot wording, voltage notes, and clearly labeled estimates. It never presents request slots as marketplace/warehouse stock.
- Quote estimate using the shared price calculator and a current, non-stale exchange rate. It requires a numeric JPY price and allowlisted HTTPS marketplace URL; shipping is excluded until actual weight is known. The estimate is deterministic and labeled as unconfirmed.
- Order status lookup only after matching customer session or valid guest email-access token. Unauthorized and unknown order codes receive the same generic response. Order answers are generated from a fixed server template rather than the model.
- Shipping policy from the same constants used by the price calculator, and compatibility notes from the catalog. Missing model/voltage/weight facts are surfaced as unknown.
- Structured evidence carries tool status, observation/data timestamps, known/unknown fields, and relative website links. The chat UI displays verified-source timestamps and links.
- Representative local evaluations cover intent routing, order access, marketplace URL/price validation, quote arithmetic, request-slot wording, tool access levels, and image identification limits (`npm run eval:customer-support`).

No Prisma schema change or database write was introduced for these tools. Existing chat-session logging remains in the chat route. The Stage 2 branch must be reviewed and deployed separately; it has not been pushed to `main` or run against Neon Production.

## Stage 3 — Admin operations copilot

- Reuse the same verified report, order, inventory-slot, and customer-trend services used by admin screens.
- Show the data range and freshness beside every generated insight; label recommendations separately from observed facts.
- Keep financial totals, conversion metrics, and alert thresholds deterministic in application code. Let AI explain patterns and propose follow-up actions.
- Add configurable insight modules through the existing admin AI module registry rather than creating separate AI pages for each feature.

## Stage 4 — Bounded agent actions

- Introduce a capability registry where each action declares its permission, inputs, validation, confirmation requirement, and audit record.
- Start with reversible, low-impact actions such as drafting a customer reply or preparing a purchase task. Require a human to approve sending messages, changing an order, reserving stock, or triggering a purchase.
- Make actions idempotent and record actor, inputs, result, and timestamp. Provide a compensating action for changes that can be reversed.
- Do not let model output directly call payment, inventory, fulfillment, or customer-contact APIs. The server validates every action against current database state and the admin's role.

## Release checks for each stage

- A missing or stale data source is clearly reported; the agent does not fill gaps with invented facts.
- Authorization and validation remain server-side and are covered by positive and negative cases.
- AI-provider failures do not block core ordering, tracking, payment recording, or admin operation.
- Preview testing uses a separate database and credentials; a release does not exercise customer production data as test data.

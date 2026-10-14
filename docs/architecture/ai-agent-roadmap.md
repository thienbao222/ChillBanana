# ChillBanana AI Agent roadmap

## Stage 1 — Safe foundation (implemented in this branch)

- Organize domain code under `src/features` and keep Next.js route URLs as thin adapters.
- Use one server-owned price calculator for cart orders and Neo's product-link estimate. The quote marks unknown shipping as unknown and never invents product availability.
- Treat an order code as a locator, not an access credential. Guest details require the signed email link; account details require the matching customer session.
- Persist the daily admin insight and let an administrator review or regenerate it. Send the model aggregate metrics rather than raw customer messages.

## Stage 2 — Reliable customer-support tools

- Define typed, read-only tools for catalog search, quote estimates, order status, shipping policy, and product compatibility.
- Return structured tool results with source timestamps, known/unknown fields, and links to the relevant website pages.
- Have Neo ask a clarifying question when required inputs are missing (for example, product price or measured weight) instead of guessing.
- Add representative evaluations for price arithmetic, stock-slot wording, image identification limits, and order access boundaries before expanding prompts.

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

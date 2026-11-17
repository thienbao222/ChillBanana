# Neo catalog reliability plan

## Goal

Improve Neo's product answers without hard-coding the 11 displayed products, restricting unrelated chat, changing prices, or making claims about Japanese-store stock that the app cannot verify.

## Confirmed from the current code

- The chat route calls deterministic support intent detection, catalog search, then Gemini for a response unless a guarded reply applies.
- Catalog search reads `Product` rows. With 11 rows it evaluates the complete current catalog; the 501/60-row limits matter only if the database grows past 500.
- `stockSlots` means ChillBanana purchase-request capacity, not physical inventory at a Japanese marketplace.
- The catalog code and curated seed already include Hada, Anessa, Luffy and Gunpla; adding per-product aliases is not justified without a reproduced mismatch.
- The chat client sends product cards in history, but the API strips them. Server-side chat history is saved but not reloaded to resolve product references.
- Catalog and business-evidence restrictions are included in the system prompt for every model reply, including general conversation.
- A chat can make more than one Gemini call for intent routing/keyword translation, response generation, and post-response analytics.
- A read-only Prisma query against this workspace's `.env` database returned 11 `Product` rows, matching the count in the admin screenshot.
- The routed category is passed into catalog search as a hard category filter; a wrong routed category could hide an otherwise matching item. This is a candidate cause, not confirmed as the failure source.
- The command-shell loopback could not reach `localhost:3000`; the browser session later reached it after the user confirmed it was running.
- After the user said the server was running, one exact Hada query was sent through the browser session. It returned HTTP 200, `aiMode: gemini`, and the correct `prod-cos-03` card with 24 request slots. The earlier Hada failure did not reproduce.
- That request used live Gemini quota and wrote one anonymous chat interaction to the configured database. It did not change catalog, pricing, order, or cart data.

## Before the noon presentation (2026-10-25)

- [x] Keep the pushed `codex/neo-catalog-routing` branch as the rollback point; do not merge it into `main`.
- [x] Kept code, pricing, order, and catalog data unchanged; one targeted live request used quota and wrote a chat log as part of the diagnostic.
- [x] Avoid the live 23-case AI evaluation; run only the one targeted Hada diagnostic after the user asked to continue.
- [ ] Describe the displayed slot count as purchase-request capacity; do not present it as live Japanese-store inventory.

## After the presentation: implementation sequence

### 1. Confirm the data source (read-only)

The workspace `.env` database returned 11 product rows in a read-only Prisma query. The first eight rows visible in the screenshot correspond to entries in that result. The full admin name/ID list and the environment of the earlier local AI server remain unconfirmed. Do not inspect customer data or modify production rows.

**Acceptance:** the count and product IDs/names match the admin listing; stock semantics are documented as request slots.

**Dependency:** none. **Scope:** XS.

### 2. Fix only a proven catalog-search defect

If the same database has 11 rows, trace one failing query through normalized terms, category selection, ranked rows, and returned evidence. Keep search data-driven across the catalog; do not add a fixed product allowlist. If the database later exceeds 500 products, replace the recent-row cap with a complete bounded search that ranks matches rather than simply taking the newest 60.

Keep zero-slot products searchable so Neo can distinguish “product exists, no request slots” from “product not found.” Only state “not in catalog” after a complete search succeeds with no match.

**Acceptance:** all current catalog rows are in scope; ambiguous matches prompt a clarification; true no-match does not assert physical marketplace unavailability.

**Dependency:** Task 1. **Scope:** S for 11 rows; M if the catalog is already larger than 500.

### 3. Preserve product context safely

Resolve follow-up references using a server-verified product ID. Do not trust price, stock, or product names supplied in client history; reload those fields from `Product` before rendering a card or allowing the existing explicit add-to-cart path.

**Acceptance:** a follow-up can refer to the prior product; stale/deleted IDs fail safely; no ambiguous product is auto-added.

**Dependency:** Task 2. **Scope:** S–M.

### 4. Scope grounding and reduce unnecessary model calls

Keep catalog, price, stock-slot, quote, shipping, and order claims grounded in server evidence. Preserve ordinary greeting/general conversation outside those business facts. Reuse keyword/intent results so analytics does not translate the same message again.

**Acceptance:** business facts remain evidence-based; unrelated chat is not rejected for lacking catalog evidence; one message does not repeat the same translation call unnecessarily.

**Dependency:** Tasks 1–2. **Scope:** M; separate from catalog retrieval to keep rollback simple.

## Verification policy

- No tests or live model calls before the presentation.
- Do not rerun the full 23-case live evaluation by default.
- One targeted live Hada diagnostic was used to resolve the server-access blocker; do not repeat it or run the 23-case evaluation before the presentation. If code changes after the presentation, use one focused offline check only if verification is requested or needed. Never use real customer data or consume live Gemini quota for deterministic catalog checks.
- Keep each implementation slice independently revertible and do not merge into `main` until reviewed.

## Risks and boundaries

| Risk | Impact | Mitigation |
|---|---|---|
| `stockSlots` mistaken for Japanese store inventory | Incorrect availability promise | Label it as request capacity; use a real marketplace source before claiming store stock |
| A search cap hides older products | False “not in catalog” | Full-catalog search or mark search incomplete; only assert no-match after complete coverage |
| Global evidence-only prompt narrows general chat | Assistant feels unnecessarily limited | Apply strict grounding to ChillBanana business facts, not all conversation |
| Client history contains stale or forged product data | Wrong card or cart item | Use IDs only as references; reload authoritative fields from the database |
| More routing/translation calls consume quota | Slower chat and 429s | Reuse existing outputs; no live eval before the presentation |

## Open point

The workspace `.env` database query returned 11 products. The current Hada request found the correct record, so no retrieval patch is justified yet. The prior screenshot's Hada failure and the other failures are not reproduced against this running server; possible causes include a prior server/database version or transient routing/model output. Do not change retrieval until an actual failing response is observed.

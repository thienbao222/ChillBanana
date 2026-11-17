# Neo catalog reliability tasks

- [x] Push the current AI fixes to `codex/neo-catalog-routing` as a rollback point.
- [x] Read the chat route, intent router, catalog search, product schema, and cart path without running tests.
- [x] Keep code/pricing/catalog/order data unchanged; no full eval. The one requested diagnostic wrote one chat log and used Gemini quota.
- [x] Read-only Prisma query confirmed 11 Product rows in the workspace `.env` database.
- [x] Checked localhost:3000 without making a request; no server was listening.
- [x] After the user confirmed the server was running, one targeted Hada request returned the correct catalog card; did not run the full evaluation.
- [ ] After the presentation, confirm the running chat server uses this database and compare all 11 names/IDs with admin.
- [ ] Trace the remaining failures only if they recur; change retrieval only when a specific defect is observed.
- [ ] Preserve product context through server-verified product IDs if follow-up failures remain in scope.
- [ ] Scope evidence rules to business facts and reuse translation results if model-call duplication is confirmed.
- [ ] If asked to verify a code change, use one focused offline check; skip the live 23-case suite unless specifically requested.
- [ ] Review the diff and keep each slice revertible before any merge to `main`.

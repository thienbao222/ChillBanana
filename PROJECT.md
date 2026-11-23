# Project: ChillBanana 5 Thin-Slice Mode B Solidification

## Architecture
- **Framework & Core**: Next.js 15 (App Router), TypeScript Strict, Prisma ORM with PostgreSQL.
- **Domain Modules (`src/features/`)**:
  - `src/features/payments/`: Payment policies, deposit calculation, sandbox guards, transaction logs.
  - `src/features/purchasing/`: Tokyo purchasing workflow, purchase task queues, order eligibility.
  - `src/features/pricing/`: Exchange rates, pricing calculators, minimum service fees.
  - `src/features/ai/`: AI analytics, snapshots, customer support tools.
- **Admin Guard & RBAC (`src/lib/`)**:
  - `src/lib/admin-guard.ts`: `requireAdmin` middleware enforcing role checks (`SUPER_ADMIN`, `OPERATOR`).
  - `src/lib/auth-session.ts`: Admin session tokens with embedded roles.
- **Data Flow & Status Lifecycles**:
  - Orders: `PENDING_DEPOSIT` -> `PURCHASING_JP` (or `WAREHOUSE_VN`) -> `ARRIVED_VN` -> `LOCAL_DELIVERY` -> `COMPLETED`.
  - Payment Statuses: `UNPAID` -> `DEPOSITED_50` / `DEPOSITED_70` / `PAID_100` -> `REFUNDED`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Sandbox/Mock Route Security | Enforce APP_ENV check returning HTTP 404 on production across all mock routes | M1 | Survey E1 |
| 2 | F2: Protect Order Creation & Status | Ensure client cannot self-finalize orders or arbitrarily dictate payment status | M1 | Survey E1 |
| 3 | F3: Flag Sandbox Orders & Segregate | Flag sandbox orders (`isSandbox`) and exclude from Tokyo purchasing queue | M1 | Survey E1 |
| 4 | F4: Define DEPOSITED_70 & Helpers | Add `DEPOSITED_70` to types and define centralized `isDepositPaid` and `getPaymentStatusLabelVi` | M2 | Survey E1 |
| 5 | F5: Unblock Status Transitions for 70% | Allow orders with `DEPOSITED_70` to transition to `PURCHASING_JP` and handle rollback cleanly | M2 | Survey E1 |
| 6 | F6: Propagate DEPOSITED_70 to Admin UI & Tasks | Update badges, dropdowns, Kanban cards, packing slips, purchase tasks, and analytics for 70% | M2 | Survey E1 |
| 7 | F7: Synchronize Cart 3-Tier Deposit | Align CartDrawer & CartContext with server tiers (<1M: 100%, 1M-10M: 70%/100%, >10M: 50%/70%/100%) | M3 | Survey E2 |
| 8 | F8: Remove Static VietQR Fallback | Remove hardcoded "0901234567" from tracking and NeoDaylightCosmos | M3 | Survey E2 |
| 9 | F9: Auto-transition on VietQR Approval | Transition order to `PURCHASING_JP` (or `WAREHOUSE_VN`) automatically when admin approves VietQR payment | M3 | Survey E2 |
| 10 | F10: Standardize 2 RBAC Roles | Enforce `SUPER_ADMIN` and `OPERATOR` roles in `admin-guard.ts` and auth session | M4 | Survey E3 |
| 11 | F11: 100% Admin Route Role Coverage | Audit and enforce explicit `roles` on all 38 admin routes in `src/app/api/admin/...` | M4 | Survey E3 |
| 12 | F12: Automated RBAC Route Test | Strengthen `tests/unit/admin-inventory-rbac.test.ts` to scan 100% of admin routes for `roles:` | M4 | Survey E3 |
| 13 | F13: Minimum Service Fee 50,000 VND | Raise `SERVICE_FEE_MINIMUM_VND` to 50,000 VND and update seed/test expectations | M5 | Survey E2 |
| 14 | F14: Fix Next.js Link Lint Error | Replace `<a>` with `<Link>` at `src/app/dat-hang/nhap/page.tsx:94` to achieve 0 lint errors | M5 | Survey E2 |
| 15 | F15: Final Acceptance Audit | Complete audit checklist and generate `docs/audit/04-final.md` | M5 | Survey E3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R1: Khóa bảo mật Sandbox & Mock và bảo vệ luồng đơn hàng | F1, F2, F3 | None | DONE |
| M2 | R2: Mở thông trạng thái DEPOSITED_70 trên toàn hệ thống | F4, F5, F6 | M1 | DONE |
| M3 | R3: Đồng bộ giỏ hàng và xử lý thanh toán VietQR | F7, F8, F9 | M2 | DONE |
| M4 | R4: Chuẩn hóa phân quyền RBAC cho các route quản trị | F10, F11, F12 | M1 | DONE |
| M5 | R5: Nâng phí mua hộ tối thiểu, sửa lỗi giao diện & Nghiệm thu | F13, F14, F15 | M3, M4 | DONE |

## Interface Contracts
### `src/features/payments/sandbox-guard.ts` (New module)
- `isMockSandboxAllowed(): boolean`: Returns true if `APP_ENV === "demo"` or `NODE_ENV === "test"` or `process.env.APP_ENV === "test"`. Returns false if `production`.
- `enforceMockSandboxAllowed(): NextResponse | null`: Returns HTTP 404 `{ error: "Not Found" }` if not allowed, null otherwise.

### `src/features/payments/policy.ts` (Extended)
- `DEPOSITED_PAYMENT_STATUSES = ["DEPOSITED_50", "DEPOSITED_70", "PAID_100"] as const`
- `isDepositPaid(status: string | null | undefined): boolean`
- `getPaymentStatusLabelVi(status: string | null | undefined): string`

### `src/lib/admin-guard.ts` (RBAC)
- `AdminRole = "SUPER_ADMIN" | "OPERATOR"`
- `requireAdmin(req: NextRequest, options: { roles: AdminRole[] })`: Options with `roles` mandatory across admin endpoints.

## Code Layout
- `src/features/payments/sandbox-guard.ts`: Central guard for mock/sandbox execution.
- `src/features/payments/policy.ts`: Centralized deposit policies, tiers, and payment status helpers.
- `src/app/api/payment/mock-sandbox/route.ts`: Protected sandbox endpoint.
- `src/app/api/payment/mock-confirm/route.ts`: Protected mock confirm endpoint.
- `src/app/api/admin/orders/[id]/mock-transition/route.ts`: Protected mock transition endpoint.
- `src/app/api/admin/demo-emails/route.ts`: Protected demo emails endpoint.
- `src/app/api/admin/purchase-tasks/orders/route.ts`: Filter out sandbox orders.
- `src/features/purchasing/service.ts`: Prevent sandbox order purchasing.
- `src/types/index.ts`: PaymentStatus and Order interfaces.
- `src/context/CartContext.tsx`: 3-tier deposit option types and calculations.
- `src/components/CartDrawer.tsx`: Dynamic deposit option buttons.
- `src/app/tracking/page.tsx`: VietQR bank configuration and order tracking view.
- `src/components/NeoDaylightCosmos.tsx`: VietQR bank configuration.
- `src/app/api/admin/orders/[id]/payments/route.ts`: VietQR approval and status update to PURCHASING_JP.
- `src/features/pricing/calculator.ts`: Minimum service fee constant.
- `src/app/dat-hang/nhap/page.tsx`: Next.js Link component.
- `docs/audit/04-final.md`: Mode B Final acceptance report.

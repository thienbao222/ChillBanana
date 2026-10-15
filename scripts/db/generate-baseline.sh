#!/usr/bin/env bash
# Tạo baseline migration (prisma/migrations/0_init) từ schema TRƯỚC Giai đoạn 1.
# Không cần kết nối database; cần `npm ci` đã chạy (để có prisma CLI) và repo có đủ lịch sử git.
set -euo pipefail

BASELINE_COMMIT="ef9e20c"   # commit ngay trước khi thêm migration, schema chỉ gồm các bảng gốc
cd "$(dirname "$0")/../.."

if [ -f prisma/migrations/0_init/migration.sql ]; then
  echo "prisma/migrations/0_init đã tồn tại. Xóa thủ công nếu muốn tạo lại." >&2
  exit 1
fi

tmp="$(mktemp -d)"
git show "${BASELINE_COMMIT}:prisma/schema.prisma" > "${tmp}/schema.prisma"
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "${tmp}/schema.prisma" \
  --script > prisma/migrations/0_init/migration.sql

echo "Đã tạo prisma/migrations/0_init/migration.sql ($(wc -l < prisma/migrations/0_init/migration.sql) dòng)."
echo "Bước tiếp theo: xem docs/DATABASE_MIGRATIONS.md (đánh dấu baseline đã áp dụng trên database production)."

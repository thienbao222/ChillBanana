#!/usr/bin/env python3
"""Đăng/ cập nhật MỘT bình luận trên PR tóm tắt kết quả CI kèm phần cuối log của bước lỗi.

Giúp xem nhanh lỗi mà không cần mở Actions. Không chứa secret: log chỉ gồm đầu ra của lệnh test/build
(các giá trị trong CI là giá trị giả).
"""
import json
import os
import subprocess
import sys

MARKER = "<!-- ci-report -->"
LOG_DIR = sys.argv[1]
STEPS = json.loads(os.environ.get("STEPS_JSON", "{}"))
LABELS = [
    ("install", "Cài đặt"),
    ("validate", "Prisma validate"),
    ("migrate", "Migration trên DB trống"),
    ("drift", "Migration khớp schema"),
    ("typecheck", "Type check"),
    ("lint", "Lint"),
    ("unit", "Unit test"),
    ("evals", "Eval AI"),
    ("integration", "Integration test"),
    ("build", "Build"),
    ("pwinstall", "Cài Playwright"),
    ("e2e", "E2E"),
]
ICON = {"success": "✅", "failure": "❌", "skipped": "⏭️", "cancelled": "🚫"}


def tail(name: str, lines: int, limit: int) -> str:
    path = os.path.join(LOG_DIR, f"{name}.log")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8", errors="replace") as fh:
        text = "".join(fh.readlines()[-lines:])
    return text[-limit:]


rows, details = [], []
for sid, label in LABELS:
    conclusion = (STEPS.get(sid) or {}).get("conclusion") or "skipped"
    rows.append(f"| {label} | {ICON.get(conclusion, '❔')} {conclusion} |")
    if conclusion == "failure":
        details.append(f"<details open><summary>❌ {label}: phần cuối log</summary>\n\n```\n{tail(sid, 160, 9000)}\n```\n</details>")
    elif sid in ("unit", "integration", "e2e") and conclusion == "success":
        details.append(f"<details><summary>{label}: tóm tắt</summary>\n\n```\n{tail(sid, 25, 3000)}\n```\n</details>")

body = "\n\n".join(
    [
        MARKER,
        f"### Kết quả CI cho `{os.environ.get('SHA', '')[:7]}`",
        "| Bước | Kết quả |\n| --- | --- |\n" + "\n".join(rows),
        *details,
    ]
)[:60000]

repo, pr = os.environ["REPO"], os.environ["PR_NUMBER"]
existing = subprocess.run(
    ["gh", "api", f"repos/{repo}/issues/{pr}/comments", "--paginate", "--jq", f'.[] | select(.body | startswith("{MARKER}")) | .id'],
    capture_output=True, text=True,
).stdout.split()
if existing:
    subprocess.run(["gh", "api", "-X", "PATCH", f"repos/{repo}/issues/comments/{existing[0]}", "-f", f"body={body}"], check=True)
else:
    subprocess.run(["gh", "api", "-X", "POST", f"repos/{repo}/issues/{pr}/comments", "-f", f"body={body}"], check=True)

import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/app/admin/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix types import
match = re.search(r'import \{([\s\S]*?)\} from "@/types";', text)
if match:
    imports = [x.strip() for x in match.group(1).split(',')]
    used = [i for i in imports if i and text.count(i) > 1]
    if used:
        text = text.replace(match.group(0), f'import {{ {", ".join(used)} }} from "@/types";')
    else:
        text = text.replace(match.group(0) + '\n', '')

# Fix StoredOrder import
if text.count('StoredOrder') <= 1:
    text = re.sub(r'import \{ StoredOrder \} from "@/lib/order-store";\n', '', text)

with open('src/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Cleaned types!")

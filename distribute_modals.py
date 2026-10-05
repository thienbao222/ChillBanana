import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read OrderManagementTab.tsx
with open('src/app/admin/components/OrderManagementTab.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

m2_start = 1100
m3_start = 1165
m4_start = 1384

modal2_lines = lines[m2_start:m3_start]
modal3_lines = lines[m3_start:m4_start]

# Remove Modal 2 and 3 from OrderManagementTab
new_order_lines = lines[:m2_start] + lines[m4_start:]
with open('src/app/admin/components/OrderManagementTab.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_order_lines)

# Inject Modal 2 into AiTrendsTab.tsx
with open('src/app/admin/components/AiTrendsTab.tsx', 'r', encoding='utf-8') as f:
    ai_lines = f.readlines()

# Find the closing tag of the main block in AiTrendsTab.tsx
# Usually the last `</div>` before `);`
insert_idx = -1
for i in range(len(ai_lines)-1, -1, -1):
    if ');' in ai_lines[i]:
        insert_idx = i - 1
        # Skip trailing empty lines or closing tags
        while insert_idx >= 0 and '</div>' not in ai_lines[insert_idx] and '</>' not in ai_lines[insert_idx]:
            insert_idx -= 1
        break

if insert_idx != -1:
    # Insert right before the last closing tag
    new_ai_lines = ai_lines[:insert_idx] + modal2_lines + ai_lines[insert_idx:]
    with open('src/app/admin/components/AiTrendsTab.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_ai_lines)
    print("Injected Modal 2 into AiTrendsTab.tsx")
else:
    print("Failed to find insert point in AiTrendsTab.tsx")

# Inject Modal 3 into ProductsTab.tsx
with open('src/app/admin/components/ProductsTab.tsx', 'r', encoding='utf-8') as f:
    prod_lines = f.readlines()

insert_idx = -1
for i in range(len(prod_lines)-1, -1, -1):
    if ');' in prod_lines[i]:
        insert_idx = i - 1
        while insert_idx >= 0 and '</div>' not in prod_lines[insert_idx] and '</>' not in prod_lines[insert_idx]:
            insert_idx -= 1
        break

if insert_idx != -1:
    new_prod_lines = prod_lines[:insert_idx] + modal3_lines + prod_lines[insert_idx:]
    with open('src/app/admin/components/ProductsTab.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_prod_lines)
    print("Injected Modal 3 into ProductsTab.tsx")
else:
    print("Failed to find insert point in ProductsTab.tsx")


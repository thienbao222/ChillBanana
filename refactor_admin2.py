import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/app/admin/page.tsx', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

total = len(lines)
print(f"Total lines: {total}")

def find_tab_end(lines, start_line_0idx):
    depth = 0
    in_block = False
    for i in range(start_line_0idx, len(lines)):
        for ch in lines[i]:
            if ch == '(':
                depth += 1
                in_block = True
            elif ch == ')':
                depth -= 1
                if in_block and depth == 0:
                    return i
    return -1

def extract_inner(lines, start, end):
    return ''.join(lines[start+1 : end])

# Customers tab: line 1017 (1-indexed) -> 1016 (0-indexed)
cust_start = 1016
cust_end   = find_tab_end(lines, cust_start)
print(f"Customers tab: lines {cust_start+1} – {cust_end+1}")

# Products tab: line 1379 -> 1378
prod_start = 1378
prod_end   = find_tab_end(lines, prod_start)
print(f"Products tab: lines {prod_start+1} – {prod_end+1}")

cust_inner = extract_inner(lines, cust_start, cust_end)
prod_inner = extract_inner(lines, prod_start, prod_end)

print(f"Customers inner: {len(cust_inner.splitlines())} lines")
print(f"Products inner:  {len(prod_inner.splitlines())} lines")

# ─── CustomersTab.tsx ──────────────────────────────────────────────────────────
customers_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, Users, ShieldCheck, MessageSquare, AlertCircle,
  Package, TrendingUp, Search, Eye, ArrowRight, ShoppingBag, Link2
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

interface CustomersTabProps {
  onViewOrders: (emailOrName: string) => void;
}

export default function CustomersTab({ onViewOrders }: CustomersTabProps) {
  const { adminToast } = useAdminToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"ALL" | "REGISTERED" | "GUEST_ORDER" | "CHAT_LEAD">("ALL");

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.customers || []);
        setCustomerStats(data.stats || null);
      } else {
        adminToast.error("Lỗi tải danh sách khách hàng");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCustomers = customers.filter((c: any) => {
    const matchType = customerTypeFilter === "ALL" || c.customerType === customerTypeFilter;
    const term = customerSearch.toLowerCase();
    const matchSearch =
      !term ||
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term);
    return matchType && matchSearch;
  });

  return (
''' + cust_inner + '''  );
}
'''

with open('src/app/admin/components/CustomersTab.tsx', 'w', encoding='utf-8') as f:
    f.write(customers_tab)
print("Written: CustomersTab.tsx")

# ─── ProductsTab.tsx ───────────────────────────────────────────────────────────
products_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, ShoppingBag, Plus, Edit3, Trash2, Search,
  AlertCircle, CheckCircle2, Tag, X, ExternalLink
} from "lucide-react";
import { CuratedProduct } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";

export default function ProductsTab() {
  const { adminToast } = useAdminToast();
  const [products, setProducts] = useState<CuratedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CuratedProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "cosmetics",
    priceJpy: 3000,
    weightKg: 0.4,
    imageUrl: "",
    description: "",
    originalStore: "Amazon JP",
    stockSlots: 10,
    isHot: false,
    featuredNote: "",
    voltageNote: "",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok && data.products) setProducts(data.products);
    } catch { adminToast.error("Lỗi tải sản phẩm"); }
    finally { setLoadingProducts(false); }
  };

  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "", category: "cosmetics", priceJpy: 3500, weightKg: 0.4,
      imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      description: "Sản phẩm nội địa Nhật Bản chính hãng gom mua trực tiếp.",
      originalStore: "Amazon JP", stockSlots: 10, isHot: true,
      featuredNote: "Mặt hàng săn sale số lượng có hạn", voltageNote: "",
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: CuratedProduct) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name, category: prod.category, priceJpy: prod.priceJpy,
      weightKg: prod.weightKg, imageUrl: prod.imageUrl,
      description: prod.description || "", originalStore: prod.originalStore || "Amazon JP",
      stockSlots: prod.stockSlots || 10, isHot: Boolean(prod.isHot),
      featuredNote: prod.featuredNote || "", voltageNote: prod.voltageNote || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.priceJpy) {
      adminToast.error("Vui lòng điền tên sản phẩm và giá Yên!");
      return;
    }
    setIsSavingProduct(true);
    try {
      if (editingProduct) {
        const res = await fetch("/api/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProduct.id, ...productForm }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Cập nhật sản phẩm thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          adminToast.error(data.error || "Lỗi cập nhật");
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Đã thêm sản phẩm mới thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          adminToast.error(data.error || "Lỗi tạo sản phẩm");
        }
      }
    } catch { adminToast.error("Lỗi kết nối máy chủ"); }
    finally { setIsSavingProduct(false); }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" khỏi trang chủ?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success("Đã xóa sản phẩm!");
        fetchProducts();
      } else {
        adminToast.error(data.error || "Lỗi khi xóa");
      }
    } catch { adminToast.error("Lỗi kết nối"); }
  };

  return (
''' + prod_inner + '''  );
}
'''

with open('src/app/admin/components/ProductsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(products_tab)
print("Written: ProductsTab.tsx")

# ─── Replace tabs in admin/page.tsx ──────────────────────────────────────────
def replace_tab_block(content, lines, start, end, replacement):
    block = ''.join(lines[start:end+1])
    if block in content:
        return content.replace(block, replacement, 1), True
    return content, False

# Customers replacement — passes onViewOrders callback
cust_block = ''.join(lines[cust_start:cust_end+1])
if cust_block in content:
    content = content.replace(cust_block,
        '        {activeTab === "customers" && (\n          <CustomersTab onViewOrders={(term) => { setSearchTerm(term); setActiveTab("orders"); }} />\n        )}\n', 1)
    print("Replaced customers tab")
else:
    print("WARN: customers block not found")

prod_block = ''.join(lines[prod_start:prod_end+1])
if prod_block in content:
    content = content.replace(prod_block,
        '        {activeTab === "products" && <ProductsTab />}\n', 1)
    print("Replaced products tab")
else:
    print("WARN: products block not found")

# ─── Add imports ──────────────────────────────────────────────────────────────
old_import = 'import ReportsTab from "@/app/admin/components/ReportsTab";\nimport AiTrendsTab from "@/app/admin/components/AiTrendsTab";'
new_import = old_import + '\nimport CustomersTab from "@/app/admin/components/CustomersTab";\nimport ProductsTab from "@/app/admin/components/ProductsTab";'

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("Added CustomersTab and ProductsTab imports")
else:
    print("WARN: import anchor not found")

# ─── Remove orphaned state & handlers now managed inside child components ──────
# fetchCustomers, openCreateProductModal, openEditProductModal, handleSaveProduct, handleDeleteProduct
# Also remove the state variables for products/customers from parent

# Remove fetchCustomers from parent (it's now in CustomersTab)
# Note: it's still referenced in initial load effect
# Clean initial load effect
old_initial = '''  useEffect(() => {
    if (!authChecking) {
      fetchOrders();
      fetchProducts();
      fetchCustomers();
    }
  }, [authChecking]);'''

new_initial = '''  useEffect(() => {
    if (!authChecking) {
      fetchOrders();
    }
  }, [authChecking]);'''

if old_initial in content:
    content = content.replace(old_initial, new_initial)
    print("Cleaned initial useEffect")
else:
    print("WARN: initial useEffect not found")

# Clean tab-switch effect (customers no longer needs parent fetch)
old_tab = '''  useEffect(() => {
    if (activeTab === "customers") fetchCustomers();
  }, [activeTab]);'''

new_tab = '''  // Child tabs (CustomersTab, ProductsTab, AiTrendsTab, ReportsTab) manage their own data fetching.'''

if old_tab in content:
    content = content.replace(old_tab, new_tab)
    print("Cleaned tab-switch useEffect")
else:
    print("WARN: tab-switch useEffect not found")

with open('src/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/app/admin/page.tsx', encoding='utf-8') as f:
    new_lines = f.readlines()
print(f"\nDone! admin/page.tsx: {total} lines → {len(new_lines)} lines")

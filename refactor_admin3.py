import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/app/admin/page.tsx', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

total = len(lines)
print(f"Total lines: {total}")

# We want to extract ALL Order-related logic.
# Wait, it's easier to just create OrderManagementTab.tsx manually or via script, but since it's 1000+ lines, script is better.

# Let's find the start of GIAO DIEN 1 DASHBOARD
start_idx = -1
for i, line in enumerate(lines):
    if '{/* GIAO DIỆN 1: BẢNG ĐIỀU KHIỂN DASHBOARD (TỔNG QUAN) */}' in line:
        start_idx = i
        break
print(f"Start of Dashboard UI: {start_idx}")

# Inside Dashboard, there is:
# {activeTab === "orders" && ( ... )} -> we extract the inner JSX of this block.
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

orders_start = -1
for i in range(start_idx, len(lines)):
    if 'activeTab === "orders" && (' in lines[i]:
        orders_start = i
        break

orders_end = find_tab_end(lines, orders_start)
print(f"OrdersTab block: {orders_start} to {orders_end}")
orders_jsx = ''.join(lines[orders_start+1:orders_end])

# Now find Operations view
ops_start = -1
for i in range(orders_end, len(lines)):
    if 'adminViewMode === "operations" && (' in lines[i]:
        ops_start = i
        break

ops_end = find_tab_end(lines, ops_start)
print(f"Operations block: {ops_start} to {ops_end}")
ops_jsx = ''.join(lines[ops_start+1:ops_end])

# Modals follow after operations block
modals_start = ops_end + 1
# They end right before the closing </div> of the main return
modals_end = -1
for i in range(len(lines)-1, -1, -1):
    if '  );' in lines[i]:
        modals_end = i - 1
        # also skip closing div
        while '</div>' in lines[modals_end] or lines[modals_end].strip() == '':
            modals_end -= 1
        break
print(f"Modals block: {modals_start} to {modals_end}")
modals_jsx = ''.join(lines[modals_start:modals_end+1])

# Write OrderManagementTab.tsx
order_management_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, Package, ExternalLink, Trash2, Edit3, X, CheckCircle2, AlertCircle, ArrowRight, Truck, Plane, Printer, ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { OrderStatus, StoredOrder } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";

interface OrderManagementTabProps {
  adminViewMode: "dashboard" | "operations";
  activeTab: string;
  externalSearchTerm: string;
  onClearSearch: () => void;
}

export default function OrderManagementTab({ adminViewMode, activeTab, externalSearchTerm, onClearSearch }: OrderManagementTabProps) {
  const { adminToast } = useAdminToast();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("PURCHASING_JP");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateLocation, setUpdateLocation] = useState("Tokyo, Nhật Bản");
  const [jpTrack, setJpTrack] = useState("");
  const [vnTrack, setVnTrack] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [packingSlipOrder, setPackingSlipOrder] = useState<StoredOrder | null>(null);

  // Sync external search term
  useEffect(() => {
    if (externalSearchTerm) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
      adminToast.error("Lỗi tải đơn hàng");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openUpdateModal = (order: StoredOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setJpTrack(order.jpDomesticTrack || "");
    setVnTrack(order.vnDomesticTrack || "");

    if (order.status === "PENDING_DEPOSIT") {
      setNewStatus("PURCHASING_JP");
      setUpdateTitle("Đã nhận cọc - Đang mua hàng tại Tokyo");
      setUpdateDesc("Nhân viên văn phòng Tokyo đã tiến hành order hàng trực tiếp từ người bán.");
      setUpdateLocation("Tokyo, Nhật Bản");
    } else if (order.status === "PURCHASING_JP") {
      setNewStatus("WAREHOUSE_JP");
      setUpdateTitle("Đã nhập kho Tokyo");
      setUpdateDesc("Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.");
      setUpdateLocation("Kho Tokyo (Edogawa-ku)");
    } else if (order.status === "WAREHOUSE_JP") {
      setNewStatus("IN_TRANSIT_AIR");
      setUpdateTitle("Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam");
      setUpdateDesc("Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.");
      setUpdateLocation("Sân bay Quốc tế Narita (NRT)");
    } else if (order.status === "IN_TRANSIT_AIR") {
      setNewStatus("WAREHOUSE_VN");
      setUpdateTitle("Đã nhập kho phân loại tại Việt Nam");
      setUpdateDesc("Hàng hoàn tất thông quan hải quan và chuyển về kho trung chuyển.");
      setUpdateLocation("Kho ChillBanana Hà Nội / TP.HCM");
    } else if (order.status === "WAREHOUSE_VN") {
      setNewStatus("LOCAL_DELIVERY");
      setUpdateTitle("Đang giao hàng chặng cuối");
      setUpdateDesc("Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.");
      setUpdateLocation("Việt Nam");
    } else if (order.status === "LOCAL_DELIVERY") {
      setNewStatus("COMPLETED");
      setUpdateTitle("Giao hàng thành công");
      setUpdateDesc("Khách hàng đã nhận đủ hàng và hoàn tất đơn hàng.");
      setUpdateLocation("Việt Nam");
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          title: updateTitle || "Cập nhật tiến độ đơn hàng",
          description: updateDesc || "Đơn hàng đã chuyển sang trạng thái mới.",
          location: updateLocation || "Việt Nam",
          jpTrack,
          vnTrack,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã cập nhật đơn #${selectedOrder.orderCode} thành công!`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsUpdating(false);
    }
  };

  const openCancelModal = (order: StoredOrder) => {
    setCancelModalOrder(order);
    setCancelReason("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
    setCancelCustomReason("");
    setRefundDeposit(order.paymentStatus !== "UNPAID");
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    setIsCancelling(true);

    const finalReason =
      cancelReason === "Khác" && cancelCustomReason.trim()
        ? cancelCustomReason.trim()
        : cancelReason;

    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          by: "ADMIN",
          reason: finalReason,
          paymentStatus: refundDeposit ? "UNPAID" : cancelModalOrder.paymentStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã hủy đơn hàng #${cancelModalOrder.orderCode} thành công!`);
        setCancelModalOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi khi hủy đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteOrder = async (orderCode: string) => {
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng #${orderCode} khỏi cơ sở dữ liệu?\\nThao tác này sẽ dọn sạch dữ liệu và không thể hoàn tác!`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.error(`Đã xóa vĩnh viễn đơn #${orderCode}!`);
        fetchOrders();
      } else {
        alert("Lỗi khi xóa đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ khi xóa");
    }
  };

  const quickMoveStatus = async (
    orderCode: string,
    nextStatus: OrderStatus,
    title: string,
    desc: string,
    loc: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, title, description: desc, location: loc }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = filterStatus === "ALL" || ord.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      ord.orderCode.toLowerCase().includes(term) ||
      ord.customerName.toLowerCase().includes(term) ||
      (ord.customerEmail && ord.customerEmail.toLowerCase().includes(term)) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.productName.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalVnd, 0);
  const actualRevenue = orders
    .filter((o) => o.paymentStatus !== "UNPAID")
    .reduce((acc, curr) => acc + curr.depositAmountVnd, 0);
  const depositedCount = orders.filter((o) => o.paymentStatus !== "UNPAID").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <>
      {adminViewMode === "dashboard" && activeTab === "orders" && (
''' + orders_jsx + '''      )}

      {adminViewMode === "operations" && (
''' + ops_jsx + '''      )}

''' + modals_jsx + '''
    </>
  );
}
'''
with open('src/app/admin/components/OrderManagementTab.tsx', 'w', encoding='utf-8') as f:
    f.write(order_management_tab)
print("Written: OrderManagementTab.tsx")

# Replace in page.tsx
# We delete everything from orders_start to the end of modals, and replace it with <OrderManagementTab />
# But we must only render <OrderManagementTab /> ONCE, outside the condition of GIAO DIEN 1 vs GIAO DIEN 2, 
# because OrderManagementTab handles BOTH GIAO DIEN 1 and GIAO DIEN 2!
# Actually, wait, page.tsx has:
# {adminViewMode === "dashboard" && (
#    ... headers ...
#    {activeTab === "orders" && ... }
# )}
# {adminViewMode === "operations" && ( ... )}

# We will just replace the {activeTab === "orders" && ( ... )} with nothing (well, actually we must remove it).
# Then replace {adminViewMode === "operations" && ( ... )} and modals with `<OrderManagementTab ... />`.
# Wait, OrderManagementTab needs to be rendered ALWAYS so it can conditionally render dashboard tab or ops view!
# Let's see page.tsx layout:
# return (
#   <div>
#     <header>...</header>
#     <main>
#        {adminViewMode === "dashboard" && (
#            <Sidebar/Tabs>
#            ...
#            {activeTab === "customers" && <CustomersTab/>}
#            {activeTab === "orders" && (OLD ORDERS TAB)}
#        )}
#        {adminViewMode === "operations" && (OLD OPS)}
#        OLD MODALS
#     </main>
#   </div>
# )

# We will remove OLD ORDERS TAB.
# We will insert `<OrderManagementTab ... />` right after the Tabs block (where OLD ORDERS TAB was).
# And we will remove OLD OPS and OLD MODALS.

old_orders_block = ''.join(lines[orders_start:orders_end+1])
old_ops_block = ''.join(lines[ops_start:ops_end+1])
old_modals_block = ''.join(lines[modals_start:modals_end+1])

if old_orders_block in content:
    content = content.replace(old_orders_block, '''        <OrderManagementTab 
          adminViewMode={adminViewMode} 
          activeTab={activeTab} 
          externalSearchTerm={searchTerm} 
          onClearSearch={() => setSearchTerm("")} 
        />\n''')
    print("Replaced old orders block")
else:
    print("Failed to replace old orders block")

if old_ops_block in content:
    content = content.replace(old_ops_block, '')
    print("Removed old ops block")
else:
    print("Failed to remove old ops block")

if old_modals_block in content:
    content = content.replace(old_modals_block, '')
    print("Removed old modals block")
else:
    print("Failed to remove old modals block")

# ─── Add import ───────────────────────────────────────────────────────────────
old_import = 'import ProductsTab from "@/app/admin/components/ProductsTab";'
new_import = old_import + '\nimport OrderManagementTab from "@/app/admin/components/OrderManagementTab";'
if old_import in content:
    content = content.replace(old_import, new_import)
    print("Added import for OrderManagementTab")
else:
    print("Failed to add import")

# ─── Remove orphaned states from page.tsx ─────────────────────────────────────
# const [orders, setOrders]
# const [loadingOrders, setLoadingOrders]
# const [filterStatus, setFilterStatus]
# const [selectedOrder, setSelectedOrder]
# const [newStatus, setNewStatus]
# const [updateTitle, setUpdateTitle]
# const [updateDesc, setUpdateDesc]
# const [updateLocation, setUpdateLocation]
# const [jpTrack, setJpTrack]
# const [vnTrack, setVnTrack]
# const [isUpdating, setIsUpdating]
# const [cancelModalOrder, setCancelModalOrder]
# const [cancelReason, setCancelReason]
# const [cancelCustomReason, setCancelCustomReason]
# const [refundDeposit, setRefundDeposit]
# const [isCancelling, setIsCancelling]
# const [packingSlipOrder, setPackingSlipOrder]

states_to_remove = [
    'const [orders, setOrders]',
    'const [loadingOrders, setLoadingOrders]',
    'const [filterStatus, setFilterStatus]',
    'const [selectedOrder, setSelectedOrder]',
    'const [newStatus, setNewStatus]',
    'const [updateTitle, setUpdateTitle]',
    'const [updateDesc, setUpdateDesc]',
    'const [updateLocation, setUpdateLocation]',
    'const [jpTrack, setJpTrack]',
    'const [vnTrack, setVnTrack]',
    'const [isUpdating, setIsUpdating]',
    'const [cancelModalOrder, setCancelModalOrder]',
    'const [cancelReason, setCancelReason]',
    'const [cancelCustomReason, setCancelCustomReason]',
    'const [refundDeposit, setRefundDeposit]',
    'const [isCancelling, setIsCancelling]',
    'const [packingSlipOrder, setPackingSlipOrder]',
]

lines = content.splitlines(keepends=True)
new_lines = []
skip = False
for line in lines:
    if any(s in line for s in states_to_remove):
        continue
    # Remove fetchOrders function entirely
    # We will just use regex to remove fetchOrders
    new_lines.append(line)

content = ''.join(new_lines)

import re
# Remove fetchOrders function block
content = re.sub(r'  // 2\. Tải danh sách đơn hàng\n  const fetchOrders = async \(\) => \{.*?\n  \};\n', '', content, flags=re.DOTALL)

# Remove handlers
content = re.sub(r'  // Mở modal cập nhật trạng thái đơn\n  const openUpdateModal.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleUpdateStatus = async.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const openCancelModal =.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleCancelOrder = async.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleDeleteOrder = async.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  // Thao tác 1-Click.*?\n  const quickMoveStatus = async.*?\n  \};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const filteredOrders = .*?\n  \}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const totalRevenue = .*?;\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const actualRevenue = .*?\n.*?;\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const depositedCount = .*?;\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const completedCount = .*?;\n', '', content, flags=re.DOTALL)

with open('src/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! OrderManagementTab created.")

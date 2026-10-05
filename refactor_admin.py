import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/app/admin/page.tsx', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

total = len(lines)
print(f"Total lines: {total}")

# ─── 1. Find the boundaries of each tab ──────────────────────────────────────

def find_tab_end(lines, start_line_0idx):
    """
    Given line index where the tab block {activeTab === "x" && ( starts,
    find the line index of the matching closing  )}
    """
    # The pattern is:  {activeTab === "reports" && (
    #                    <div ...>
    #                      ...
    #                    </div>
    #                  )}
    # We track JSX brace depth starting after the opening '('
    depth = 0
    in_block = False
    for i in range(start_line_0idx, len(lines)):
        line = lines[i]
        for ch in line:
            if ch == '(':
                depth += 1
                in_block = True
            elif ch == ')':
                depth -= 1
                if in_block and depth == 0:
                    return i
    return -1

# Find AI trends tab: line 1557 (1-indexed) → 1556 (0-indexed)
ai_start = 1556
ai_end   = find_tab_end(lines, ai_start)
print(f"AI Trends tab: lines {ai_start+1} – {ai_end+1}")

# Find Reports tab: line 1929 (1-indexed) → 1928 (0-indexed)
rep_start = 1928
rep_end   = find_tab_end(lines, rep_start)
print(f"Reports tab: lines {rep_start+1} – {rep_end+1}")

# ─── 2. Extract inner JSX for each tab ───────────────────────────────────────
# Strip the outer wrapper:  {activeTab === "x" && (   ...   )}
# We keep the <div> inside.

def extract_inner(lines, start, end):
    """Lines start..end inclusive (0-indexed). Strip first line (condition) and last line (closing )})."""
    inner = lines[start+1 : end]  # skip first and last line
    return ''.join(inner)

ai_inner   = extract_inner(lines, ai_start, ai_end)
rep_inner  = extract_inner(lines, rep_start, rep_end)

print(f"AI inner lines: {len(ai_inner.splitlines())}")
print(f"Rep inner lines: {len(rep_inner.splitlines())}")

# ─── 3. Write ReportsTab.tsx ─────────────────────────────────────────────────

reports_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, TrendingUp, BarChart3, ShoppingBag, Package, AlertCircle,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

export default function ReportsTab() {
  const { adminToast } = useAdminToast();
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/admin/reports");
      const data = await res.json();
      if (res.ok && data.success) setReportData(data);
    } catch { adminToast.error("Lỗi tải báo cáo"); }
    finally { setLoadingReport(false); }
  };

  const fetchFunnel = async () => {
    setLoadingFunnel(true);
    try {
      const res = await fetch("/api/admin/funnel");
      const data = await res.json();
      if (res.ok && data.success) setFunnelData(data);
    } catch { adminToast.error("Lỗi tải phễu"); }
    finally { setLoadingFunnel(false); }
  };

  useEffect(() => {
    fetchReport();
    fetchFunnel();
  }, []);

  return (
''' + ai_inner.replace('fetchReport', 'fetchReport').replace('fetchFunnel', 'fetchFunnel') + '''  );
}
'''

# Actually, rep_inner is the correct content for reports tab
reports_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, TrendingUp, BarChart3, ShoppingBag, Package, AlertCircle,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

export default function ReportsTab() {
  const { adminToast } = useAdminToast();
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/admin/reports");
      const data = await res.json();
      if (res.ok && data.success) setReportData(data);
    } catch { adminToast.error("Lỗi tải báo cáo"); }
    finally { setLoadingReport(false); }
  };

  const fetchFunnel = async () => {
    setLoadingFunnel(true);
    try {
      const res = await fetch("/api/admin/funnel");
      const data = await res.json();
      if (res.ok && data.success) setFunnelData(data);
    } catch { adminToast.error("Lỗi tải phễu"); }
    finally { setLoadingFunnel(false); }
  };

  useEffect(() => {
    fetchReport();
    fetchFunnel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
''' + rep_inner + '''  );
}
'''

with open('src/app/admin/components/ReportsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(reports_tab)
print("Written: ReportsTab.tsx")

# ─── 4. Read AI Trends inner content ──────────────────────────────────────────
# Extract full AI trends inner content
ai_tab_inner = extract_inner(lines, ai_start, ai_end)

# ─── 5. Write AiTrendsTab.tsx ──────────────────────────────────────────────────
ai_trends_tab = '''"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, MessageSquare, AlertCircle, Eye, X, TrendingUp, Bot,
  BarChart3, Users, ShieldCheck, Sparkles,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

export default function AiTrendsTab() {
  const { adminToast } = useAdminToast();
  const [aiStats, setAiStats] = useState<any>(null);
  const [aiSessions, setAiSessions] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedAiSession, setSelectedAiSession] = useState<any | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatCustomerType, setChatCustomerType] = useState<string>("ALL");
  const [chatDateFrom, setChatDateFrom] = useState("");
  const [chatDateTo, setChatDateTo] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const fetchAiTrends = async () => {
    setLoadingAi(true);
    try {
      const params = new URLSearchParams();
      if (chatSearch) params.append("search", chatSearch);
      if (chatCustomerType !== "ALL") params.append("customerType", chatCustomerType);
      if (chatDateFrom) params.append("dateFrom", chatDateFrom);
      if (chatDateTo) params.append("dateTo", chatDateTo);
      const res = await fetch(`/api/admin/chat-trends?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAiStats(data.stats);
        setAiSessions(data.sessions || []);
      }
    } catch { adminToast.error("Lỗi tải xu hướng AI"); }
    finally { setLoadingAi(false); }
  };

  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      const data = await res.json();
      if (res.ok && data.success) setApiKeyStatus(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchAiTrends();
    fetchApiKeyStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
''' + ai_tab_inner + '''  );
}
'''

with open('src/app/admin/components/AiTrendsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(ai_trends_tab)
print("Written: AiTrendsTab.tsx")

# ─── 6. Replace tabs in admin/page.tsx with component calls ─────────────────

# Replace AI Trends block
ai_tab_block = ''.join(lines[ai_start:ai_end+1])
content = content.replace(
    ai_tab_block,
    '        {activeTab === "ai_trends" && <AiTrendsTab />}\n'
)
print("Replaced AI Trends tab with <AiTrendsTab />")

# Re-read (content may have changed)
# Replace Reports block
rep_tab_block = ''.join(lines[rep_start:rep_end+1])
content = content.replace(
    rep_tab_block,
    '        {activeTab === "reports" && <ReportsTab />}\n'
)
print("Replaced Reports tab with <ReportsTab />")

# ─── 7. Add imports for new components ────────────────────────────────────────
old_import = 'import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";'
new_import = '''import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";
import ReportsTab from "@/app/admin/components/ReportsTab";
import AiTrendsTab from "@/app/admin/components/AiTrendsTab";'''

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("Added imports for ReportsTab and AiTrendsTab")
else:
    print("WARN: Could not find import anchor")

# ─── 8. Remove now-orphaned state variables and fetch functions ──────────────
# These are now managed inside the child components
orphaned_state_blocks = [
    # fetchAiTrends, fetchApiKeyStatus, fetchReport, fetchFunnel
    # We'll remove them from the parent; they're still used by tab-switch useEffect, 
    # so we also need to clean that up.
]

# Remove the tab-switch useEffect calls for ai_trends and reports
old_tab_effect = '''  useEffect(() => {
    if (activeTab === "customers") fetchCustomers();
    if (activeTab === "ai_trends") {
      fetchAiTrends();
      fetchApiKeyStatus();
    }
    if (activeTab === "reports") {
      fetchReport();
      fetchFunnel();
    }
  }, [activeTab]);'''

new_tab_effect = '''  useEffect(() => {
    if (activeTab === "customers") fetchCustomers();
  }, [activeTab]);'''

if old_tab_effect in content:
    content = content.replace(old_tab_effect, new_tab_effect)
    print("Cleaned tab-switch useEffect")
else:
    print("WARN: tab-switch useEffect not found verbatim - checking for variant...")
    # Try without the "ai_trends" and "reports" blocks
    lines2 = content.splitlines()
    for i, line in enumerate(lines2):
        if 'if (activeTab === "ai_trends")' in line:
            print(f"  Found ai_trends check at line {i+1}: {line.strip()}")
        if 'if (activeTab === "reports")' in line:
            print(f"  Found reports check at line {i+1}: {line.strip()}")

# Also remove from initial load useEffect
old_initial_effect = '''  useEffect(() => {
    if (!authChecking) {
      fetchOrders();
      fetchAiTrends();
      fetchProducts();
      fetchCustomers();
      fetchReport();
    }
  }, [authChecking]);'''

new_initial_effect = '''  useEffect(() => {
    if (!authChecking) {
      fetchOrders();
      fetchProducts();
      fetchCustomers();
    }
  }, [authChecking]);'''

if old_initial_effect in content:
    content = content.replace(old_initial_effect, new_initial_effect)
    print("Cleaned initial load useEffect")
else:
    print("WARN: initial load useEffect not found verbatim")

with open('src/app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Count lines now
with open('src/app/admin/page.tsx', encoding='utf-8') as f:
    new_lines = f.readlines()
print(f"\nDone! admin/page.tsx: {total} lines → {len(new_lines)} lines")

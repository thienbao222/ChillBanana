/**
 * ssrf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Chống SSRF — Kiểm tra và chặn các địa chỉ IP nội bộ, loopback, link-local,
 * metadata cloud và các dải địa chỉ riêng tư RFC 1918 (IPv4 & IPv6).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function isPrivateHost(host: string): boolean {
  if (typeof host !== "string") return true;
  const h = host.toLowerCase().trim();
  // Chuẩn hóa: bỏ dấu ngoặc vuông của IPv6 và dấu chấm cuối hostname
  const clean = h.replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (
    clean === "localhost" ||
    clean === "0.0.0.0" ||
    clean === "::" ||
    clean === "::1" ||
    clean.endsWith(".internal") ||
    clean.endsWith(".local") ||
    clean.startsWith("127.") ||     // Toàn bộ dải Loopback IPv4 127.0.0.0/8
    clean.startsWith("10.") ||      // RFC 1918 10.0.0.0/8
    clean.startsWith("192.168.") || // RFC 1918 192.168.0.0/16
    clean.startsWith("169.254.") || // Cloud metadata AWS/GCP/Azure link-local
    clean.startsWith("fe80:") ||    // IPv6 link-local
    clean.startsWith("fc") ||       // IPv6 unique local (fc00::/7)
    clean.startsWith("fd") ||       // IPv6 unique local (fd00::/8)
    clean.startsWith("::ffff:")     // IPv4-mapped IPv6
  ) {
    return true;
  }

  // Dải RFC 1918 172.16.0.0 - 172.31.255.255
  const match172 = clean.match(/^172\.(\d+)\./);
  if (match172) {
    const second = parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  // Dải CGNAT RFC 6598: 100.64.0.0/10 (100.64.0.0 - 100.127.255.255)
  const match100 = clean.match(/^100\.(\d+)\./);
  if (match100) {
    const second = parseInt(match100[1], 10);
    if (second >= 64 && second <= 127) return true;
  }

  return false;
}

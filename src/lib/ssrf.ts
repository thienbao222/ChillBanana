/**
 * ssrf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Chống SSRF — Kiểm tra và chặn các địa chỉ IP nội bộ, loopback, link-local,
 * metadata cloud và các dải địa chỉ riêng tư RFC 1918 (IPv4 & IPv6).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().trim();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".internal") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.") || // Cloud metadata AWS/GCP/Azure
    h.startsWith("fe80:") ||    // IPv6 link-local
    h.startsWith("fc00:") ||    // IPv6 unique local
    h.startsWith("fd00:")
  ) {
    return true;
  }

  // Dải RFC 1918 172.16.0.0 - 172.31.255.255
  const match172 = h.match(/^172\.(\d+)\./);
  if (match172) {
    const second = parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

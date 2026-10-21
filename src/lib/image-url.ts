/**
 * Tiện ích chuẩn hóa và hỗ trợ hình ảnh sản phẩm cho ChillBanana
 * Tự động chuyển đổi liên kết chia sẻ từ Google Drive, Dropbox thành link ảnh trực tiếp
 */

export function normalizeProductImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();

  // 1. Google Drive / Docs links:
  // Định dạng 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Định dạng 2: https://drive.google.com/open?id=FILE_ID
  // Định dạng 3: https://drive.google.com/uc?id=FILE_ID
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    const fileIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // lh3.googleusercontent.com/d/ là CDN chuẩn tốc độ cao của Google Drive
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // 2. Dropbox links: thay thế dl=0 thành raw=1 để hiển thị trực tiếp ảnh
  if (trimmed.includes("dropbox.com")) {
    let direct = trimmed.replace(/[?&]dl=0/, "").replace(/[?&]raw=1/, "");
    direct += direct.includes("?") ? "&raw=1" : "?raw=1";
    return direct;
  }

  return trimmed;
}

export function isGoogleDriveLink(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("drive.google.com") || url.includes("docs.google.com");
}

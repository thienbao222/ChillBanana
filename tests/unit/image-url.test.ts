import { describe, expect, it } from "vitest";
import { normalizeProductImageUrl, isGoogleDriveLink } from "@/lib/image-url";

describe("Product Image URL Normalizer", () => {
  it("converts Google Drive sharing/view link into direct CDN image URL", () => {
    const rawDrive = "https://drive.google.com/file/d/1ZKNNTo17y9XMrdYlk-eiK2AeuKFwLwNo/view?usp=sharing";
    expect(normalizeProductImageUrl(rawDrive)).toBe("https://lh3.googleusercontent.com/d/1ZKNNTo17y9XMrdYlk-eiK2AeuKFwLwNo");
  });

  it("converts Google Drive open?id= link into direct CDN image URL", () => {
    const rawDrive = "https://drive.google.com/open?id=12345abcdef";
    expect(normalizeProductImageUrl(rawDrive)).toBe("https://lh3.googleusercontent.com/d/12345abcdef");
  });

  it("converts Dropbox sharing link dl=0 to raw=1", () => {
    const rawDropbox = "https://www.dropbox.com/s/sample/image.png?dl=0";
    expect(normalizeProductImageUrl(rawDropbox)).toBe("https://www.dropbox.com/s/sample/image.png?raw=1");
  });

  it("preserves standard direct image URLs", () => {
    const normal = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format";
    expect(normalizeProductImageUrl(normal)).toBe(normal);
  });

  it("detects Google Drive links accurately", () => {
    expect(isGoogleDriveLink("https://drive.google.com/file/d/xyz")).toBe(true);
    expect(isGoogleDriveLink("https://images.unsplash.com/photo")).toBe(false);
  });
});

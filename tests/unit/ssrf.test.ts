import { describe, expect, it } from "vitest";
import { isPrivateHost } from "@/lib/ssrf";

describe("SSRF Protection - isPrivateHost", () => {
  it("chặn các địa chỉ loopback và local", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("0.0.0.0")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
    expect(isPrivateHost("app.internal")).toBe(true);
  });

  it("chặn các dải IP riêng tư RFC 1918", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.254")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("192.168.0.254")).toBe(true);

    // Dải 172.16.0.0/12: từ 172.16.x.x đến 172.31.x.x
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.20.10.5")).toBe(true);
    expect(isPrivateHost("172.31.255.254")).toBe(true);

    // Không chặn các IP công cộng ngoài dải 172.16-172.31
    expect(isPrivateHost("172.15.255.255")).toBe(false);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
  });

  it("chặn cloud metadata và IPv6 đặc thù", () => {
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("fe80::1")).toBe(true);
    expect(isPrivateHost("fc00::1")).toBe(true);
    expect(isPrivateHost("fd00::1")).toBe(true);
  });

  it("cho phép các domain thương mại điện tử công cộng", () => {
    expect(isPrivateHost("amazon.co.jp")).toBe(false);
    expect(isPrivateHost("rakuten.co.jp")).toBe(false);
    expect(isPrivateHost("mercari.com")).toBe(false);
    expect(isPrivateHost("yodobashi.com")).toBe(false);
  });
});

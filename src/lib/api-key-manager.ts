export interface KeyEntry {
  keyPreview: string;
  status: "ACTIVE" | "RATE_LIMITED" | "DEAD";
  cooldownUntil: number;
  requestCount: number;
  errorCount: number;
}

export class ApiKeyPool {
  private keys: string[] = [];
  private currentIdx = 0;
  private keyStats = new Map<string, { status: "ACTIVE" | "RATE_LIMITED" | "DEAD", cooldownUntil: number, requestCount: number, errorCount: number }>();
  private envVarName: string;

  constructor(envVarName: string) {
    this.envVarName = envVarName;
    this.loadKeys();
  }

  private loadKeys() {
    const raw = process.env[this.envVarName];
    if (raw) {
      this.keys = raw.split(",").map(k => k.trim()).filter(k => k.length > 0);
    }
    // Fallbacks if empty
    if (this.keys.length === 0) {
      const fallback = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (fallback) this.keys = [fallback.trim()];
    }

    // Initialize stats
    for (const key of this.keys) {
      if (!this.keyStats.has(key)) {
        this.keyStats.set(key, { status: "ACTIVE", cooldownUntil: 0, requestCount: 0, errorCount: 0 });
      }
    }
  }

  public getNextKey(): string | null {
    if (this.keys.length === 0) {
      this.loadKeys();
      if (this.keys.length === 0) return null;
    }

    const now = Date.now();
    let checkedCount = 0;

    while (checkedCount < this.keys.length) {
      const key = this.keys[this.currentIdx];
      const stats = this.keyStats.get(key)!;

      // Reset RATE_LIMITED hoặc DEAD if cooldown is over (P2-02)
      if ((stats.status === "RATE_LIMITED" || stats.status === "DEAD") && now > stats.cooldownUntil) {
        stats.status = "ACTIVE";
      }

      this.currentIdx = (this.currentIdx + 1) % this.keys.length;
      checkedCount++;

      if (stats.status === "ACTIVE") {
        stats.requestCount++;
        return key;
      }
    }

    return null; // All keys are RATE_LIMITED or DEAD
  }

  public markError(key: string, statusCode: number): void {
    const stats = this.keyStats.get(key);
    if (!stats) return;

    stats.errorCount++;

    if (statusCode === 429 || statusCode === 503) {
      stats.status = "RATE_LIMITED";
      stats.cooldownUntil = Date.now() + 60_000; // 60s cooldown
      console.warn(`[ApiKeyPool:${this.envVarName}] Provider temporarily limited request (HTTP ${statusCode}). Cooldown 60s.`);
    } else if (statusCode === 401 || statusCode === 403) {
      // BẢO MẬT (P2-02): Khóa key chết / bị thu hồi với status = 'DEAD' và cooldown 15 phút
      stats.status = "DEAD";
      stats.cooldownUntil = Date.now() + 15 * 60_000;
      console.warn(`[ApiKeyPool:${this.envVarName}] API key revoked or unauthorized (HTTP ${statusCode}). Marked DEAD with 15m cooldown.`);
    } else {
      console.warn(`[ApiKeyPool:${this.envVarName}] Key error (HTTP ${statusCode}).`);
    }
  }

  public getStatus(): KeyEntry[] {
    const now = Date.now();
    return this.keys.map(key => {
      const stats = this.keyStats.get(key)!;
      // Recheck status
      if ((stats.status === "RATE_LIMITED" || stats.status === "DEAD") && now > stats.cooldownUntil) {
        stats.status = "ACTIVE";
      }
      return {
        keyPreview: `...${key.slice(-8)}`,
        status: stats.status,
        cooldownUntil: stats.cooldownUntil,
        requestCount: stats.requestCount,
        errorCount: stats.errorCount
      };
    });
  }
}

export const chatKeyPool = new ApiKeyPool("GEMINI_CHAT_KEYS");
export const scrapeKeyPool = new ApiKeyPool("GEMINI_SCRAPE_KEYS");
export const visionKeyPool = new ApiKeyPool("GEMINI_VISION_KEYS");
export const adminKeyPool = new ApiKeyPool("GEMINI_ADMIN_KEYS");

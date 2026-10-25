import {
  isModelAvailableForKey,
  recordModelQuotaError,
  recordModelSuccess,
  QuotaClassification,
} from "./model-quota";

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

  /**
   * PHẦN 2: Lấy khóa mà cặp (khóa, model) còn khả dụng.
   * Nếu không có khóa nào khả dụng cho model đó thì trả null để vòng lặp chuyển sang model kế tiếp.
   */
  public getNextKey(model?: string): string | null {
    if (this.keys.length === 0) {
      this.loadKeys();
      if (this.keys.length === 0) return null;
    }

    const now = Date.now();
    let checkedCount = 0;

    while (checkedCount < this.keys.length) {
      const key = this.keys[this.currentIdx];
      const stats = this.keyStats.get(key)!;

      // Reset RATE_LIMITED hoặc DEAD nếu cooldown đã hết (P2-02)
      if ((stats.status === "RATE_LIMITED" || stats.status === "DEAD") && now > stats.cooldownUntil) {
        stats.status = "ACTIVE";
      }

      this.currentIdx = (this.currentIdx + 1) % this.keys.length;
      checkedCount++;

      // Khóa bị DEAD do 401/403 thì bỏ qua với mọi model
      if (stats.status === "DEAD") {
        continue;
      }

      // Nếu có truyền model: kiểm tra trạng thái độc lập của cặp (khóa, model)
      if (model) {
        if (!isModelAvailableForKey(key, model, now)) {
          continue; // Khóa này bị rate-limit hoặc hết ngày đối với model này -> thử khóa kế tiếp
        }
      } else {
        // Tương thích ngược: nếu không truyền model thì kiểm tra status toàn cục của khóa
        if (stats.status !== "ACTIVE") {
          continue;
        }
      }

      stats.requestCount++;
      return key;
    }

    return null; // Không có khóa nào khả dụng cho model này
  }

  public getAvailableKey(model?: string): string | null {
    return this.getNextKey(model);
  }

  public hasAvailableKeyForModel(model: string, now = Date.now()): boolean {
    if (this.keys.length === 0) {
      this.loadKeys();
    }
    return this.keys.some((key) => {
      const stats = this.keyStats.get(key);
      if (!stats) return false;
      if (stats.status === "DEAD" && now <= stats.cooldownUntil) return false;
      return isModelAvailableForKey(key, model, now);
    });
  }

  /**
   * Ghi nhận lỗi theo cặp (khóa, model).
   */
  public markModelError(
    key: string,
    model: string,
    statusCode: number,
    bodyOrMessage?: unknown,
    retryAfterSeconds?: string | number | null
  ): QuotaClassification {
    const classification = recordModelQuotaError(key, model, statusCode, bodyOrMessage, retryAfterSeconds);
    const stats = this.keyStats.get(key);
    if (stats) {
      stats.errorCount++;
      if (statusCode === 401 || statusCode === 403) {
        stats.status = "DEAD";
        stats.cooldownUntil = Date.now() + 15 * 60_000;
        console.warn(`[ApiKeyPool:${this.envVarName}] API key revoked or unauthorized (HTTP ${statusCode}). Marked DEAD with 15m cooldown.`);
      }
    }
    return classification;
  }

  public markModelSuccess(key: string, model: string): void {
    recordModelSuccess(key, model);
  }

  public isModelAvailable(key: string, model: string): boolean {
    const stats = this.keyStats.get(key);
    if (!stats) return false;
    const now = Date.now();
    if (stats.status === "DEAD" && now < stats.cooldownUntil) {
      return false;
    }
    return isModelAvailableForKey(key, model, now);
  }

  /**
   * Giữ nguyên hàm cũ để tương thích ngược hoàn toàn với code & tests hiện hữu.
   */
  public markError(key: string, statusCode: number, modelName?: string, retryAfterSeconds?: number): void {
    const stats = this.keyStats.get(key);
    if (!stats) return;

    if (statusCode === 404 || statusCode === 400) {
      console.warn(`[ApiKeyPool:${this.envVarName}] model không khả dụng (HTTP ${statusCode}): ${modelName || "không xác định"}`);
      return;
    }

    stats.errorCount++;

    if (statusCode === 429) {
      let cooldownSec = 30;
      if (typeof retryAfterSeconds === "number" && !isNaN(retryAfterSeconds)) {
        cooldownSec = Math.min(60, Math.max(5, Math.round(retryAfterSeconds)));
      }
      stats.status = "RATE_LIMITED";
      stats.cooldownUntil = Date.now() + cooldownSec * 1000;
      console.warn(`[ApiKeyPool:${this.envVarName}] Provider temporarily limited request (HTTP 429). Cooldown ${cooldownSec}s.`);
    } else if (statusCode === 500 || statusCode === 503) {
      // HTTP 500/503: lỗi tạm thời của model, KHÔNG cooldown khóa
      console.warn(`[ApiKeyPool:${this.envVarName}] Model temporary error (HTTP ${statusCode}). Không cooldown khóa.`);
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

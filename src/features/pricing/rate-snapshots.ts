import { prisma } from "@/lib/prisma";

// Lưu lại mỗi lần lấy tỷ giá thật từ nguồn ngoài (không ghi khi dùng cache hay giá trị dự phòng).
export async function recordExchangeRateSnapshot(input: { rate: number; roundedRate: number; source: string; isFallback: boolean }): Promise<void> {
  try {
    await prisma.exchangeRateSnapshot.create({
      data: { rate: input.rate, roundedRate: input.roundedRate, source: input.source.slice(0, 120), isFallback: input.isFallback },
    });
  } catch (error) {
    console.error("[ExchangeRate] Không lưu được ảnh chụp tỷ giá:", error);
  }
}

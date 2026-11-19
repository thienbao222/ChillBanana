import { prisma } from "@/lib/prisma";
import {
  AgentId,
  ComplianceScreeningResult,
  AgentExecutionResult,
} from "../types";

export class QuarantineComplianceAgent {
  public readonly id: AgentId = "agent:quarantine";
  public readonly name = "AI Quarantine & Aviation Safety Agent";
  public readonly description = "Tác tử Kiểm dịch MAFF Nhật Bản & An ninh Hàng không IATA";

  // Bộ từ khóa MAFF cấm tuyệt đối (Động vật & Thực vật chưa kiểm dịch)
  private readonly MAFF_PROHIBITED_REGEX =
    /(thịt lợn|thịt heo|thịt bò|thịt gà|chà bông|ruốc|xúc xích|lạp xưởng|giò chả|chả lụa|nem chua|pate|bánh trung thu nhân trứng|trứng muối|tổ yến|xoài tươi|sầu riêng|vải thiều|nhãn tươi|thanh long|bưởi|cam tươi|ớt tươi|cây cảnh|hạt giống|đất trồng|hoa tươi)/i;

  // Bộ từ khóa IATA hàng nguy hiểm cấm bay hàng không
  private readonly IATA_DANGEROUS_REGEX =
    /(pin lithium|pin dự phòng|sạc dự phòng|powerbank|bình xịt|bình nén khí|nước hoa|sơn móng tay|cồn|rượu|rưỡu|bật lửa|pháo|chất dễ cháy|thuốc nổ|axit)/i;

  /**
   * Thẩm định tuân thủ kiểm dịch MAFF và an ninh hàng không IATA từ văn bản mô tả.
   */
  public screenTextCompliance(
    text: string,
    dimensions?: { lengthCm?: number; widthCm?: number; heightCm?: number; actualWeightKg?: number }
  ): ComplianceScreeningResult {
    const cleanText = (text || "").trim();
    const maffMatch = cleanText.match(this.MAFF_PROHIBITED_REGEX);
    const iataMatch = cleanText.match(this.IATA_DANGEROUS_REGEX);

    const isMaffProhibited = Boolean(maffMatch);
    const isIataDangerous = Boolean(iataMatch);

    let riskLevel: ComplianceScreeningResult["riskLevel"] = "SAFE";
    if (isMaffProhibited || isIataDangerous) {
      riskLevel = "PROHIBITED";
    }

    const flaggedKeywords: string[] = [];
    const regulationsViolated: string[] = [];

    if (isMaffProhibited && maffMatch) {
      flaggedKeywords.push(maffMatch[0]);
      regulationsViolated.push(
        "Luật Kiểm dịch Động Thực vật MAFF Nhật Bản (Animal & Plant Quarantine Act) — Cấm mang thực phẩm từ thịt, trứng hoặc nông sản tươi chưa qua kiểm dịch chính ngạch."
      );
    }

    if (isIataDangerous && iataMatch) {
      flaggedKeywords.push(iataMatch[0]);
      regulationsViolated.push(
        "Quy định Vận chuyển Hàng không Dân dụng IATA DGR (Dangerous Goods Regulations) — Cấm vận chuyển pin lithium rời, bình nén khí, chất lỏng dễ cháy trong khoang áp suất."
      );
    }

    // Tính toán quy chuẩn thể tích IATA: (D x R x C) / 5000
    const l = dimensions?.lengthCm || 25;
    const w = dimensions?.widthCm || 20;
    const h = dimensions?.heightCm || 15;
    const actualW = dimensions?.actualWeightKg || 0.5;

    const volumetricWeightKg = Math.round(((l * w * h) / 5000) * 100) / 100;
    const chargeableWeightKg = Math.max(actualW, volumetricWeightKg);

    let suggestedBox: ComplianceScreeningResult["volumetricIata"]["suggestedBox"] = "BOX_S";
    if (chargeableWeightKg > 5 || l > 40 || w > 35 || h > 30) {
      suggestedBox = "BOX_L";
    } else if (chargeableWeightKg > 2 || l > 30 || w > 25 || h > 20) {
      suggestedBox = "BOX_M";
    }

    // Tra cứu mã HS Code gợi ý
    let hsCodeSuggested = "9801.00"; // Hàng tổng hợp tiêu dùng cá nhân
    if (/mỹ phẩm|son môi|kem dưỡng|skincare/i.test(cleanText)) {
      hsCodeSuggested = "3304.99";
    } else if (/quần áo|áo thun|váy|áo khoác/i.test(cleanText)) {
      hsCodeSuggested = "6109.10";
    } else if (/mô hình|figure|anime|manga|gundam/i.test(cleanText)) {
      hsCodeSuggested = "9503.00";
    } else if (/bánh|kẹo|trà|cà phê/i.test(cleanText)) {
      hsCodeSuggested = "2106.90";
    }

    return {
      targetId: "direct_text_screening",
      isCompliant: riskLevel === "SAFE",
      riskLevel,
      maffStatus: {
        isMaffProhibited,
        flaggedKeywords,
        regulationsViolated,
        actionRequiredVi: isMaffProhibited
          ? "BẮT BUỘC LOẠI BỎ mặt hàng thực phẩm cấm khỏi kiện hàng trước khi xuất kho bay."
          : "Đạt chuẩn kiểm dịch MAFF.",
      },
      iataStatus: {
        isIataDangerousGoods: isIataDangerous,
        batteryDetected: /(pin|battery|powerbank|sạc dự phòng)/i.test(cleanText),
        flammableDetected: /(cồn|rượu|nước hoa|sơn móng tay|dễ cháy)/i.test(cleanText),
        pressureDetected: /(bình xịt|bình nén|bọt cạo râu)/i.test(cleanText),
        hazmatCategory: isIataDangerous ? "IATA Class 9 / Class 3" : undefined,
      },
      volumetricIata: {
        actualWeightKg: actualW,
        dimensionsCm: { length: l, width: w, height: h },
        volumetricWeightKg,
        chargeableWeightKg,
        suggestedBox,
      },
      hsCodeSuggested,
      cn23Declaration: {
        category: "GIFT",
        englishDescription: cleanText.slice(0, 50) || "Personal Consumer Goods",
        hsCode: hsCodeSuggested,
        originCountry: "JP",
        weightKg: chargeableWeightKg,
        valueJpy: 5000,
      },
    };
  }

  /**
   * Rà soát tuân thủ cho một Đơn hàng mua hộ cụ thể từ cơ sở dữ liệu.
   */
  public async inspectOrderCompliance(orderId: string): Promise<AgentExecutionResult<ComplianceScreeningResult>> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      return {
        success: false,
        agentId: this.id,
        action: "SCREEN_COMPLIANCE",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Không tìm thấy đơn hàng ID: ${orderId}`,
      };
    }

    const itemsText = [
      order.productName,
      order.customerNote || "",
      order.adminNote || "",
      ...order.orderItems.map((i) => i.productName),
    ].join(" ");

    const screening = this.screenTextCompliance(itemsText, {
      actualWeightKg: order.weightKg,
    });
    screening.targetId = order.id;

    const warnings: string[] = [];
    if (!screening.isCompliant) {
      warnings.push(...screening.maffStatus.regulationsViolated);
      warnings.push(...screening.iataStatus.hazmatCategory ? [`Phát hiện hàng nguy hiểm: ${screening.iataStatus.hazmatCategory}`] : []);
    }

    return {
      success: true,
      agentId: this.id,
      action: "SCREEN_COMPLIANCE",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: screening.isCompliant
        ? `Đơn hàng #${order.orderCode} AN TOÀN 100% — Đạt tiêu chuẩn kiểm dịch MAFF và An ninh Hàng không IATA.`
        : `CẢNH BÁO ĐỎ: Đơn hàng #${order.orderCode} chứa mặt hàng vi phạm MAFF/IATA (${screening.maffStatus.flaggedKeywords.join(", ")}).`,
      details: screening,
      warnings: warnings.length > 0 ? warnings : undefined,
      recommendations: screening.isCompliant
        ? [`Đề xuất đóng gói: ${screening.volumetricIata.suggestedBox}`, `Cân nặng tính cước: ${screening.volumetricIata.chargeableWeightKg} kg`]
        : [screening.maffStatus.actionRequiredVi, "Liên hệ khách hàng để tách kiện hoặc loại bỏ sản phẩm cấm"],
    };
  }

  /**
   * Thẩm định quy chuẩn cân nặng & kích thước IATA.
   */
  public calculateIataVolumetric(
    actualWeightKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number
  ) {
    const volumetricWeightKg = Math.round(((lengthCm * widthCm * heightCm) / 5000) * 100) / 100;
    const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
    const isVolumetricHigher = volumetricWeightKg > actualWeightKg;

    let suggestedBox: "BOX_S" | "BOX_M" | "BOX_L" | "CUSTOM" = "BOX_S";
    if (chargeableWeightKg > 5 || lengthCm > 40) {
      suggestedBox = "BOX_L";
    } else if (chargeableWeightKg > 2 || lengthCm > 30) {
      suggestedBox = "BOX_M";
    }

    return {
      actualWeightKg,
      dimensionsCm: { length: lengthCm, width: widthCm, height: heightCm },
      volumetricWeightKg,
      chargeableWeightKg,
      isVolumetricHigher,
      weightDifferenceKg: Math.abs(volumetricWeightKg - actualWeightKg),
      suggestedBox,
    };
  }
}

export const quarantineAgent = new QuarantineComplianceAgent();

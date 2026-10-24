import { prisma } from "@/lib/prisma";
import { adminKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { ORDER_STATUS_LABELS_VI } from "@/features/orders/policy";

export type ControlledDraftType = "price_verification" | "delay_apology" | "status_adjustment";

export interface EmailTemplateDraft {
  subject: string;
  body: string;
}

export interface EmailInterpolationContext {
  customerName: string;
  orderCode: string;
  statusLabel: string;
}

export const CONTROLLED_DRAFT_DESCRIPTIONS: Record<ControlledDraftType, string> = {
  price_verification: "Xác nhận giá đã duyệt và đề nghị khách đặt cọc",
  delay_apology: "Thư xin lỗi về việc chậm trễ tiến độ vận chuyển / thông quan",
  status_adjustment: "Thông báo cập nhật điều chỉnh trạng thái đơn hàng",
};

export const FALLBACK_EMAIL_TEMPLATES: Record<ControlledDraftType, EmailTemplateDraft> = {
  price_verification: {
    subject: "[ChillBanana] Xác nhận báo giá đơn hàng #{{orderCode}}",
    body: `Kính gửi Quý khách {{customerName}},

ChillBanana xin thông báo đơn hàng #{{orderCode}} của Quý khách đã được hoàn tất việc xác minh giá và phụ phí từ sàn Nhật Bản.

Trạng thái hiện tại của đơn hàng là: {{statusLabel}}.
Quý khách vui lòng kiểm tra chi tiết giá đơn hàng trên hệ thống và hoàn tất đặt cọc để nhân viên tại Nhật Bản tiến hành mua hàng sớm nhất.

Nếu có bất kỳ câu hỏi nào, xin vui lòng phản hồi email này hoặc liên hệ hotline ChillBanana để được hỗ trợ tức thì.

Trân trọng,
Đội ngũ CSKH ChillBanana`,
  },
  delay_apology: {
    subject: "[ChillBanana] Thư xin lỗi về việc chậm tiến độ đơn hàng #{{orderCode}}",
    body: `Kính gửi Quý khách {{customerName}},

ChillBanana thành thật xin lỗi Quý khách vì sự chậm trễ trong tiến độ xử lý đơn hàng #{{orderCode}}.

Hiện tại đơn hàng đang ở chặng: {{statusLabel}}. Do chuyến bay vận chuyển hàng không và thủ tục kiểm dịch thông quan có phát sinh kiểm tra định kỳ, thời gian giao hàng dự kiến sẽ kéo dài hơn kế hoạch ban đầu từ 2-3 ngày làm việc.

Đội ngũ ChillBanana đang theo sát quá trình thông quan và sẽ cập nhật mã vận đơn nội địa ngay khi kiện hàng hoàn tất phân loại tại kho Việt Nam.

Rất mong Quý khách thông cảm cho sự bất tiện ngoài ý muốn này.

Trân trọng,
Đội ngũ Vận hành ChillBanana`,
  },
  status_adjustment: {
    subject: "[ChillBanana] Thông báo điều chỉnh trạng thái đơn hàng #{{orderCode}}",
    body: `Kính gửi Quý khách {{customerName}},

ChillBanana xin thông báo đơn hàng #{{orderCode}} của Quý khách vừa được cập nhật điều chỉnh trạng thái mới nhất: {{statusLabel}}.

Quý khách có thể theo dõi hành trình chi tiết của kiện hàng bất cứ lúc nào tại trang Tra Cứu Đơn Hàng trên website ChillBanana.

Cảm ơn Quý khách đã tin tưởng và đồng hành cùng dịch vụ mua hộ ChillBanana!

Trân trọng,
Đội ngũ CSKH ChillBanana`,
  },
};

/**
 * Điền dữ liệu thật vào các chỗ giữ (placeholders).
 * Hàm thuần túy, an toàn, dễ kiểm thử độc lập.
 */
export function interpolateEmailTemplate(
  template: EmailTemplateDraft,
  context: EmailInterpolationContext
): EmailTemplateDraft {
  const replaceAll = (text: string) =>
    text
      .replaceAll("{{customerName}}", context.customerName)
      .replaceAll("{{orderCode}}", context.orderCode)
      .replaceAll("{{statusLabel}}", context.statusLabel);

  return {
    subject: replaceAll(template.subject),
    body: replaceAll(template.body),
  };
}

/**
 * AI soạn thảo bản mẫu email chứa các chỗ giữ {{customerName}}, {{orderCode}}, {{statusLabel}}.
 * AI KHÔNG được điền dữ liệu thật của khách vào bước này để tránh rò rỉ dữ liệu.
 */
export async function draftCustomerEmailTemplate(
  draftType: ControlledDraftType,
  orderCode: string,
  customInstructions?: string
): Promise<EmailTemplateDraft> {
  const fallback = FALLBACK_EMAIL_TEMPLATES[draftType];
  const typeDescription = CONTROLLED_DRAFT_DESCRIPTIONS[draftType] || draftType;

  const apiKey = adminKeyPool.getNextKey();
  if (!apiKey) {
    return fallback;
  }

  try {
    const prompt = `Bạn là Trợ lý soạn thảo email cho quản trị viên ChillBanana (dịch vụ mua hộ hàng Nhật Bản).
Nhiệm vụ: Soạn thảo bản mẫu email gửi khách hàng cho mục đích: "${typeDescription}".
Mã đơn tham chiếu: ${orderCode}.
Chỉ dẫn bổ sung từ Admin: "${customInstructions || "Không có"}".

QUY TẮC BẮT BUỘC:
1. BẮT BUỘC sử dụng đúng 3 chỗ giữ sau đây trong nội dung (không tự thay thế bằng tên thật):
   - {{customerName}}: Tên khách hàng
   - {{orderCode}}: Mã đơn hàng
   - {{statusLabel}}: Nhãn trạng thái đơn hàng
2. Văn phong lịch sự, trang trọng, chuẩn dịch vụ khách hàng Nhật Bản (Omotenashi), thể hiện sự chu đáo và minh bạch.
3. Độ dài ngắn gọn: 3-5 đoạn súc tích.
4. Trả về ĐÚNG ĐỊNH DẠNG JSON duy nhất (không kèm markdown bên ngoài):
{"subject": "Tiêu đề email chứa #{{orderCode}}", "body": "Nội dung email..."}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.lightweight}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
          },
        }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
          return {
            subject: parsed.subject.trim(),
            body: parsed.body.trim(),
          };
        }
      }
    }
  } catch {
    // Silent fallback to standard template
  }

  return fallback;
}

/**
 * Quy trình soạn thảo có kiểm soát:
 * 1. Đọc dữ liệu đơn thật từ Database.
 * 2. Yêu cầu AI soạn bản mẫu có placeholders.
 * 3. Server điền dữ liệu thật vào placeholders.
 * 4. Trả về cho Admin xem và chỉnh sửa trước khi gửi.
 */
export async function prepareControlledCustomerEmail(
  orderCode: string,
  draftType: ControlledDraftType,
  customInstructions?: string
) {
  const order = await prisma.order.findUnique({
    where: { orderCode },
    select: {
      id: true,
      orderCode: true,
      customerName: true,
      customerEmail: true,
      status: true,
    },
  });

  if (!order) {
    throw new Error(`Không tìm thấy đơn hàng #${orderCode}`);
  }

  const statusLabel = ORDER_STATUS_LABELS_VI[order.status] || order.status;

  // 1. AI soạn template có placeholders
  const template = await draftCustomerEmailTemplate(draftType, orderCode, customInstructions);

  // 2. Server điền dữ liệu thật
  const interpolated = interpolateEmailTemplate(template, {
    customerName: order.customerName || "Quý khách",
    orderCode: order.orderCode,
    statusLabel,
  });

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    statusLabel,
    draftType,
    template,
    draftSubject: interpolated.subject,
    draftBody: interpolated.body,
  };
}

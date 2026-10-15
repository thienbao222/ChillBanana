import crypto from "node:crypto";

// Tái hiện thuật toán ký của VNPAY độc lập với mã nguồn (để test không tự "đúng theo chính nó").
export function signVnpay(params: Record<string, string>, secret: string): string {
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`)
    .join("&");
  return crypto.createHmac("sha512", secret).update(qs, "utf8").digest("hex");
}

export function ipnPath(
  fields: { orderCode: string; amountVnd: number; txnNo?: string; responseCode?: string; status?: string },
  secret = process.env.VNPAY_HASH_SECRET ?? ""
): string {
  const params: Record<string, string> = {
    vnp_TmnCode: process.env.VNPAY_TMN_CODE ?? "TESTTMN1",
    vnp_TxnRef: fields.orderCode,
    vnp_Amount: String(fields.amountVnd * 100),
    vnp_TransactionNo: fields.txnNo ?? "TXN0001",
    vnp_ResponseCode: fields.responseCode ?? "00",
    vnp_TransactionStatus: fields.status ?? "00",
    vnp_PayDate: "20261015120000",
    vnp_OrderInfo: `Thanh toan don hang ${fields.orderCode}`,
  };
  const query = new URLSearchParams({ ...params, vnp_SecureHash: signVnpay(params, secret) });
  return `/api/payment/vnpay-ipn?${query.toString()}`;
}

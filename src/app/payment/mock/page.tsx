import { notFound } from "next/navigation";
import { isMockSandboxAllowed } from "@/features/payments/sandbox-guard";
import MockPaymentClient from "./MockPaymentClient";

export const dynamic = "force-dynamic";

export default function MockPaymentPage() {
  if (!isMockSandboxAllowed()) {
    notFound();
  }

  return <MockPaymentClient />;
}

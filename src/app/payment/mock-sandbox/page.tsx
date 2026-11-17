import { notFound } from "next/navigation";
import { isMockSandboxAllowed } from "@/features/payments/sandbox-guard";
import MockSandboxClient from "./MockSandboxClient";

export const dynamic = "force-dynamic";

export default function MockSandboxPage() {
  if (!isMockSandboxAllowed()) {
    notFound();
  }

  return <MockSandboxClient />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentResult } from "@/components/features/student-hub/PaymentResult";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Payment — Student Hub" };
export const dynamic = "force-dynamic";

/**
 * Alipay's return URL.
 *
 * Deliberately thin: it reads a reference from the query string and hands it
 * to a component that asks Kondo what actually happened. Nothing here inspects
 * what Alipay appended to the URL, because a browser returning from a gateway
 * is not evidence of a payment.
 */
export default async function BookPaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; out_trade_no?: string }>;
}) {
  await requireUser();
  const query = await searchParams;
  // Alipay echoes `out_trade_no` on the return; our own parameter wins when
  // both are present.
  const reference = (query.reference ?? query.out_trade_no ?? "").trim();
  if (!reference) redirect("/student-hub/books");

  return <PaymentResult reference={reference} />;
}

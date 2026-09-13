import type { Metadata } from "next";

import { db } from "@/lib/db";
import { siteHost } from "@/lib/site";
import ReceiptClient from "./receipt-client";

/**
 * Struk digital. Dibuka lewat tautan yang dikirim ke pelanggan, jadi tanpa
 * login. Data diambil di server; browser hanya menerima isi struknya.
 */

export const metadata: Metadata = {
  title: "Struk Digital",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const data = isUuid ? await db.getOrderById(id) : null;

  if (!data) {
    return <ReceiptClient data={null} staffName={null} hasFeedback={false} reviewUrl={null} receiptUrl="" memberCardUrl={null} />;
  }

  const [users, hasFeedback, reviewUrl] = await Promise.all([
    db.getUsers(data.order.business_id),
    db.hasFeedback(id),
    db.getReviewDestinationUrl(data.order.business_id),
  ]);
  const staffName = users.find((u) => u.id === data.order.created_by)?.name ?? null;
  const receiptUrl = `https://${siteHost}/receipt/${id}`;
  const memberCardUrl = data.customer?.token ? `https://${siteHost}/m/${data.customer.token}` : null;

  return (
    <ReceiptClient
      data={data}
      staffName={staffName}
      hasFeedback={hasFeedback}
      reviewUrl={reviewUrl}
      receiptUrl={receiptUrl}
      memberCardUrl={memberCardUrl}
    />
  );
}

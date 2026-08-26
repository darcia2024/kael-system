import type { Metadata } from "next";

import { db } from "@/lib/db";
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
  const data = await db.getOrderById(id);

  if (!data) {
    return <ReceiptClient data={null} staff={null} />;
  }

  const users = await db.getUsers(data.order.business_id);
  const staff = users.find((u) => u.id === data.order.created_by) ?? null;

  return <ReceiptClient data={data} staff={staff} />;
}

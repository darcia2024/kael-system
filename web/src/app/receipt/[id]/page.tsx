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
    return <ReceiptClient data={null} staffName={null} />;
  }

  /**
   * Yang diteruskan hanya NAMA kasirnya.
   *
   * Halaman ini terbuka tanpa login — tautannya memang diberikan ke pelanggan.
   * Versi sebelumnya meneruskan objek pengguna utuh padahal yang dipakai cuma
   * `name`, dan objek itu ikut terserialisasi ke HTML, membawa serta hash PIN
   * kasir beserta salt-nya ke tangan siapa pun yang memegang tautan struk.
   */
  const users = await db.getUsers(data.order.business_id);
  const staffName = users.find((u) => u.id === data.order.created_by)?.name ?? null;

  return <ReceiptClient data={data} staffName={staffName} />;
}

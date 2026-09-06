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
  const data = await db.getOrderById(id);

  if (!data) {
    return <ReceiptClient data={null} staffName={null} hasFeedback={false} reviewUrl={null} receiptUrl="" />;
  }

  /**
   * Yang diteruskan hanya NAMA kasirnya.
   *
   * Halaman ini terbuka tanpa login — tautannya memang diberikan ke pelanggan.
   * Versi sebelumnya meneruskan objek pengguna utuh padahal yang dipakai cuma
   * `name`, dan objek itu ikut terserialisasi ke HTML, membawa serta hash PIN
   * kasir beserta salt-nya ke tangan siapa pun yang memegang tautan struk.
   */
  const [users, hasFeedback, reviewUrl] = await Promise.all([
    db.getUsers(data.order.business_id),
    db.hasFeedback(id),
    db.getReviewDestinationUrl(data.order.business_id),
  ]);
  const staffName = users.find((u) => u.id === data.order.created_by)?.name ?? null;

  /**
   * Tautan struk dibangun di SERVER, bukan dari window.location di klien.
   *
   * Versi sebelumnya memakai `typeof window !== "undefined" ? ... : ""`, yang
   * berarti HTML yang dikirim server memuat pesan WhatsApp TANPA tautan
   * struknya. Siapa pun yang menekan "Kirim WhatsApp" sebelum React selesai
   * hydrate mengirim struk kosong ke pelanggan, dan "Salin Tautan" menyalin
   * string kosong. Alamatnya sudah pasti dari id pesanan, jadi tidak ada
   * alasan menunggu browser untuk mengetahuinya.
   */
  const receiptUrl = `https://${siteHost}/receipt/${id}`;

  return (
    <ReceiptClient
      data={data}
      staffName={staffName}
      hasFeedback={hasFeedback}
      reviewUrl={reviewUrl}
      receiptUrl={receiptUrl}
    />
  );
}

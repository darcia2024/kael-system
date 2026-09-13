"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Share2,
  Printer,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Star,
  Sparkles
} from "lucide-react";
import type { Order, OrderItem, Customer, Business, FeedbackReasonCode } from "@/lib/types";
import { FEEDBACK_REASONS } from "@/lib/types";
import { generateWhatsAppReceiptMessage, serviceTypeLabel } from "@/lib/pos-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { submitFeedbackAction } from "@/lib/actions";
import { isMochiBusiness } from "@/lib/mochi-brand";

export interface ReceiptPageData {
  data:
    | {
        order: Order;
        items: OrderItem[];
        customer: Customer | null;
        business: Business | null;
      }
    | null;
  /** Nama kasir saja. Objek pengguna tidak pernah menyeberang ke sini. */
  staffName: string | null;
  /**
   * True kalau pesanan ini sudah pernah diberi feedback. Halaman menampilkan
   * ucapan terima kasih dan MENYEMBUNYIKAN formulirnya — bukan menampilkan
   * ulang rating atau komentarnya. Tautan struk bisa diteruskan ke siapa saja.
   */
  hasFeedback: boolean;
  /** URL kartu ulasan Google aktif toko ini. Null kalau belum ada. */
  reviewUrl: string | null;
  /** Alamat struk ini, dibangun di server supaya sama persis di HTML awal dan sesudah hydrate. */
  receiptUrl: string;
  /** Hanya ada untuk transaksi yang memang terikat pada member. */
  memberCardUrl: string | null;
}

export default function DigitalReceiptPage({ data, staffName, hasFeedback, reviewUrl, receiptUrl, memberCardUrl }: ReceiptPageData) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState<FeedbackReasonCode | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(hasFeedback);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!data || !data.order || !data.business) {
    return (
      <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#feebee] text-[#ef4444] border-2 border-[#ef4444]">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-[#232331]">Struk Tidak Ditemukan</h1>
            <p className="text-xs text-[#7b7b8e]">
              Nomor transaksi ini tidak ditemukan di sistem kasir toko.
            </p>
          </div>
          <Link
            href="/app/pos"
            className="btn-tactile inline-flex w-full items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#d9ff57] py-3 text-xs font-black text-[#232331]"
          >
            Kembali ke Kasir
          </Link>
        </div>
      </div>
    );
  }

  const { order, items, customer, business } = data;
  const isMochi = isMochiBusiness(business);

  const waShareMessage = encodeURIComponent(generateWhatsAppReceiptMessage({
    businessName: business.name,
    orderNo: order.order_no,
    createdAtLabel: formatBusinessDateTime(order.created_at, business.timezone),
    serviceLabel: serviceTypeLabel(order.service_type, order.table_no),
    cashierName: staffName,
    items: items.map((item) => ({ name: item.name_snapshot, qty: item.qty, price: item.price_snapshot, note: item.note })),
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    serviceCharge: order.service_charge,
    deliveryFee: order.delivery_fee,
    total: order.total,
    paymentMethod: order.payment_method,
    cashGiven: order.cash_given,
    cashChange: order.cash_change,
    receiptUrl,
    memberCardUrl,
  }));

  const handlePrint = () => {
    window.print();
  };

  const canGiveFeedback = order.status === "paid" || order.status === "refunded";

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    setFeedbackError(null);
    setSubmittingFeedback(true);
    const res = await submitFeedbackAction({
      orderId: order.id,
      rating,
      reasonCode: reasonCode ?? undefined,
      comment: feedbackComment.trim() || undefined,
    });
    setSubmittingFeedback(false);
    if (!res.ok) {
      setFeedbackError(res.error);
      return;
    }
    setFeedbackSubmitted(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(receiptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`kael-thermal-receipt min-h-screen ${isMochi ? "bg-[#07281e] text-[#1c2d26]" : "bg-[#f7f6fc] text-[#232331]"} font-sans flex flex-col justify-between max-w-md mx-auto p-4 sm:p-6 print:p-0 print:max-w-none print:bg-white`}>
      <style jsx global>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { width: 80mm !important; min-height: 0 !important; background: #fff !important; }
          .kael-thermal-receipt { width: 72mm !important; max-width: 72mm !important; min-height: 0 !important; margin: 0 auto !important; padding: 3mm 0 5mm !important; background: #fff !important; }
          .kael-thermal-receipt .shadow-ink-lg, .kael-thermal-receipt .shadow-ink-md, .kael-thermal-receipt .shadow-ink-xs { box-shadow: none !important; }
        }
      `}</style>
      
      {/* Top Floating Action Bar (Hidden in Print) */}
      <div className="flex items-center justify-between gap-2 pb-4 print:hidden">
        <Link
          href="/app/pos"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            isMochi
              ? "border border-emerald-600/40 bg-[#0b3d2e] text-white hover:bg-emerald-800"
              : "border border-[#232331] bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
          }`}
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/?text=${waShareMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn-tactile flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-black transition-all ${
              isMochi
                ? "border-0 bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-sm"
                : "border-2 border-[#16a34a] bg-[#dcfce7] text-[#16a34a] shadow-ink-xs"
            }`}
          >
            <Share2 size={13} />
            <span>Kirim WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className={`btn-tactile flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-black transition-all ${
              isMochi
                ? "border border-emerald-600/40 bg-[#0b3d2e] text-white hover:bg-emerald-800 shadow-sm"
                : "border-2 border-[#232331] bg-[#232331] text-white shadow-ink-xs"
            }`}
          >
            <Printer size={13} />
            <span>Cetak 80mm</span>
          </button>
        </div>
      </div>

      {/* Mochi Member Callout Banner */}
      {isMochi && (customer || memberCardUrl) && (
        <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-[#0b3d2e] p-4 text-white shadow-lg flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#0b3d2e]">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#c8f53a]">Member Mochi Cafe</span>
              <p className="text-sm font-black text-white">{customer?.name ?? "Pelanggan Setia"}</p>
              <p className="text-[10px] text-emerald-200/80">Poin pesanan ini otomatis tercatat di kartu!</p>
            </div>
          </div>
          {memberCardUrl && (
            <Link
              href={memberCardUrl}
              className="shrink-0 rounded-xl bg-[#c8f53a] px-3 py-2 text-xs font-black text-[#0b3d2e] hover:bg-[#d9ff57] transition-all shadow-sm"
            >
              Buka Kartu
            </Link>
          )}
        </div>
      )}

      {/* TACTILE PAPER RECEIPT CARD */}
      <div className={`rounded-3xl border-2 ${isMochi ? "border-emerald-700/50" : "border-[#232331]"} bg-white p-6 shadow-ink-lg space-y-4 font-mono text-xs relative overflow-hidden print:border-none print:shadow-none print:p-0`}>
        
        {/* Top Shop Header */}
        <div className="text-center space-y-1 border-b-2 border-dashed border-[#232331] pb-4">
          <BusinessMark
            name={business.name}
            logoUrl={business.logo_url}
            brandColor={business.brand_color}
            size="lg"
            className="rounded-2xl border border-[#232331]"
          />
          <h2 className="text-base font-black text-[#232331] uppercase tracking-wider font-sans mt-1">
            {business.name}
          </h2>
          <p className="text-[10px] text-[#7b7b8e]">{business.address}</p>
          <p className="text-[10px] text-[#7b7b8e]">Telp/WA: {business.phone}</p>
        </div>

        {/* Order Meta */}
        <div className="space-y-1 text-[11px] border-b border-[#dedee8] pb-3">
          <div className="flex justify-between">
            <span className="text-[#7b7b8e]">No. Pesanan:</span>
            <span className="font-extrabold text-[#232331]">{order.order_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7b7b8e]">Waktu:</span>
            <span>{formatBusinessDateTime(order.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7b7b8e]">Tipe Layanan:</span>
            <span className="font-bold text-[#7958d8]">
              {serviceTypeLabel(order.service_type, order.table_no)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7b7b8e]">Kasir:</span>
            <span>{staffName || "Kasir KAEL"}</span>
          </div>
          {customer && (
            <div className="flex justify-between pt-1 border-t border-[#dedee8]">
              <span className="text-[#7b7b8e]">Member Loyalty:</span>
              <span className="font-extrabold text-[#16a34a]">{customer.name} (Poin Masuk ✓)</span>
            </div>
          )}
        </div>

        {/* Itemized Breakdown */}
        <div className="space-y-2 border-b-2 border-dashed border-[#232331] pb-3">
          {items.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[#232331] font-sans">{item.name_snapshot}</span>
                <span className="font-extrabold text-[#232331]">{formatRupiah(item.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-[#7b7b8e]">
                <span>{item.qty}x @{formatRupiah(item.price_snapshot)}</span>
                {item.note && <span className="italic text-[#7958d8]">* {item.note}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-[#7b7b8e]">
            <span>Subtotal</span>
            <span>{formatRupiah(order.subtotal)}</span>
          </div>

          {order.discount > 0 && (
            <div className="flex justify-between text-[#ef4444] font-bold">
              <span>Diskon</span>
              <span>-{formatRupiah(order.discount)}</span>
            </div>
          )}

          {order.service_charge > 0 && (
            <div className="flex justify-between text-[#7b7b8e]">
              <span>Service Charge</span>
              <span>{formatRupiah(order.service_charge)}</span>
            </div>
          )}

          {order.tax > 0 && (
            <div className="flex justify-between text-[#7b7b8e]">
              <span>Pajak Restoran</span>
              <span>{formatRupiah(order.tax)}</span>
            </div>
          )}

          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-[#7b7b8e]">
              <span>Ongkir</span>
              <span>{formatRupiah(order.delivery_fee)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-black text-[#232331] border-t-2 border-[#232331] pt-2">
            <span>TOTAL BAYAR</span>
            <span className={isMochi ? "text-[#0b3d2e] font-black" : "text-[#16a34a]"}>{formatRupiah(order.total)}</span>
          </div>

          <div className="flex justify-between text-[11px] pt-1">
            <span className="text-[#7b7b8e]">Metode Bayar:</span>
            <span className="font-bold text-[#232331] uppercase">{order.payment_method}</span>
          </div>

          {order.payment_method === "cash" && order.cash_given && (
            <>
              <div className="flex justify-between text-[11px] text-[#7b7b8e]">
                <span>Uang Tunai:</span>
                <span>{formatRupiah(order.cash_given)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-[#232331]">
                <span>Kembalian:</span>
                <span>{formatRupiah(order.cash_change || 0)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Greetings */}
        <div className="text-center pt-3 border-t-2 border-dashed border-[#232331] text-[10px] text-[#7b7b8e] space-y-1">
          <p className="font-bold text-[#232331]">Terima Kasih Atas Kunjungan Anda!</p>
          <p>Struk Resmi Terbitan KAEL POS System</p>
        </div>

      </div>

      {/* FEEDBACK PASCATRANSAKSI (Print Hidden) */}
      {canGiveFeedback && (
        <div className={`mt-4 rounded-3xl border-2 p-5 print:hidden ${
          isMochi
            ? "border-emerald-600/30 bg-[#0b3d2e] text-white shadow-xl"
            : "border-[#232331] bg-white shadow-ink-lg"
        }`}>
          {feedbackSubmitted ? (
            <div className="space-y-3 text-center">
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border-2 ${
                isMochi
                  ? "border-[#c8f53a] bg-[#c8f53a]/20 text-[#c8f53a]"
                  : "border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
              }`}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className={`text-sm font-black ${isMochi ? "text-white" : "text-[#232331]"}`}>Terima kasih atas masukanmu!</p>
                <p className={`mt-0.5 text-xs ${isMochi ? "text-emerald-200/70" : "text-[#7b7b8e]"}`}>Sudah kami terima dan akan ditinjau oleh {business.name}.</p>
              </div>
              {reviewUrl && (
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn-tactile flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black ${
                    isMochi
                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                      : "border-2 border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                  }`}
                >
                  <ExternalLink size={14} />
                  <span>Bagikan juga di Google Review</span>
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className={`text-center text-sm font-black ${isMochi ? "text-white" : "text-[#232331]"}`}>Bagaimana pengalamanmu di {business.name}?</p>
              <div className="mt-3 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="btn-tactile p-1"
                    aria-label={`Beri ${n} bintang`}
                  >
                    <Star
                      size={30}
                      className={
                        (rating ?? 0) >= n
                          ? isMochi ? "fill-[#c8f53a] text-[#c8f53a]" : "fill-[#facc15] text-[#facc15]"
                          : isMochi ? "text-emerald-800" : "text-[#dedee8]"
                      }
                    />
                  </button>
                ))}
              </div>

              {rating !== null && (
                <div className="mt-4 space-y-3">
                  {rating <= 3 && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {FEEDBACK_REASONS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setReasonCode(reasonCode === r.key ? null : r.key)}
                          className={`btn-tactile rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            reasonCode === r.key
                              ? isMochi ? "border-[#c8f53a] bg-[#c8f53a] text-[#0b3d2e]" : "border-[#232331] bg-[#232331] text-white"
                              : isMochi ? "border-emerald-700/50 bg-[#07241b] text-emerald-100/80" : "border-[#dedee8] bg-white text-[#5c5c70]"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value.slice(0, 500))}
                    rows={2}
                    placeholder={rating >= 4 ? "Ada yang mau disampaikan? (opsional)" : "Ceritakan lebih detail? (opsional)"}
                    className={`w-full rounded-xl border p-3 text-xs ${
                      isMochi
                        ? "border-emerald-600/40 bg-[#07241b] text-white placeholder-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-[#c8f53a]"
                        : "border-[#dedee8] bg-[#fcfcfe] text-[#232331]"
                    }`}
                  />

                  {reviewUrl && (
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn-tactile flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black ${
                        isMochi
                          ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                          : "border-2 border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                      }`}
                    >
                      <ExternalLink size={14} />
                      <span>Bagikan juga di Google Review</span>
                    </a>
                  )}

                  {feedbackError && <p className="text-center text-[11px] font-bold text-[#c2410c]">{feedbackError}</p>}

                  <button
                    type="button"
                    onClick={() => void handleSubmitFeedback()}
                    disabled={submittingFeedback}
                    className={`btn-tactile w-full rounded-xl py-2.5 text-xs font-black disabled:opacity-50 ${
                      isMochi
                        ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-sm"
                        : "border-2 border-[#232331] bg-[#232331] text-[#d9ff57]"
                    }`}
                  >
                    {submittingFeedback ? "Mengirim..." : "Kirim Feedback"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Copy Link Pill (Print Hidden) */}
      <div className="pt-4 text-center print:hidden">
        <button
          type="button"
          onClick={handleCopyLink}
          className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono transition-colors ${
            isMochi
              ? "border-emerald-600/40 bg-[#0b3d2e] text-emerald-200/90 hover:text-white"
              : "border-[#dedee8] bg-white text-[#7b7b8e] hover:text-[#232331]"
          }`}
        >
          {copied ? <Check size={13} className="text-[#16a34a]" /> : <Copy size={13} />}
          <span>{copied ? "Tautan Struk Tersalin!" : "Salin Tautan Struk Digital"}</span>
        </button>
      </div>

    </div>
  );
}

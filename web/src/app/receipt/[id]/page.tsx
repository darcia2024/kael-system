"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  Receipt, 
  Share2, 
  Printer, 
  CheckCircle2, 
  Store, 
  Coffee, 
  ArrowLeft, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink 
} from "lucide-react";
import { db } from "@/lib/db";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { generateEscPosReceiptText } from "@/lib/pos-engine";

export default function DigitalReceiptPage() {
  const params = useParams();
  const orderId = params.id as string;

  const data = useMemo(() => db.getOrderById(orderId), [orderId]);
  const [copied, setCopied] = useState(false);

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
  const staff = db.getUsers().find((u) => u.id === order.created_by);

  const receiptUrl = typeof window !== "undefined" ? window.location.href : "";
  const waShareMessage = encodeURIComponent(
    `Terima kasih telah berkunjung ke *${business.name}*!\nBerikut struk digital pesanan #${order.order_no}:\n${receiptUrl}`
  );

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(receiptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-between max-w-md mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
      
      {/* Top Floating Action Bar (Hidden in Print) */}
      <div className="flex items-center justify-between gap-2 pb-4 print:hidden">
        <Link
          href="/app/pos"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/?text=${waShareMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tactile flex items-center gap-1.5 rounded-xl border-2 border-[#16a34a] bg-[#dcfce7] px-3 py-1.5 font-mono text-xs font-black text-[#16a34a] shadow-ink-xs"
          >
            <Share2 size={13} />
            <span>Kirim WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="btn-tactile flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#232331] px-3 py-1.5 font-mono text-xs font-black text-white shadow-ink-xs"
          >
            <Printer size={13} />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* TACTILE PAPER RECEIPT CARD */}
      <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 font-mono text-xs relative overflow-hidden print:border-none print:shadow-none print:p-0">
        
        {/* Top Shop Header */}
        <div className="text-center space-y-1 border-b-2 border-dashed border-[#232331] pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7958d8] border border-[#232331] font-black text-sm">
            <Coffee size={20} />
          </div>
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
              {order.channel === "qr_dinein" ? `Dine-In (Meja ${order.table_no || '-'})` : "Takeaway / Kasir"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7b7b8e]">Kasir:</span>
            <span>{staff?.name || "Kasir KAEL"}</span>
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

          <div className="flex justify-between text-base font-black text-[#232331] border-t-2 border-[#232331] pt-2">
            <span>TOTAL BAYAR</span>
            <span className="text-[#16a34a]">{formatRupiah(order.total)}</span>
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

      {/* Copy Link Pill (Print Hidden) */}
      <div className="pt-4 text-center print:hidden">
        <button
          type="button"
          onClick={handleCopyLink}
          className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-[#dedee8] bg-white px-3 py-1.5 text-xs font-mono text-[#7b7b8e] hover:text-[#232331]"
        >
          {copied ? <Check size={13} className="text-[#16a34a]" /> : <Copy size={13} />}
          <span>{copied ? "Tautan Struk Tersalin!" : "Salin Tautan Struk Digital"}</span>
        </button>
      </div>

    </div>
  );
}

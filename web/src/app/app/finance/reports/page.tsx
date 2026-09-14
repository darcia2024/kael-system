import Link from "next/link";
import { ArrowLeft, LayoutDashboard, DollarSign, TrendingUp, Wallet, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { BusinessMark } from "@/components/business-mark";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { mochiThemeClass } from "@/lib/mochi-theme";

function isoDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const money = (value: number) => `Rp ${Number(value).toLocaleString("id-ID")}`;

export default async function FinanceReportsPage() {
  const session = await guardOwnerPage("/app/finance/reports");
  const from = isoDate(-30);
  const to = isoDate(0);

  const [report, payables, business] = await Promise.all([
    db.getFormalFinanceReport(session.businessId, from, to),
    db.getPayables(session.businessId),
    db.getBusiness(session.businessId),
  ]);

  const isMochi = isMochiBusiness(business);

  return (
    <div className={`${mochiThemeClass(business)} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans`}>
      <header className="sticky top-0 z-30 border-b border-[#07281e] bg-[#0b3d2e] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/app/pos/owner"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#144f3d] text-white hover:bg-[#1a5e4a] border border-[#1a5e4a] transition-colors"
              title="Kembali ke Dashboard Owner"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BusinessMark
                  name={business?.name}
                  logoUrl={business?.logo_url}
                  brandColor={business?.brand_color}
                  size="sm"
                  className="h-5 w-5 rounded-md object-cover shrink-0"
                />
                <h1 className="truncate text-xs font-black sm:text-base tracking-tight">Laporan Formal Keuangan</h1>
              </div>
              <span className="block truncate font-mono text-[10px] text-emerald-200/80 sm:text-[11px]">
                {business?.name} · {from} s/d {to} · POS, kas, HPP & hutang
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/pos/owner"
              className="flex items-center gap-1.5 rounded-xl bg-[#c8f53a] px-3.5 py-1.5 font-mono text-xs font-black text-[#0b3d2e] shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard Owner Utama</span>
              <span className="sm:hidden">Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6 lg:p-8">
        {/* Quick Report Switcher Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs no-scrollbar">
          <Link
            href="/app/pos/owner"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Dashboard Owner Utama</span>
          </Link>
          <Link
            href="/app/pos/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Penjualan &amp; Laba</span>
          </Link>
          <Link
            href="/app/loyalty/analytics"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Loyalty Member</span>
          </Link>
          <Link
            href="/app/pos/owner#laporan-review"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Review &amp; Keluhan</span>
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0b3d2e] border border-[#0b3d2e] px-3 py-1.5 font-bold text-[#c8f53a] shadow-sm">
            <span>Laporan Keuangan</span>
          </span>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <Metric label="PENDAPATAN" value={money(report.income)} icon={<DollarSign size={13} />} />
          <Metric label="HPP TERCATAT" value={money(report.cogs)} icon={<Receipt size={13} />} />
          <Metric
            label="LABA BERSIH"
            value={money(report.netProfit)}
            good={report.netProfit >= 0}
            icon={<TrendingUp size={13} />}
          />
          <Metric
            label="ARUS KAS"
            value={money(report.cashFlow)}
            good={report.cashFlow >= 0}
            icon={<Wallet size={13} />}
          />
        </div>

        {/* 2 Column Details */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Laba Rugi */}
          <section className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="border-b border-[#edf3f0] pb-3">
              <h2 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">Laba Rugi 30 Hari</h2>
              <p className="text-[11px] text-[#527867] sm:text-xs">Rincian pendapatan kotor, HPP, beban operasional, dan laba bersih.</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Line label="Pendapatan Penjualan" value={report.income} />
              <Line label="Harga Pokok Penjualan (HPP)" value={-report.cogs} />
              <Line label="Laba Kotor" value={report.grossProfit} strong />
              <Line label="Beban Operasional Usaha" value={-report.expenses} />
              <Line label="Laba Bersih" value={report.netProfit} strong />
            </dl>
          </section>

          {/* Neraca Ringkas */}
          <section className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="border-b border-[#edf3f0] pb-3">
              <h2 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">Neraca Ringkas</h2>
              <p className="text-[11px] text-[#527867] sm:text-xs">Posisi aset tetap, kewajiban usaha, dan ekuitas bersih bisnis.</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Line label="Aset Tetap Bersih" value={report.balanceSheet.assets} />
              <Line label="Hutang Usaha" value={-report.balanceSheet.liabilities} />
              <Line label="Ekuitas Bersih" value={report.balanceSheet.equity} strong />
            </dl>
            <p className="mt-5 rounded-xl border border-[#edf3f0] bg-[#f9fbf9] p-3 text-[11px] text-[#527867]">
              Ekspor akuntansi memakai struktur kategori dan pajak di transaksi finance. Integrasi jurnal ke software akuntansi dapat disinkronkan secara periodik.
            </p>
          </section>
        </div>

        {/* Hutang Supplier */}
        <section className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="border-b border-[#edf3f0] pb-3">
            <h2 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">Hutang Supplier</h2>
            <p className="text-[11px] text-[#527867] sm:text-xs">Daftar tagihan berjalan dari supplier bahan baku dan vendor.</p>
          </div>
          {payables.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#d8e3de]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-[#d8e3de] bg-[#edf8f3] font-mono text-[10px] uppercase font-bold text-[#167052]">
                  <tr>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">No. Tagihan</th>
                    <th className="p-3">Jatuh Tempo</th>
                    <th className="p-3 text-right">Sisa Tagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {payables.map((item) => (
                    <tr key={item.id as string} className="transition-colors hover:bg-[#f7fcf9]">
                      <td className="p-3 font-bold text-[#0b3d2e]">{item.supplier_name as string}</td>
                      <td className="p-3 font-mono text-[#527867]">{item.bill_no as string}</td>
                      <td className="p-3 font-mono text-[#527867]">{String(item.due_on ?? "-")}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#0b3d2e]">
                        {money(Number(item.total_amount) - Number(item.paid_amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#edf3f0] bg-[#f9fbf9] p-6 text-center text-xs text-[#527867]">
              Tidak ada hutang supplier terbuka saat ini.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  good,
  icon,
}: {
  label: string;
  value: string;
  good?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
        <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">{label}</span>
        {icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 sm:mt-3">
        <p
          className={`truncate font-mono text-base font-black sm:text-2xl ${
            good === false ? "text-[#dc2626]" : good === true ? "text-[#16a34a]" : "text-[#0b3d2e]"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-[#edf3f0] pb-2 ${strong ? "font-bold text-[#0b3d2e]" : "text-[#527867]"}`}>
      <dt>{label}</dt>
      <dd className="font-mono font-bold">
        {value < 0 ? `(${money(Math.abs(value))})` : money(value)}
      </dd>
    </div>
  );
}

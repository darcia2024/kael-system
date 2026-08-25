"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  Coffee,
  DollarSign,
  HelpCircle,
  MessageCircle,
  Receipt,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

export function RoiCalculator() {
  const [dailyCustomers, setDailyCustomers] = useState(50);
  const [avgTicket, setAvgTicket] = useState(35000);

  // Perhitungan Realistis Berdasarkan Data UMKM
  const monthlyTransactions = dailyCustomers * 30;
  const currentGrossRevenue = monthlyTransactions * avgTicket;

  // 1. Review Google Maps: Rata-rata 12% pembeli bersedia tap NFC di kasir
  const estimatedReviewsPerMonth = Math.round(monthlyTransactions * 0.12);

  // 2. Hemat Bahan & Anti Selisih Kasir: Rata-rata 4.5% dari omzet terselamatkan dari pemborosan resep & salah catat nota
  const hppSavings = Math.round(currentGrossRevenue * 0.045);

  // 3. Omzet Tambahan Repeat Order: 18% pelanggan aktif kembali lagi berkat stamp point WA (dihitung laba kotor 60%)
  const repeatVisits = Math.round(monthlyTransactions * 0.18);
  const extraRevenue = Math.round(repeatVisits * avgTicket * 0.6);

  // Total Tambahan Cuan Bersih per Bulan
  const totalExtraNetProfit = hppSavings + extraRevenue;

  return (
    <section id="kalkulator" className="py-12 sm:py-24 bg-[#fcfcfe]">
      <Container>
        
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>SIMULASI DAMPAK NYATA UNTUK PEMILIK USAHA</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Berapa banyak cuan & ulasan <i className="font-serif italic font-normal text-[#7958d8]">yang bakal masuk ke tokomu?</i>
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Gak perlu hitungan rumit. Masukkan kondisi tokomu saat ini, dan lihat 3 hal nyata yang langsung dirasakan kas tokomu setelah pasang KAEL.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-8 sm:mt-12">
          {/* Main Calculator Card */}
          <div className="mx-auto max-w-5xl rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-10 shadow-ink-lg text-[#232331]">
            <div className="grid gap-10 lg:grid-cols-12 items-start">
              
              {/* Left Column: Sliders Input */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="border-b border-[#dedee8] pb-3">
                  <span className="font-mono text-[10px] font-bold tracking-wider text-[#7958d8] uppercase">
                    LANGKAH 1: MASUKKAN DATA TOKOMU
                  </span>
                  <h3 className="text-sm font-extrabold text-[#232331] mt-0.5">
                    Kondisi Penjualan Tokomu Saat Ini
                  </h3>
                </div>

                {/* Slider 1: Transaksi Harian */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#232331] flex items-center gap-1.5">
                      <Users size={14} className="text-[#7958d8]" />
                      <span>Rata-Rata Pembeli per Hari</span>
                    </label>
                    <span className="rounded-lg border border-[#232331] bg-[#d9ff57] px-2.5 py-1 text-xs font-mono font-bold text-[#232331] shadow-ink-xs">
                      {dailyCustomers} Orang / Hari
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="300"
                    step="5"
                    value={dailyCustomers}
                    onChange={(e) => setDailyCustomers(Number(e.target.value))}
                    className="mt-3 w-full accent-[#7958d8] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#7b7b8e] mt-1">
                    <span>15 (Kedai santai)</span>
                    <span>150 (Cafe ramai)</span>
                    <span>300+ (Resto padat)</span>
                  </div>
                </div>

                {/* Slider 2: Rata-rata Struk */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#232331] flex items-center gap-1.5">
                      <Receipt size={14} className="text-[#7958d8]" />
                      <span>Rata-Rata Belanja per Struk</span>
                    </label>
                    <span className="rounded-lg border border-[#232331] bg-[#f0edff] px-2.5 py-1 text-xs font-mono font-bold text-[#7958d8] border-[#7958d8]">
                      Rp {avgTicket.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15000"
                    max="150000"
                    step="5000"
                    value={avgTicket}
                    onChange={(e) => setAvgTicket(Number(e.target.value))}
                    className="mt-3 w-full accent-[#7958d8] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#7b7b8e] mt-1">
                    <span>Rp 15.000</span>
                    <span>Rp 50.000</span>
                    <span>Rp 150.000+</span>
                  </div>
                </div>

                {/* Current Baseline Box */}
                <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-4 text-xs">
                  <div className="flex justify-between items-center text-[#7b7b8e]">
                    <span>Omzet Kotor Tokomu Saat Ini:</span>
                    <span className="font-mono font-bold text-[#232331] text-sm">
                      ~Rp {currentGrossRevenue.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-[#7b7b8e]">/bln</span>
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#dedee8] bg-[#f0edff] p-3 text-[11px] text-[#232331] leading-relaxed mt-3">
                    💡 <strong>Dampak Menyeluruh:</strong> Dengan pasang KAEL, tokomu mengundang ulasan jujur & rating organik Google Maps, mengunci modal resep/kulakan supplier, serta mengumpulkan database member WhatsApp otomatis.
                  </div>
                </div>

              </div>

              {/* Right Column: Apa yang Didapat Owner? (Light Mode) */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-3.5 sm:p-7 text-[#232331] shadow-ink-lg overflow-hidden">
                
                <div>
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div>
                      <span className="font-mono text-[9.5px] sm:text-[10px] font-bold tracking-wider text-[#7958d8] uppercase">
                        LANGKAH 2: HASIL NYATA YANG DIDAPAT OWNER
                      </span>
                      <h4 className="text-xs sm:text-sm font-extrabold text-[#232331] mt-0.5">
                        Manfaat Langsung Tiap Bulan di Tokomu:
                      </h4>
                    </div>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[#7958d8] animate-pulse shrink-0" />
                  </div>

                  <div className="mt-4 space-y-3">
                    
                    {/* Item 1: Review Organik */}
                    <div className="rounded-xl border border-[#232331] bg-white p-3.5 shadow-ink-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d9ff57] text-[#232331] border border-[#232331]">
                            <Star size={14} fill="currentColor" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#232331]">1. Ulasan Organik Baru di Google Maps</p>
                            <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                              Pelanggan tinggal tap HP di kasir atau saat disamperin staf (1 detik). Mengundang ulasan jujur &amp; alami dari pembeli nyata.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/70 shrink-0">
                          <span className="text-[10px] font-bold text-[#7b7b8e] sm:hidden font-sans">Estimasi Hasil:</span>
                          <span className="rounded-lg sm:rounded-none bg-[#f0edff] sm:bg-transparent px-2.5 py-1 sm:p-0 border sm:border-none border-[#7958d8]/30 font-mono text-xs sm:text-sm font-extrabold text-[#7958d8]">
                            +{estimatedReviewsPerMonth} ulasan <span className="text-[10px] font-normal text-[#7b7b8e]">/bln</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item 2: Uang Bocor yang Diselamatkan */}
                    <div className="rounded-xl border border-[#232331] bg-white p-3.5 shadow-ink-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8] border border-[#232331]">
                            <ShieldCheck size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#232331]">2. Uang Bocor yang Berhasil Diselamatkan</p>
                            <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                              Takaran gramasi resep atau harga modal kulakan supplier + ongkir terkunci presisi (Anti Boncos) &amp; gak ada lagi nota hilang/salah hitung.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/70 shrink-0">
                          <span className="text-[10px] font-bold text-[#7b7b8e] sm:hidden font-sans">Estimasi Hemat:</span>
                          <span className="rounded-lg sm:rounded-none bg-[#f0edff] sm:bg-transparent px-2.5 py-1 sm:p-0 border sm:border-none border-[#7958d8]/30 font-mono text-xs sm:text-sm font-extrabold text-[#7958d8]">
                            +Rp {hppSavings.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-[#7b7b8e]">hemat/bln</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item 3: Pelanggan Balik Lagi (Loyalty) */}
                    <div className="rounded-xl border border-[#232331] bg-white p-3.5 shadow-ink-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d9ff57] text-[#232331] border border-[#232331]">
                            <TrendingUp size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#232331]">3. Omzet dari Pelanggan Balik Lagi (Loyalitas)</p>
                            <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                              Berkat kartu tap NFC member (auto Nama &amp; WA) dan laporan poin real-time di WA, pelanggan lama jajan kembali ~{repeatVisits}x lebih sering.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/70 shrink-0">
                          <span className="text-[10px] font-bold text-[#7b7b8e] sm:hidden font-sans">Estimasi Omzet:</span>
                          <span className="rounded-lg sm:rounded-none bg-[#f0edff] sm:bg-transparent px-2.5 py-1 sm:p-0 border sm:border-none border-[#7958d8]/30 font-mono text-xs sm:text-sm font-extrabold text-[#7958d8]">
                            +Rp {extraRevenue.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-[#7b7b8e]">omzet/bln</span>
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Bottom Highlight: Total Cuan Tambahan Bersih */}
                <div className="mt-5 pt-4 border-t border-[#dedee8]">
                  <div className="rounded-xl border-2 border-[#232331] bg-[#d9ff57] p-4 text-[#232331] shadow-ink-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#232331]">
                        TOTAL PERKIRAAN CUAN TAMBAHAN BERSIH
                      </span>
                      <p className="text-xs font-bold text-[#232331]/80">Masuk langsung ke kantong pemilik usaha</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="font-mono text-xl sm:text-2xl font-extrabold text-[#232331]">
                        +Rp {totalExtraNetProfit.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[10px] font-bold block text-[#232331]/70">/ bulan</span>
                    </div>
                  </div>

                  <a
                    href={cta.consult.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#232331] py-3 text-xs font-bold text-white hover:bg-[#1a1a24]"
                  >
                    <span>Pasang Sistem Ini di Tokomu Sekarang</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </a>
                </div>

              </div>

            </div>
          </div>
        </Reveal>

        {/* ------------------------------------------------------------- */}
        {/* BONUS CLARITY CARD: Info Apa Saja yang Diterima Owner Tiap Hari? */}
        {/* ------------------------------------------------------------- */}
        <Reveal delay={0.15} className="mt-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-[#dedee8] bg-[#f0edff] p-6 sm:p-8 text-[#232331]">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#7958d8] uppercase">
              <MessageCircle size={15} />
              <span>TRANSPARANSI DATA · YANG DITERIMA OWNER SETIAP HARI</span>
            </div>

            <h3 className="mt-2 text-lg sm:text-xl font-extrabold text-[#232331]">
              Owner Toko Bakal Dapet Info Apa Aja di WhatsApp?
            </h3>
            <p className="mt-1 text-xs text-[#7b7b8e]">
              Tanpa perlu nongkrong di kasir seharian, semua laporan penting otomatis masuk ke HP pribadi owner setiap malam:
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              
              {/* Report 1 */}
              <div className="rounded-xl border border-[#232331] bg-white p-4 shadow-ink-xs">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs mb-2.5">
                  <BarChart3 size={16} strokeWidth={2.4} />
                </span>
                <h4 className="text-xs font-bold text-[#232331]">Rekap Kasir & Dashboard Owner</h4>
                <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                  Laporan total omzet harian & bulanan (Tunai vs QRIS), total {dailyCustomers} struk terbit, menu terlaris vs alarm stok jarang laku.
                </p>
              </div>

              {/* Report 2 */}
              <div className="rounded-xl border border-[#232331] bg-white p-4 shadow-ink-xs">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#c5b3f5] text-[#232331] shadow-ink-xs mb-2.5">
                  <Star size={16} strokeWidth={2.4} />
                </span>
                <h4 className="text-xs font-bold text-[#232331]">Notifikasi Ulasan Organik Masuk</h4>
                <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                  Laporan ulasan jujur & rating organik Google Maps dari pengunjung yang puas saat tap kartu di kasir atau meja.
                </p>
              </div>

              {/* Report 3 */}
              <div className="rounded-xl border border-[#232331] bg-white p-4 shadow-ink-xs">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#8bc9ff] text-[#232331] shadow-ink-xs mb-2.5">
                  <ShieldAlert size={16} strokeWidth={2.4} />
                </span>
                <h4 className="text-xs font-bold text-[#232331]">Alarm Margin Resep & Kulakan</h4>
                <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                  Peringatan otomatis jika modal bahan/ongkir kulakan supplier naik dan rekap klaim poin member yang di-approve kasir.
                </p>
              </div>

            </div>
          </div>
        </Reveal>

      </Container>
    </section>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  LineChart,
  Megaphone,
  PackageSearch,
  ReceiptText,
  TrendingDown,
  WalletCards,
} from "lucide-react";

import { AuditPopup } from "./audit-popup";

export const metadata: Metadata = {
  title: "Penawaran KAEL untuk UMKM Hijab",
  description:
    "Rancangan solusi KAEL untuk membantu UMKM hijab merapikan uang masuk, uang keluar, stok, harga jual, dan budget promosi.",
  /**
   * Penawaran ini disusun untuk SATU calon pembeli: berisi pembacaan kondisi
   * usahanya dan angka yang ditawarkan kepadanya. Halamannya memang dibagikan
   * lewat tautan, tapi tidak pantas muncul di hasil pencarian — baik bagi
   * calon pembelinya maupun bagi calon lain yang lalu melihat penawaran yang
   * bukan untuk dia. Tautannya tetap bisa dibuka siapa pun yang menerimanya.
   */
  robots: { index: false, follow: false },
};

const visibleProblems = [
  {
    title: "Uang bisnis belum kelihatan jelas",
    text: "Pemilik usaha belum yakin uangnya bertambah, berkurang, atau cuma pindah bentuk jadi stok hijab.",
    features: ["Ringkasan uang bisnis", "Catatan uang masuk dan keluar", "Laporan untung sederhana"],
    icon: CircleDollarSign,
  },
  {
    title: "Modal terasa berkurang",
    text: "Uang di tangan bisa menipis karena rugi, tapi bisa juga karena uangnya berubah jadi stok, biaya iklan, atau uang yang belum dibayar customer.",
    features: ["Catatan modal", "Perbandingan uang dan stok", "Riwayat uang berkurang"],
    icon: TrendingDown,
  },
  {
    title: "Uang masih masuk ke satu tempat",
    text: "Semua uang penjualan terasa seperti boleh dipakai, padahal sebagian harus disimpan untuk beli stok lagi, biaya harian, promosi, dan dana cadangan.",
    features: ["Kantong uang", "Saran pembagian uang", "Target isi tiap kantong"],
    icon: WalletCards,
  },
];

const hiddenProblems = [
  {
    title: "Harga jual belum tentu sudah aman",
    detail:
      "Banyak penjual hanya menghitung harga beli dan harga jual. Padahal masih ada ongkir supplier, plastik atau box, biaya marketplace, diskon, retur, konten, dan iklan.",
    features: ["Hitung modal per produk", "Cek untung per produk", "Coba hitung sebelum diskon"],
    icon: Calculator,
  },
  {
    title: "Stok banyak belum tentu bagus",
    detail:
      "Kalau warna atau modelnya susah laku, uang jadi tertahan di barang. Toko terlihat punya banyak stok, tapi uang tunai tetap seret.",
    features: ["Stok cepat laku", "Stok lambat laku", "Warna dan model paling laris"],
    icon: PackageSearch,
  },
  {
    title: "Barang laku belum tentu uang sudah masuk",
    detail:
      "Kalau jualan lewat WhatsApp, reseller, COD, atau bayar belakangan, penjualan bisa terlihat banyak walau uangnya belum diterima.",
    features: ["Status sudah dibayar atau belum", "Catatan uang yang belum masuk", "Pengingat tagihan"],
    icon: ReceiptText,
  },
  {
    title: "Promosi belum tahu hasil bersihnya",
    detail:
      "Iklan dan promo bisa membuat chat ramai, tapi belum tentu menyisakan untung setelah dikurangi modal barang dan biaya promosi.",
    features: ["Kantong budget promosi", "Catatan biaya promosi", "Cek untung setelah promo"],
    icon: Megaphone,
  },
];

const modules = [
  {
    name: "KAEL Uang Bisnis",
    purpose: "Membantu pemilik usaha tahu uang masuk, uang keluar, dan sisa uang bisnis.",
    items: ["uang masuk", "uang keluar", "jenis biaya", "untung harian", "sisa kas", "modal awal"],
  },
  {
    name: "KAEL Pocket",
    purpose: "Membantu membagi uang penjualan supaya tidak tercampur semua.",
    items: ["modal stok", "biaya harian", "promosi", "jatah pemilik", "dana cadangan", "target isi"],
  },
  {
    name: "KAEL Stok Hijab",
    purpose: "Membantu melihat stok mana yang cepat laku dan mana yang menahan modal.",
    items: ["model", "warna", "harga beli", "nilai stok", "cepat laku", "saran beli lagi"],
  },
  {
    name: "KAEL Harga Jual",
    purpose: "Membantu menentukan harga jual agar tidak asal murah dan tetap ada untung.",
    items: ["modal barang", "kemasan", "biaya marketplace", "untung", "coba diskon", "saran harga"],
  },
];

const process = [
  {
    label: "Diagnosa",
    title: "Cari tahu dulu uangnya lari ke mana",
    text: "KAEL mulai dari pertanyaan sederhana supaya masalah utama terlihat dulu.",
  },
  {
    label: "Rapikan data",
    title: "Catat modal, uang di tangan, stok, dan biaya rutin",
    text: "Data awal ini membantu menjelaskan kenapa uang terasa berkurang.",
  },
  {
    label: "Aktifkan sistem",
    title: "Pakai sistemnya pelan-pelan dari yang paling penting",
    text: "Promosi baru diperbesar setelah untung dan sisa uang bisnis sudah lebih jelas.",
  },
];

const questions = [
  "Sekarang pencatatan uang masuk dan keluar pakai apa?",
  "Uang bisnis dan uang pribadi sudah dipisah atau masih campur?",
  "Ada catatan stok hijab per model dan warna?",
  "Kalau modal terasa berkurang, biasanya uangnya keluar untuk apa?",
  "Saat menentukan harga jual, biaya apa saja yang sudah dihitung?",
  "Penjualan paling banyak dari WhatsApp, marketplace, offline, atau reseller?",
  "Ada transaksi yang sudah laku tapi belum dibayar?",
  "Pernah hitung profit setelah diskon atau iklan?",
];

function MiniDashboard() {
  return (
    <div className="card-tactile rounded-[14px] bg-white p-3 sm:rounded-[18px] sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
        <div>
          <p className="font-mono text-[9px] font-bold text-[#7958d8] sm:text-[10px]">UMKM HIJAB</p>
          <h2 className="mt-1 text-base font-extrabold text-[#232331] sm:text-lg">Peta Uang Bisnis</h2>
        </div>
        <div className="rounded-[9px] border-[1.5px] border-[#232331] bg-[#d9ff57] px-2.5 py-1.5 text-[11px] font-extrabold shadow-ink-xs sm:px-3 sm:py-2 sm:text-xs">
          Audit awal
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
        {[
          ["Uang tunai", "menipis", "cek stok dan biaya"],
          ["Stok", "bertambah", "uang berubah jadi barang"],
          ["Untung", "belum jelas", "cek semua biaya"],
          ["Promosi", "belum terukur", "cek hasil setelah iklan"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-[11px] border border-[#dedee8] bg-[#fcfcfe] p-2.5 sm:rounded-[14px] sm:p-3">
            <p className="text-[10px] font-bold text-[#7b7b8e] sm:text-[11px]">{label}</p>
            <p className="mt-0.5 text-sm font-extrabold text-[#232331] sm:mt-1 sm:text-base">{value}</p>
            <p className="mt-1 text-[10px] leading-snug text-[#7b7b8e] sm:mt-2 sm:text-[11px] sm:leading-relaxed">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[13px] border-[1.5px] border-[#232331] bg-[#f0edff] p-3 sm:mt-4 sm:rounded-[16px] sm:p-4">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-[#7958d8] sm:h-5 sm:w-5" strokeWidth={2.4} />
          <div>
            <p className="text-xs font-extrabold text-[#232331] sm:text-sm">Contoh hasil yang ingin KAEL tampilkan</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#232331]/75 sm:text-xs">
              Uang berkurang belum tentu rugi. Bisa jadi uangnya berubah jadi stok, keluar untuk biaya,
              atau masih belum dibayar customer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PenawaranHijabPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#dedee8] bg-[#fcfcfe]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-3 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <Image
              src="/kael-logo-fix.png"
              alt="KAEL"
              width={34}
              height={34}
              className="h-7 w-auto shrink-0 object-contain sm:h-8"
              priority
            />
            <div className="min-w-0 leading-none">
              <p className="text-base font-extrabold tracking-tight text-[#232331] sm:text-lg">KAEL</p>
              <p className="hidden truncate text-[9px] font-bold text-[#7958d8] sm:block">
                Kemudahan Akses, Efisiensi, Layanan
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 text-xs font-bold text-[#232331] md:flex">
            <a href="#masalah" className="hover:text-[#7958d8]">
              Masalah
            </a>
            <a href="#fitur" className="hover:text-[#7958d8]">
              Fitur
            </a>
            <a href="#alur" className="hover:text-[#7958d8]">
              Alur
            </a>
            <a href="#audit" className="hover:text-[#7958d8]">
              Audit
            </a>
          </nav>

          <AuditPopup variant="compact" />
        </div>
      </header>

      <main className="overflow-hidden bg-[#fcfcfe] text-[#232331]">
        <section className="relative border-b-[1.5px] border-[#232331] bg-[#fcfcfe]">
          <div className="mx-auto grid max-w-[1180px] gap-6 px-3 py-7 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-[9px] border-[1.5px] border-[#232331] bg-[#ffb16f] px-2.5 py-1.5 text-[11px] font-extrabold shadow-ink-xs sm:mb-5 sm:gap-2 sm:rounded-[10px] sm:px-3 sm:py-2 sm:text-xs">
                <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                Penawaran sederhana untuk UMKM hijab
              </div>
              <h1 className="max-w-3xl text-[32px] font-extrabold leading-none tracking-tight text-[#232331] sm:text-[54px] lg:text-[68px]">
                Rapikan uang bisnis dulu, baru besarkan promosi.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-[#4c4c5f] sm:mt-6 sm:text-lg">
                Untuk penjual hijab pemula, KAEL membantu mencari tahu uang keluar ke mana,
                membagi uang ke beberapa kantong, menghitung untung, dan melihat stok mana yang cepat laku.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
                <AuditPopup />
                <a
                  href="#fitur"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[#232331] bg-white px-4 text-xs font-extrabold text-[#232331] shadow-ink-xs hover:bg-[#f0edff] sm:min-h-[52px] sm:rounded-[12px] sm:px-6 sm:text-sm"
                >
                  Lihat bantuan KAEL
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -right-10 top-8 hidden h-40 w-40 rotate-6 rounded-[26px] border-[1.5px] border-[#232331] bg-[#d9ff57] shadow-ink-md lg:block" />
              <div className="absolute -left-8 bottom-10 hidden h-28 w-28 -rotate-6 rounded-[18px] border-[1.5px] border-[#232331] bg-[#c5b3f5] shadow-ink-sm lg:block" />
              <div className="relative">
                <MiniDashboard />
              </div>
            </div>
          </div>
        </section>

        <section id="masalah" className="border-b border-[#dedee8] bg-[#f0edff]">
          <div className="mx-auto max-w-[1180px] px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-5 sm:gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="eyebrow">Masalah yang sudah kelihatan</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:mt-3 sm:text-4xl">
                  Dari chat-nya, masalah utamanya ada di tiga bagian.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#4c4c5f] sm:mt-4">
                  KAEL perlu bikin pemilik usaha merasa dipahami dulu. Setelah masalahnya jelas,
                  fitur sistem baru terasa membantu, bukan terlihat seperti aplikasi yang ribet.
                </p>
              </div>

              <div className="grid gap-3 sm:gap-4">
                {visibleProblems.map((problem) => {
                  const Icon = problem.icon;
                  return (
                    <article key={problem.title} className="card-tactile rounded-[14px] bg-white p-4 sm:rounded-[16px] sm:p-5">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-[#232331] bg-[#d9ff57] shadow-ink-xs sm:h-11 sm:w-11 sm:rounded-[12px]">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold sm:text-lg">{problem.title}</h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-[#4c4c5f] sm:mt-2 sm:text-sm">{problem.text}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                            {problem.features.map((feature) => (
                              <span
                                key={feature}
                                className="rounded-[8px] border border-[#dedee8] bg-[#fcfcfe] px-2 py-1 text-[10px] font-bold text-[#232331] sm:rounded-[9px] sm:px-3 sm:py-1.5 sm:text-[11px]"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#fcfcfe]">
          <div className="mx-auto max-w-[1180px] px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-5 flex max-w-3xl flex-col gap-2 sm:mb-8 sm:gap-3">
              <p className="eyebrow">Masalah yang sering kelewat</p>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
                Bagian ini membantu prospek sadar bahwa masalahnya bukan cuma catatan uang.
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              {hiddenProblems.map((problem, index) => {
                const Icon = problem.icon;
                return (
                  <article
                    key={problem.title}
                    className={`rounded-[14px] border-[1.5px] border-[#232331] p-4 shadow-ink-sm sm:rounded-[16px] sm:p-5 ${
                      index === 0 ? "bg-[#d9ff57] md:row-span-2" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-[#232331] bg-[#fcfcfe] sm:h-10 sm:w-10 sm:rounded-[11px]">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold leading-tight sm:text-lg">{problem.title}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-[#232331]/78 sm:mt-3 sm:text-sm">{problem.detail}</p>
                      </div>
                    </div>
                    <ul className="mt-3 grid gap-1.5 sm:mt-5 sm:gap-2">
                      {problem.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs font-bold text-[#232331] sm:text-sm">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.5} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="fitur" className="border-y-[1.5px] border-[#232331] bg-[#232331] text-white">
          <div className="mx-auto max-w-[1180px] px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-6 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#d9ff57]">BANTUAN AWAL KAEL</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:mt-3 sm:text-4xl">
                  Mulai dari yang paling menjaga modal.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/72 sm:mt-4">
                  Untuk kasus ini, promosi sebaiknya dibahas setelah uang, kantong, stok,
                  dan harga jual mulai rapi.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {modules.map((module) => (
                  <article key={module.name} className="rounded-[14px] border border-white/20 bg-white p-4 text-[#232331] sm:rounded-[16px] sm:p-5">
                    <h3 className="text-base font-extrabold sm:text-lg">{module.name}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#4c4c5f] sm:mt-2 sm:text-sm">{module.purpose}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                      {module.items.map((item) => (
                        <span key={item} className="rounded-[7px] bg-[#f0edff] px-2 py-1 text-[10px] font-bold text-[#232331] sm:rounded-[8px] sm:px-2.5 sm:text-[11px]">
                          {item}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="alur" className="bg-[#ffb16f]">
          <div className="mx-auto max-w-[1180px] px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="eyebrow text-[#232331]">Alur konsultasi</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:mt-3 sm:text-4xl">
                  Cara KAEL membantu tanpa bikin pemilik usaha kewalahan.
                </h2>
              </div>
              <div className="rounded-[14px] border-[1.5px] border-[#232331] bg-[#fcfcfe] p-3.5 shadow-ink-md sm:rounded-[18px] sm:p-4">
                {process.map((step, index) => (
                  <div key={step.label} className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4 sm:pb-6">
                    {index < process.length - 1 && (
                      <div className="absolute left-[17px] top-10 h-[calc(100%-1.75rem)] w-[1.5px] bg-[#232331] sm:left-[19px] sm:top-11 sm:h-[calc(100%-2rem)]" />
                    )}
                    <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-[#232331] bg-[#d9ff57] text-xs font-extrabold sm:h-10 sm:w-10 sm:rounded-[12px] sm:text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-[#7958d8] sm:text-xs">{step.label}</p>
                      <h3 className="mt-0.5 text-sm font-extrabold sm:mt-1 sm:text-base">{step.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#4c4c5f] sm:mt-1.5 sm:text-sm">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="audit" className="bg-[#fcfcfe]">
          <div className="mx-auto max-w-[1180px] px-3 py-8 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-5 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="eyebrow">Pertanyaan audit awal</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:mt-3 sm:text-4xl">
                  Pertanyaan ini membantu mencari masalah yang belum disadari.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#4c4c5f] sm:mt-4">
                  Pakai ini sebagai bahan chat lanjutan. Tujuannya bukan menghakimi, tapi membantu
                  pemilik usaha tahu bagian mana yang perlu dirapikan dulu.
                </p>
                <AuditPopup variant="section" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                {questions.map((question) => (
                  <div key={question} className="rounded-[12px] border-[1.5px] border-[#232331] bg-white p-3 shadow-ink-xs sm:rounded-[14px] sm:p-4">
                    <p className="text-xs font-bold leading-relaxed text-[#232331] sm:text-sm">{question}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-[#232331] bg-[#d9ff57]">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-3 py-7 sm:gap-6 sm:px-6 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl">
              <p className="eyebrow text-[#232331]">Peran KAEL</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-3xl">
                KAEL jadi teman merapikan bisnis, bukan cuma aplikasi catat uang.
              </h2>
            </div>
            <div className="rounded-[14px] border-[1.5px] border-[#232331] bg-[#fcfcfe] p-4 shadow-ink-md sm:rounded-[16px] sm:p-5 lg:max-w-md">
              <p className="text-xs font-bold leading-relaxed sm:text-sm">
                KAEL membantu UMKM merapikan uang bisnis, stok, modal, dan keputusan harian
                dengan data yang mudah dibaca.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dedee8] bg-[#fcfcfe] px-3 py-5 text-[#232331] sm:px-6">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 text-xs font-bold sm:flex-row sm:items-center sm:justify-between">
          <span>KAEL System</span>
          <span className="text-[#7b7b8e]">Solusi digital praktis untuk UMKM.</span>
        </div>
      </footer>
    </>
  );
}

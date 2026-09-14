"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Check, AlertTriangle, Printer } from "lucide-react";

import { saveMemberCardSettingsAction, updateLoyaltyProgramAction } from "@/lib/actions";
import type { MemberCardSettings } from "@/lib/types";

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export default function KartuClient({
  settings,
  storeCode,
  businessName,
  minimumPurchase,
  mode,
  targetStempel,
  themeClassName,
}: {
  settings: MemberCardSettings | null;
  storeCode: string | null;
  businessName: string;
  minimumPurchase: number;
  mode: "point" | "stamp";
  targetStempel: number | null;
  themeClassName?: string;
}) {
  const router = useRouter();

  const [headline, setHeadline] = useState(settings?.headline ?? "");
  const [welcome, setWelcome] = useState(settings?.welcome_text ?? "");
  const [jam, setJam] = useState(settings?.opening_hours ?? "");
  const [ig, setIg] = useState(settings?.instagram ?? "");
  const [wa, setWa] = useState(settings?.whatsapp ?? "");
  const [kabar, setKabar] = useState(settings?.announcement ?? "");
  const [tampilkanMenu, setTampilkanMenu] = useState(settings?.show_menu ?? true);
  const [minimal, setMinimal] = useState(String(minimumPurchase || ""));

  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  const cetakKartuStempel = () => {
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
    const jumlah = targetStempel ?? 10;
    const minimalBelanja = Number(minimal.replace(/[^\d]/g, "")) || 0;
    const jendela = window.open("", "kael-kartu-stempel", "width=900,height=700");
    if (!jendela) return;
    const cap = Array.from({ length: jumlah }, (_, index) => `<span class="stamp">${index + 1}</span>`).join("");
    jendela.document.write(`<!doctype html><html><head><title>Kartu Stempel ${escape(businessName)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#232331}.page{display:grid;grid-template-columns:repeat(2,90mm);gap:12mm;justify-content:center}.card{width:90mm;height:54mm;border:2px solid #232331;border-radius:6mm;padding:6mm;position:relative;overflow:hidden}.front{background:#d9ff57}.back{background:#f7f4ff}.brand{font-size:10pt;font-weight:900;text-transform:uppercase;letter-spacing:1px}.title{font-size:19pt;font-weight:900;margin-top:4mm}.sub{font-size:8.5pt;margin-top:2mm}.stamps{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin-top:5mm}.stamp{aspect-ratio:1;border:2px dashed #232331;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:800;background:rgba(255,255,255,.55)}.rule{font-size:10pt;font-weight:800;line-height:1.4;margin-top:5mm}.gift{margin-top:4mm;border:2px solid #232331;border-radius:4mm;background:#fff;padding:3mm;font-size:9pt;font-weight:800}.small{font-size:7.5pt;line-height:1.35;margin-top:3mm}@media print{body{margin:0}}</style></head><body><div class="page"><section class="card front"><div class="brand">${escape(businessName)}</div><div class="title">Kartu Stempel</div><div class="sub">Satu kunjungan, satu cap. Yuk, penuhkan kartunya!</div><div class="stamps">${cap}</div></section><section class="card back"><div class="brand">Cara mendapat stempel</div><div class="rule">Belanja minimal ${minimalBelanja > 0 ? rupiah(minimalBelanja) : "sesuai ketentuan toko"} = 1 stempel</div><div class="gift">${jumlah} stempel penuh = hadiah spesial dari kami</div><div class="small">Simpan kartu ini dan tunjukkan ke kasir setiap berkunjung. Stempel yang hilang atau kartu rusak tidak dapat diganti.</div></section></div><script>window.onload=()=>window.print()</script></body></html>`);
    jendela.document.close();
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat(null);
    setSukses(false);
    setSimpan(true);

    const hasil = await saveMemberCardSettingsAction({
      headline,
      welcomeText: welcome,
      openingHours: jam,
      instagram: ig.replace(/^@/, ""),
      whatsapp: wa,
      announcement: kabar,
      showMenu: tampilkanMenu,
    });
    if (!hasil.ok) {
      setSimpan(false);
      setGalat(hasil.error);
      return;
    }

    /**
     * Minimum belanja tinggal di loyalty_programs, bukan di tabel kartu, karena
     * yang memakainya mesin poin — bukan tampilan. Disimpan dari layar yang sama
     * supaya pemilik usaha tidak perlu tahu pembagian itu.
     */
    const angka = Number(minimal.replace(/[^\d]/g, "")) || 0;
    if (angka !== minimumPurchase) {
      const r2 = await updateLoyaltyProgramAction({ minimum_purchase: angka });
      if (!r2.ok) {
        setSimpan(false);
        setGalat(r2.error);
        return;
      }
    }

    setSimpan(false);
    setSukses(true);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#f7f6fc] p-4 text-[#1a382d] sm:p-8">
      <form onSubmit={kirim} className="mx-auto max-w-2xl space-y-5">
        <Link
          href="/app/loyalty"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e3de] bg-white"
          title="Kembali ke KAEL Loyalty"
        >
          <ArrowLeft size={17} />
        </Link>

        <header>
          <p className="font-mono text-[11px] font-bold text-[#167052]">KAEL LOYALTY</p>
          <h1 className="text-2xl font-black">Isi Kartu Member</h1>
          <p className="mt-1 text-xs text-[#527867]">
            Yang ditulis di sini muncul di kartu yang dipegang pelanggan. Logo dan warna
            sudah disiapkan tim KAEL dan ikut otomatis.
          </p>
        </header>

        {galat && (
          <p className="flex items-start gap-2 rounded-xl border-2 border-[#c2410c] bg-[#fff7ed] p-3 text-sm font-bold text-[#c2410c]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {galat}
          </p>
        )}
        {sukses && (
          <p className="flex items-center gap-2 rounded-xl border-2 border-[#15803d] bg-[#f0fdf4] p-3 text-sm font-bold text-[#15803d]">
            <Check size={16} /> Tersimpan. Kartu member semua pelanggan langsung ikut berubah.
          </p>
        )}

        {/* ------------------------------------------------- CARA DAPAT STEMPEL */}
        <section className="space-y-3 rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div>
            <h2 className="text-sm font-black">Cara pelanggan dapat {mode === "stamp" ? "stempel" : "poin"}</h2>
            <p className="mt-0.5 text-[11px] text-[#527867]">
              {mode === "stamp"
                ? "Satu kali datang dengan belanja minimal di bawah ini dapat 1 stempel."
                : "Mode program sekarang POIN. Ganti ke stempel lewat pengaturan program di halaman Loyalty."}
            </p>
          </div>

          <label className="block text-xs font-bold">
            Minimal belanja untuk dapat {mode === "stamp" ? "1 stempel" : "poin"}
            <input
              value={minimal}
              onChange={(e) => setMinimal(e.target.value)}
              inputMode="numeric"
              placeholder="50000"
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 font-mono text-sm font-bold"
            />
            <span className="mt-1 block font-normal text-[11px] text-[#527867]">
              {Number(minimal.replace(/[^\d]/g, "")) > 0
                ? `Belanja di bawah ${rupiah(Number(minimal.replace(/[^\d]/g, "")))} tidak dapat apa-apa.`
                : "Kosong atau 0 berarti semua nominal dapat."}
            </span>
          </label>

          <p className="rounded-xl border border-[#d8e3de] bg-[#fcfcfe] p-3 text-[11px] leading-relaxed text-[#527867]">
            {targetStempel
              ? `Kartu stempel pelanggan menggambar ${targetStempel} kotak, mengikuti harga hadiah termurah yang aktif. Ubah jumlahnya lewat harga hadiah di halaman Loyalty — supaya jumlah kotak dan harga hadiah tidak pernah berbeda.`
              : "Belum ada hadiah aktif, jadi kartu pelanggan menggambar 10 kotak sebagai bawaan. Buat hadiah dulu di halaman Loyalty."}
          </p>

          {mode === "stamp" && (
            <div className="rounded-xl border border-[#d8e3de] bg-[#c8f53a] p-3">
              <p className="text-sm font-black">Kartu stempel fisik siap cetak</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#527867]">Formatnya dua sisi ukuran kartu dompet: depan berisi {targetStempel ?? 10} lingkaran stempel, belakang berisi aturan main. Cetak di kertas tebal agar tahan dibawa anak-anak.</p>
              <button type="button" onClick={cetakKartuStempel} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8e3de] bg-white px-4 text-xs font-black shadow-xs"><Printer size={15} /> Cetak Kartu Stempel</button>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------ ISI */}
        <section className="space-y-3 rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <h2 className="text-sm font-black">Isi kartu</h2>

          <label className="block text-xs font-bold">
            Judul kecil di kepala kartu
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, 60))}
              placeholder="Kartu Stempel Member"
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="block text-xs font-bold">
            Sapaan / cara main
            <textarea
              value={welcome}
              onChange={(e) => setWelcome(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="Setiap belanja minimal Rp50.000 dapat 1 stempel. Kumpulkan 10 stempel, tukar jadi kopi gratis."
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 text-sm font-normal"
            />
            <span className="mt-0.5 block text-right font-mono text-[10px] font-normal text-[#527867]">
              {welcome.length}/200
            </span>
          </label>

          <label className="block text-xs font-bold">
            Kabar minggu ini <span className="font-normal text-[#527867]">(opsional)</span>
            <textarea
              value={kabar}
              onChange={(e) => setKabar(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Minggu ini: Croissant beli 2 gratis 1, khusus member."
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 text-sm font-normal"
            />
            <span className="mt-0.5 block font-normal text-[11px] text-[#527867]">
              Muncul menonjol di atas kartu. Kosongkan kalau tidak ada kabar.
            </span>
          </label>
        </section>

        {/* --------------------------------------------------------- KONTAK */}
        <section className="space-y-3 rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <h2 className="text-sm font-black">Kontak dan info toko</h2>

          <label className="block text-xs font-bold">
            Nomor WhatsApp toko
            <input
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              inputMode="tel"
              placeholder="081234567890"
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 font-mono text-sm font-bold"
            />
            <span className="mt-1 block font-normal text-[11px] leading-relaxed text-[#527867]">
              Ini yang membuat tombol <b>Simpan kartu ke WhatsApp</b> muncul. Pelanggan
              mengirim kartunya sebagai chat ke nomor ini, jadi tautannya tersimpan di
              WhatsApp mereka sendiri dan tidak hilang. Tanpa nomor, tombolnya tidak
              ditampilkan sama sekali.
            </span>
          </label>

          <label className="block text-xs font-bold">
            Jam buka
            <input
              value={jam}
              onChange={(e) => setJam(e.target.value.slice(0, 120))}
              placeholder="Setiap hari 08.00 - 22.00"
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="block text-xs font-bold">
            Instagram <span className="font-normal text-[#527867]">(tanpa @)</span>
            <input
              value={ig}
              onChange={(e) => setIg(e.target.value.slice(0, 100))}
              placeholder="kaelcafe"
              className="mt-1 w-full rounded-lg border border-[#d8e3de] px-3 py-2 font-mono text-sm font-normal"
            />
          </label>

          <label className="flex items-start gap-2.5 text-xs font-bold">
            <input
              type="checkbox"
              checked={tampilkanMenu}
              onChange={(e) => setTampilkanMenu(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#232331]"
            />
            <span>
              Tampilkan daftar menu di kartu member
              <span className="mt-0.5 block font-normal text-[11px] text-[#527867]">
                Menu diambil otomatis dari KAEL POS. Matikan kalau usahamu tidak punya menu.
              </span>
            </span>
          </label>

          <p className="rounded-xl border border-[#d8e3de] bg-[#fcfcfe] p-3 text-[11px] leading-relaxed text-[#527867]">
            Alamat toko diambil dari data tenant dan diatur tim KAEL. Hubungi KAEL kalau
            alamatnya berubah.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={simpan}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d8e3de] bg-[#c8f53a] px-4 py-3 text-sm font-black disabled:opacity-60"
          >
            {simpan && <Loader2 size={15} className="animate-spin" />}
            Simpan
          </button>
          {storeCode && (
            <a
              href={`/loyalty/register?toko=${encodeURIComponent(storeCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d8e3de] bg-white px-4 py-3 text-sm font-black"
            >
              <ExternalLink size={15} /> Lihat form daftar
            </a>
          )}
        </div>
      </form>
    </main>
  );
}

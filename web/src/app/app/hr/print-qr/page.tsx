import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Sparkles, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import qrcode from "qrcode-generator";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { BusinessMark } from "@/components/business-mark";
import PrintButton from "./print-button";

type SiteRow = {
  id: string;
  name: string;
  qr_token: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
};

export default async function PrintAttendanceQrPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getSession();
  if (!session?.businessId || session.role !== "owner") {
    redirect("/app/login?next=/app/hr");
  }

  const { token } = await searchParams;
  const business = await db.getBusiness(session.businessId);

  // Cari site berdasarkan token, atau fallback ke site aktif pertama milik business
  let site: SiteRow | null = token ? ((await db.getAttendanceSiteByToken(session.businessId, token)) as SiteRow | null) : null;
  if (!site) {
    const hr = await db.getHrDashboard(session.businessId);
    site = ((hr.sites as any[])?.[0] as SiteRow | undefined) ?? null;
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-[#f0f5f2] p-8 flex items-center justify-center font-sans">
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 text-center max-w-md shadow-sm">
          <p className="text-sm font-bold text-rose-700">Titik absensi belum dibuat.</p>
          <p className="text-xs text-[#527867] mt-1">Buat titik absensi di dasbor HR terlebih dahulu.</p>
          <Link href="/app/hr" className="inline-block mt-4 text-xs font-bold text-[#0b3d2e] underline">
            Kembali ke HR Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const qrUrl = `https://kaels.site/app/hr/attendance?site=${site.qr_token}`;
  const qr = qrcode(0, "M");
  qr.addData(qrUrl);
  qr.make();
  const svg = qr.createSvgTag({ scalable: true, margin: 2 });

  return (
    <div className="min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans pb-12 print:bg-white print:p-0 print:m-0">
      {/* Top Bar - Hidden on print */}
      <header className="print:hidden border-b border-emerald-800/60 bg-[#0b3d2e] px-4 py-3 text-white sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/app/hr"
            className="flex items-center gap-2 text-xs font-bold text-emerald-200 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Kembali ke Dasbor HR
          </Link>
          <PrintButton />
        </div>
      </header>

      {/* Main Print Container */}
      <main className="mx-auto max-w-xl p-4 sm:p-6 print:p-0 print:max-w-none">
        {/* Printable Standee Sheet */}
        <div className="rounded-3xl border-2 border-[#0b3d2e] bg-white p-8 sm:p-10 shadow-xl print:shadow-none print:border-2 print:border-[#0b3d2e] print:rounded-2xl print:p-8">
          {/* Header */}
          <div className="text-center space-y-3 border-b-2 border-emerald-800/10 pb-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b3d2e] text-[#c8f53a] shadow-md">
              <BusinessMark
                name={business?.name}
                logoUrl={business?.logo_url}
                brandColor={business?.brand_color}
                size="md"
                className="h-12 w-12 rounded-xl"
              />
            </div>
            <div>
              <span className="rounded-full bg-[#edf8f3] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-[#167052] border border-emerald-200">
                PRESENSI DIGITAL RESMI
              </span>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black text-[#0b3d2e] tracking-tight">
                {business?.name ?? "Mochi Cafe n Resto"}
              </h1>
              <p className="text-xs text-[#527867] font-medium mt-1">
                Scan QR Code ini dengan kamera smartphone saat masuk &amp; pulang kerja
              </p>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="my-8 flex flex-col items-center justify-center">
            <div className="rounded-3xl border-4 border-[#0b3d2e] bg-white p-5 shadow-lg max-w-[280px] w-full aspect-square flex items-center justify-center print:border-4 print:shadow-none">
              <div
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:text-[#0b3d2e]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
            <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#167052]">
              <MapPin size={13} />
              <span>Titik: {site.name} (Geofence Aktif)</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl bg-[#edf8f3] border border-emerald-200 p-5 space-y-3">
            <h2 className="font-mono text-xs font-black uppercase text-[#0b3d2e] flex items-center gap-2">
              <Smartphone size={15} /> 3 Langkah Mudah Absensi Staf:
            </h2>
            <ol className="space-y-2 text-xs text-[#1e483a] font-medium pl-4 list-decimal">
              <li>
                <strong className="text-[#0b3d2e]">Buka Kamera HP:</strong> Scan QR code di atas, atau buka browser ke tautan absensi.
              </li>
              <li>
                <strong className="text-[#0b3d2e]">Pilih Nama &amp; PIN:</strong> Pilih nama Anda dari daftar, lalu masukkan PIN Anda.
              </li>
              <li>
                <strong className="text-[#0b3d2e]">Selfie &amp; Simpan:</strong> Jepret foto selfie wajah, lalu tekan tombol <em>Absen Masuk</em> atau <em>Absen Pulang</em>.
              </li>
            </ol>
          </div>

          {/* Security badge footer */}
          <div className="mt-6 pt-4 border-t border-[#edf4f0] flex items-center justify-between text-[10px] text-[#637970] font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#167052]" />
              <span>Verifikasi Biometrik &amp; Geofence GPS</span>
            </div>
            <span>Powered by KAEL System</span>
          </div>
        </div>
      </main>
    </div>
  );
}

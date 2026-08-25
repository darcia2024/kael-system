"use client";

import { useState } from "react";
import { ArrowUpRight, Calculator, CalendarCheck, ClipboardList, Gift, Puzzle, Receipt, Sparkles, Star, Users } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const modulesList = [
  {
    icon: Star,
    name: "KAEL Review (NFC & QR)",
    status: "Best Seller • Siap Pakai",
    badgeColor: "bg-[#feebee] text-[#ef233c]",
    blurb: "Undang ulasan organik Google Maps di kasir atau meja tamu.",
    description: "Kartu akrilik tap NFC dan standee QR yang membuka halaman ulasan Google toko Anda seketika tanpa perlu install aplikasi apa pun.",
    features: ["Chip NFC NTAG213 tahan air", "QR Code backup di kartu", "Tautan langsung ke Google Maps", "Desain standar resmi KAEL + Bonus file desain poster"],
    fitFor: "Cafe, Resto, Barbershop, Salon, Klinik, Toko Retail",
    href: cta.orderReview.href,
  },
  {
    icon: Receipt,
    name: "KAEL POS & Kasir Digital",
    status: "Populer",
    badgeColor: "bg-[#edf2f4] text-[#2b2d42]",
    blurb: "Pencatatan transaksi kilat & cetak struk bluetooth.",
    description: "Aplikasi kasir ringan di tablet/smartphone untuk mencatat penjualan, split bill, dukung pembayaran QRIS, dan rekap omzet harian otomatis.",
    features: ["Cetak struk thermal bluetooth", "Terima pembayaran QRIS & Tunai", "Laporan omzet harian realtime", "Bisa mode multi-kasir/shift"],
    fitFor: "F&B, Retail, Butik, Toko Bahan, Minimarket",
    href: cta.consult.href,
  },
  {
    icon: Calculator,
    name: "KAEL Finance & Kalkulator HPP",
    status: "Rekomendasi",
    badgeColor: "bg-[#dff3e9] text-[#17795d]",
    blurb: "Hitung harga pokok produksi per resep & margin laba.",
    description: "Ketahui modal bahan baku presisi setiap menu/produk. Deteksi kenaikan harga bahan sebelum menggerus laba bersih usaha Anda.",
    features: ["Hitung biaya bahan baku per porsi", "Analisis menu paling menguntungkan", "Lacak fluktuasi harga supplier", "Kalkulasi laba kotor & bersih"],
    fitFor: "Coffee Shop, Restoran, Bakery, Usaha Katering",
    href: cta.consult.href,
  },
  {
    icon: Gift,
    name: "KAEL Loyalty & Poin WhatsApp",
    status: "Siap Pakai",
    badgeColor: "bg-[#edf2f4] text-[#2b2d42]",
    blurb: "Program reward pelanggan otomatis berbasis nomor WA.",
    description: "Kumpulkan database pelanggan setiap transaksi. Berikan poin otomatis dan kirim pengingat reward tanpa biaya SMS/iklan mahal.",
    features: ["Poin otomatis per nominal belanja", "Notifikasi saldo poin via WA", "Tukarkan reward dengan mudah", "Database kontak pelanggan aman"],
    fitFor: "Cafe, Butik, Salon, Barbershop, Laundry",
    href: cta.consult.href,
  },
  {
    icon: CalendarCheck,
    name: "KAEL Booking & Reservasi",
    status: "Praktis",
    badgeColor: "bg-[#edf2f4] text-[#2b2d42]",
    blurb: "Sistem reservasi online mandiri tanpa bentrok jadwal.",
    description: "Pelanggan memilih jam layanan dan terapis/kapster favorit secara mandiri lewat link khusus, mengurangi beban admin toko.",
    features: ["Pemilihan staf & slot waktu", "Pengingat otomatis H-1 jadwal", "Batas kuota antrean realtime", "Dukungan pembayaran DP/Lunas"],
    fitFor: "Barbershop, Salon Kecantikan, Spa, Klinik",
    href: cta.consult.href,
  },
  {
    icon: ClipboardList,
    name: "KAEL Menu QR & Self-Order",
    status: "Efisien",
    badgeColor: "bg-[#edf2f4] text-[#2b2d42]",
    blurb: "Pelanggan pesan dan bayar mandiri dari meja makan.",
    description: "Kurangi antrean kasir di jam sibuk dengan buku menu digital di setiap meja yang langsung terhubung ke printer kasir/dapur.",
    features: ["Scan QR di atas meja", "Foto menu & deskripsi interaktif", "Pesanan langsung cetak di dapur", "Update stok menu habis seketika"],
    fitFor: "Restoran, Cafe Luas, Food Court, Rooftop Bar",
    href: cta.consult.href,
  },
  {
    icon: Users,
    name: "KAEL HR & Absensi Karyawan",
    status: "Rapi",
    badgeColor: "bg-[#edf2f4] text-[#2b2d42]",
    blurb: "Absensi GPS smartphone & hitung gaji/komisi otomatis.",
    description: "Pantau kehadiran karyawan toko secara akurat dengan verifikasi lokasi GPS dan rekap jam kerja serta insentif tanpa spreadsheet.",
    features: ["Absen selfie & GPS lokasi", "Rekap jam lembur otomatis", "Perhitungan komisi per omzet", "Slip gaji digital otomatis"],
    fitFor: "Usaha dengan 3–30 Karyawan/Outlet",
    href: cta.consult.href,
  },
  {
    icon: Puzzle,
    name: "KAEL Custom Business System",
    status: "Bisa Disesuaikan",
    badgeColor: "bg-[#feebee] text-[#ef233c]",
    blurb: "Sistem khusus sesuai SOP & alur kerja unik bisnis Anda.",
    description: "Punya alur kerja khusus yang tidak ada di software umum? Tim developer KAEL siap membangun modul khusus yang pas dengan SOP Anda.",
    features: ["Analisis proses bisnis bersama tim", "Desain antarmuka mudah dipahami", "Integrasi hardware (barcode/NFC)", "Garansi pemeliharaan berkala"],
    fitFor: "Distributor, Manufaktur Skala Menengah, Franchise",
    href: cta.consult.href,
  },
];

export function Ecosystem() {
  return (
    <section id="solusi" className="py-16 sm:py-24">
      <Container>
        {/* Section Header */}
        <div className="mx-auto max-w-[760px] text-center">
          <Reveal>
            <span className="text-xs font-normal tracking-widest text-[#8d99ae] uppercase">
              Katalog Ekosistem KAEL
            </span>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[#2b2d42] sm:text-5xl">
              Modul Digital Lengkap, Pilih Sesuai Kebutuhan
            </h2>
            <p className="mt-4 text-sm font-light leading-relaxed text-[#8d99ae] sm:text-base">
              Semua modul bersifat modular dan berdiri sendiri. Anda bisa mulai dari 1 modul
              yang paling mendesak, lalu menambah modul lain saat skala usaha Anda makin besar.
            </p>
          </Reveal>
        </div>

        {/* 8-Card Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {modulesList.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.name} delay={i * 0.05}>
                <div className="flex h-full flex-col justify-between rounded-[28px] border border-[#d2dae2] bg-white p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#2b2d42]/30 hover:shadow-md">
                  <div>
                    {/* Top Status & Icon */}
                    <div className="flex items-center justify-between border-b border-[#edf2f4] pb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2f4] text-[#2b2d42]">
                        <Icon size={20} strokeWidth={1.75} />
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${item.badgeColor}`}>
                        {item.status}
                      </span>
                    </div>

                    <h3 className="mt-5 text-base font-medium text-[#2b2d42]">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs font-normal text-[#ef233c]">
                      {item.blurb}
                    </p>
                    <p className="mt-2.5 text-xs font-light leading-relaxed text-[#8d99ae]">
                      {item.description}
                    </p>

                    {/* Features list */}
                    <ul className="mt-5 space-y-1.5 border-t border-[#edf2f4] pt-4 text-[11px] font-light text-[#2b2d42]">
                      {item.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#17795d]" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Suitable for */}
                    <div className="mt-4 rounded-xl bg-[#edf2f4]/60 p-2.5 text-[10px] font-light text-[#8d99ae]">
                      <strong className="font-medium text-[#2b2d42]">Cocok untuk:</strong> {item.fitFor}
                    </div>
                  </div>

                  {/* Bottom Action Link */}
                  <div className="mt-6 border-t border-[#edf2f4] pt-4">
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2b2d42] transition-colors hover:text-[#ef233c]"
                    >
                      <span>Pelajari / Pesan Modul Ini</span>
                      <ArrowUpRight size={13} strokeWidth={2} />
                    </a>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

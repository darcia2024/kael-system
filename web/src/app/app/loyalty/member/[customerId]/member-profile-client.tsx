"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Gift,
  History,
  Receipt,
  ShoppingBag,
  Ticket,
  UserRound,
} from "lucide-react";

import { Crown } from "lucide-react";
import type { CustomerProfileSummary, LoyaltyProgram, PointLedger, Redemption, Reward, LoyaltyTier } from "@/lib/types";
import { formatBusinessDate, formatBusinessDateTime, formatRupiah } from "@/lib/formatters";
import { maskPhoneNumber, resolveTier } from "@/lib/loyalty-engine";

type Props = {
  profile: CustomerProfileSummary;
  program: LoyaltyProgram;
  rewards: Reward[];
  ledger: PointLedger[];
  redemptions: Redemption[];
  tiers: LoyaltyTier[];
  business?: import("@/lib/types").Business | null;
  themeClassName?: string;
};

function getMemberStatus(profile: CustomerProfileSummary) {
  if (!profile.purchase_count || !profile.last_activity_at) {
    return { label: "Belum belanja", note: "Member sudah daftar, tapi belum ada transaksi yang tercatat.", tone: "amber" };
  }

  const daysSinceVisit = Math.floor((Date.now() - new Date(profile.last_activity_at).getTime()) / 86_400_000);
  if (daysSinceVisit <= 30) {
    return { label: "Aktif", note: "Masih berbelanja dalam 30 hari terakhir.", tone: "green" };
  }
  return { label: "Perlu dihubungi", note: `Sudah ${daysSinceVisit} hari tidak ada transaksi yang tercatat.`, tone: "orange" };
}

function eventLabel(item: PointLedger) {
  switch (item.reason) {
    case "purchase":
      return "Belanja tercatat";
    case "redeem":
      return "Hadiah ditukar";
    case "birthday":
      return "Bonus ulang tahun";
    case "manual":
      return "Poin ditambah manual";
    case "correction":
      return "Penyesuaian poin";
    case "expiry":
      return "Poin kedaluwarsa";
  }
}

export default function MemberProfileClient({ profile, program, rewards, ledger, redemptions, tiers, themeClassName }: Props) {
  const status = getMemberStatus(profile);
  const currentTier = program.tiers_is_active ? resolveTier(Number(profile.lifetime_spend), tiers) : null;
  const nextReward = rewards
    .filter((reward) => reward.is_active && reward.point_cost > profile.balance)
    .sort((a, b) => a.point_cost - b.point_cost)[0];
  const activeReward = rewards
    .filter((reward) => reward.is_active && reward.point_cost <= profile.balance)
    .sort((a, b) => b.point_cost - a.point_cost)[0];
  const unit = program.mode === "stamp" ? "stempel" : "poin";
  const initials = (profile.name || "M").trim().slice(0, 1).toUpperCase();
  const statusClass = {
    green: "border-[#15803d] bg-[#dcfce7] text-[#166534]",
    amber: "border-[#b45309] bg-[#fef3c7] text-[#92400e]",
    orange: "border-[#c2410c] bg-[#ffedd5] text-[#9a3412]",
  }[status.tone];

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#1a382d]">
      <header className="sticky top-0 z-30 border-b-2 border-[#d8e3de] bg-white px-3 py-2.5 sm:px-8 sm:py-3.5">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/app/loyalty"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#1a382d] shadow-xs transition-colors hover:bg-[#f0edff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            aria-label="Kembali ke KAEL Loyalty"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold text-[#167052]">KAEL LOYALTY</p>
            <h1 className="truncate text-sm font-extrabold sm:text-base">Profil Member</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 pb-10 sm:space-y-6 sm:px-6 sm:py-8">
        <section className="border border-[#d8e3de] bg-[#0b3d2e] p-4 text-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#d9ff57] bg-[#0b3d2e] text-xl font-black text-[#c8f53a] sm:h-16 sm:w-16">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold text-[#c8f53a]">RINGKASAN MEMBER</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-black sm:text-2xl">{profile.name || "Member"}</h2>
                  {currentTier && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d9ff57] bg-[#3a3950] px-2.5 py-0.5 text-[10.5px] font-bold text-[#c8f53a]">
                      <Crown size={11} />
                      {currentTier.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#dedee8]">{maskPhoneNumber(profile.phone)} · Gabung {formatBusinessDate(profile.created_at)}</p>
              </div>
            </div>
            <div className={`w-fit rounded-lg border px-3 py-2 text-xs font-bold ${statusClass}`}>
              <span className="block">{status.label}</span>
              <span className="mt-0.5 block font-normal">{status.note}</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
          <Metric icon={<CircleDollarSign size={16} />} label="Total belanja" value={formatRupiah(profile.lifetime_spend)} />
          <Metric icon={<ShoppingBag size={16} />} label="Kunjungan" value={`${profile.purchase_count} kali`} />
          <Metric icon={<Gift size={16} />} label={`Saldo ${unit}`} value={`${profile.balance} ${unit}`} />
          <Metric icon={<Clock3 size={16} />} label="Terakhir aktif" value={profile.last_activity_at ? formatBusinessDate(profile.last_activity_at) : "Belum ada"} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
          <div className="border border-[#d8e3de] bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-3">
              <History size={18} className="text-[#167052]" />
              <div>
                <h3 className="text-sm font-extrabold">Urutan aktivitas</h3>
                <p className="text-xs text-[#527867]">Belanja, penukaran hadiah, dan perubahan poin member ini.</p>
              </div>
            </div>

            {ledger.length ? (
              <ol className="mt-2 divide-y divide-[#dedee8]">
                {ledger.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.delta > 0 ? "border-[#15803d] bg-[#dcfce7] text-[#166534]" : "border-[#c2410c] bg-[#ffedd5] text-[#9a3412]"}`}>
                      {item.reason === "purchase" ? <Receipt size={16} /> : <Ticket size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{eventLabel(item)}</p>
                      <p className="mt-0.5 text-xs text-[#527867]">{item.note || "Tidak ada catatan tambahan."}</p>
                      <p className="mt-1 font-mono text-[10px] text-[#527867]">{formatBusinessDateTime(item.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-sm font-black ${item.delta > 0 ? "text-[#166534]" : "text-[#9a3412]"}`}>{item.delta > 0 ? `+${item.delta}` : item.delta}</p>
                      {item.amount_spent && <p className="mt-0.5 text-[10px] text-[#527867]">{formatRupiah(item.amount_spent)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="py-10 text-center">
                <CalendarDays className="mx-auto text-[#167052]" size={26} />
                <p className="mt-3 text-sm font-bold">Belum ada aktivitas</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-[#527867]">Setelah kasir menghubungkan transaksi ke member ini, riwayatnya akan muncul di sini.</p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="border border-[#d8e3de] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <UserRound size={17} className="text-[#167052]" />
                <h3 className="text-sm font-extrabold">Catatan member</h3>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] pb-3">
                  <dt className="text-[#527867]">Poin pernah masuk</dt>
                  <dd className="font-mono font-black">{profile.points_earned} {unit}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] pb-3">
                  <dt className="text-[#527867]">Hadiah ditukar</dt>
                  <dd className="font-mono font-black">{redemptions.length} kali</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#527867]">Ulang tahun</dt>
                  <dd className="font-medium">{profile.birthday ? formatBusinessDate(profile.birthday) : "Belum diisi"}</dd>
                </div>
              </dl>
            </div>

            <div className="border border-[#d8e3de] bg-[#f0edff] p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Gift size={17} className="text-[#167052]" />
                <h3 className="text-sm font-extrabold">Peluang berikutnya</h3>
              </div>
              {activeReward ? (
                <p className="mt-3 text-sm leading-5">Saldo member sudah cukup untuk menukar <strong>{activeReward.name}</strong>. Kasir bisa menawarkan hadiah ini saat pelanggan datang.</p>
              ) : nextReward ? (
                <p className="mt-3 text-sm leading-5">Member masih kurang <strong>{nextReward.point_cost - profile.balance} {unit}</strong> untuk <strong>{nextReward.name}</strong>. Ini bisa dipakai sebagai alasan untuk mengajak belanja kembali.</p>
              ) : (
                <p className="mt-3 text-sm leading-5">Belum ada hadiah aktif yang bisa dihitung dari saldo member ini.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border border-[#d8e3de] bg-white p-3 shadow-xs sm:p-4">
      <div className="flex items-center gap-2 text-[#167052]">
        {icon}
        <span className="text-[10px] font-bold text-[#527867]">{label}</span>
      </div>
      <p className="mt-2 break-words font-mono text-base font-black leading-tight sm:text-lg">{value}</p>
    </div>
  );
}

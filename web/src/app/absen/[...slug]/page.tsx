import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mochiThemeClass } from "@/lib/mochi-theme";
import PersonalAttendanceClient from "./personal-attendance-client";

export const metadata: Metadata = {
  title: "Presensi Staf - KAEL",
  robots: { index: false, follow: false },
};

export default async function PersonalAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ toko?: string }>;
}) {
  const { slug } = await params;
  const { toko } = await searchParams;

  if (!slug || slug.length === 0) {
    notFound();
  }

  // Handle 1 segment (/absen/rizka) or 2 segments (/absen/mochikafe/rizka)
  let staffSlug = slug[0];
  let storeCodeParam = toko;

  if (slug.length >= 2) {
    storeCodeParam = slug[0];
    staffSlug = slug[1];
  }

  const staff = await db.getStaffByAttendanceSlug(staffSlug, storeCodeParam);

  if (!staff) {
    return (
      <div className="min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-[#d8e3de] p-8 max-w-sm text-center shadow-lg space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold">
            !
          </div>
          <h1 className="text-lg font-black text-[#0b3d2e]">Tautan Staf Tidak Ditemukan</h1>
          <p className="text-xs text-[#527867] leading-relaxed">
            Tautan presensi personal untuk <strong>&quot;{staffSlug}&quot;</strong> belum terdaftar atau tidak aktif.
            Silakan hubungi pemilik usaha untuk mendapatkan tautan presensi Anda.
          </p>
        </div>
      </div>
    );
  }

  const business = await db.getBusiness(staff.business_id);
  const hr = await db.getHrDashboard(staff.business_id);
  const site = ((hr.sites as any[])?.[0] as {
    id: string;
    name: string;
    qr_token: string;
    latitude: number | null;
    longitude: number | null;
    allowed_radius_meters: number;
  } | undefined) ?? null;

  const session = await getSession();
  const initialIsAuthenticated = session?.userId === staff.id;

  // Ambil catatan absensi hari ini untuk staf ini
  const todayAttendance = hr.attendance.filter(
    (a: any) =>
      a.user_id === staff.id &&
      a.check_in_at &&
      new Date(a.check_in_at).toDateString() === new Date().toDateString()
  );

  const [monthlyAttendance, sopChecklists, leaveRequests, paystubs] = await Promise.all([
    db.getStaffMonthlyAttendanceSummary(staff.business_id, staff.id),
    db.getStaffSopChecklists(staff.business_id, staff.id),
    db.getLeaveRequestsForUser(staff.business_id, staff.id),
    db.getStaffPaystubs(staff.business_id, staff.id),
  ]);

  return (
    <PersonalAttendanceClient
      staff={{ id: staff.id, name: staff.name }}
      business={business}
      site={site}
      policy={hr.policy as { attendance_require_selfie: boolean; attendance_require_location: boolean }}
      initialIsAuthenticated={initialIsAuthenticated}
      todayAttendance={todayAttendance}
      monthlyAttendance={monthlyAttendance}
      initialSopChecklists={sopChecklists as any[]}
      initialLeaveRequests={leaveRequests as any[]}
      initialPaystubs={paystubs as any[]}
      themeClassName={mochiThemeClass(business)}
    />
  );
}


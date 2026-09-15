"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  MapPin,
  Plus,
  ReceiptText,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Business } from "@/lib/types";
import { BusinessMark } from "@/components/business-mark";
import {
  cancelStaffScheduleAction,
  createLeaveForStaffAction,
  createPayrollPeriodAction,
  resolveAttendancePlaceAction,
  reviewLeaveRequestAction,
  saveAttendancePolicyAction,
  saveAttendanceSiteAction,
  savePayrollLineAction,
  saveStaffScheduleAction,
  searchAttendancePlacesAction,
  setPayrollPeriodStatusAction,
  setPosSchedulePolicyAction,
} from "@/lib/actions-operations";

type Staff = { id: string; name: string; role: string };
type Schedule = {
  id: string;
  user_id: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  role_label: string | null;
  pos_shift_allowed: boolean;
  status: string;
};
type Attendance = {
  id: string;
  staff_name: string;
  check_in_at: string | null;
  check_out_at: string | null;
  method: string;
};
type Site = {
  id: string;
  name: string;
  qr_token: string;
  latitude: number | null;
  allowed_radius_meters: number;
};
type Request = {
  id: string;
  user_id: string;
  staff_name: string;
  leave_type: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: string;
};
type Period = {
  id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "paid";
  total_pay: number | string;
};
type Line = {
  id: string;
  payroll_period_id: string;
  user_id: string;
  staff_name: string;
  base_pay: number | string;
  overtime_pay: number | string;
  incentive_pay: number | string;
  commission_pay: number | string;
  deduction: number | string;
  note: string | null;
};
type Summary = {
  id: string;
  name: string;
  attendance_count: number;
  completed_count: number;
  open_count: number;
  hours_worked: number | string;
};
type Data = {
  staff: Staff[];
  schedules: Schedule[];
  attendance: Attendance[];
  sites: Site[];
  requests: Request[];
  periods: Period[];
  payrollLines: Line[];
  attendanceSummary: Summary[];
  policy: {
    attendance_require_selfie: boolean;
    attendance_require_location: boolean;
    pos_require_scheduled_shift: boolean;
  };
};

const fmt = (v: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const time = (v: string) =>
  new Date(v).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function HrClient({
  data,
  business,
  themeClassName = "",
}: {
  data: Data;
  business?: Business | null;
  themeClassName?: string;
}) {
  const first =
    data.staff.find((x) => x.role === "staff")?.id || data.staff[0]?.id || "";
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [staff, setStaff] = useState(first);
  const [shift, setShift] = useState({
    startsAt: "",
    endsAt: "",
    roleLabel: "Kasir",
    pos: true,
  });
  const [policy, setPolicy] = useState({
    selfie: data.policy.attendance_require_selfie,
    location: data.policy.attendance_require_location,
    pos: data.policy.pos_require_scheduled_shift,
  });
  const [site, setSite] = useState({
    name: "",
    placeId: "",
    latitude: "",
    longitude: "",
    radius: "150",
  });
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<
    { placeId: string; name: string; address: string }[]
  >([]);
  const [leave, setLeave] = useState({
    userId: first,
    leaveType: "leave" as "leave" | "sick" | "permission" | "overtime",
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  const [range, setRange] = useState({ startsOn: "", endsOn: "" });
  const [periodId, setPeriodId] = useState(
    data.periods.find((x) => x.status === "draft")?.id ||
      data.periods[0]?.id ||
      ""
  );
  const [pay, setPay] = useState<Record<string, Record<string, string>>>({});

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string
  ) => {
    setSaving(true);
    const r = await fn();
    setSaving(false);
    setNotice(r.ok ? success : r.error || "Perubahan belum tersimpan.");
    if (r.ok) window.location.reload();
  };

  const searchPlace = async () => {
    setSaving(true);
    const r = await searchAttendancePlacesAction(placeQuery);
    setSaving(false);
    if (!r.ok) {
      setNotice(r.error || "Lokasi Google belum ditemukan.");
      return;
    }
    setPlaceResults(r.data);
    setNotice(
      r.data.length
        ? "Pilih lokasi yang paling sesuai."
        : "Lokasi tidak ditemukan. Coba tambah nama kota atau alamat."
    );
  };

  const resolvePlace = async (placeId: string) => {
    setSaving(true);
    const r = await resolveAttendancePlaceAction(placeId);
    setSaving(false);
    if (!r.ok) {
      setNotice(r.error || "Lokasi Google belum ditemukan.");
      return;
    }
    setSite({
      ...site,
      placeId: r.data.placeId,
      name: site.name || r.data.name,
      latitude: String(r.data.latitude),
      longitude: String(r.data.longitude),
    });
    setPlaceResults([]);
    setNotice("Lokasi Google dipilih: " + r.data.name + ". Koordinat sudah diisi.");
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(
      window.location.origin + "/app/hr/attendance?site=" + token
    );
    setNotice("Tautan QR absensi disalin.");
  };

  const period = data.periods.find((x) => x.id === periodId);
  const lines = data.payrollLines.filter(
    (x) => x.payroll_period_id === periodId
  );
  const pending = data.requests.filter((x) => x.status === "pending");
  const hours = useMemo(
    () =>
      data.attendanceSummary.reduce(
        (a, x) => a + Number(x.hours_worked || 0),
        0
      ),
    [data]
  );
  const val = (line: Line, key: string) =>
    pay[line.id]?.[key] ?? String(Number(line[key as keyof Line] || 0));
  const change = (line: Line, key: string, value: string) =>
    setPay((p) => ({
      ...p,
      [line.id]: { ...p[line.id], [key]: value.replace(/\\D/g, "") },
    }));

  return (
    <div
      className={"kael-hr " + themeClassName + " min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans flex flex-col"}
    >
      {/* Sticky Emerald Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 sm:px-8 py-3 text-white backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors shadow-xs"
              title="Kembali ke Portal Hub"
            >
              <ArrowLeft size={16} />
            </Link>
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base truncate text-white tracking-tight">
                  KAEL HR &amp; Staf
                </h1>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-bold text-[#073829]">
                  Tim &amp; Shift
                </span>
              </div>
              <span className="text-[10.5px] text-emerald-200/80 font-mono block truncate">
                {(business?.name || "Mochi Cafe n Resto") + " · Absensi, Jadwal, & Gaji"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/hr/attendance"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white/10 px-3 py-1.5 text-xs font-mono font-bold text-white hover:bg-white/15 transition-colors"
            >
              Layar Absensi Staf ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8 flex-1">
        {/* Intro */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b3d2e] tracking-tight">
            Tim, Absensi, dan Penggajian
          </h2>
          <p className="mt-1 text-sm text-[#527867]">
            Atur jadwal shift staf, bukti kehadiran GPS/selfie, pengajuan izin, dan rincian gaji dari satu sistem terpadu.
          </p>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            l="Staf aktif"
            v={data.staff.filter((x) => x.role === "staff").length + " orang"}
          />
          <Metric
            l="Absensi 30 hari"
            v={data.attendance.length + " catatan"}
          />
          <Metric l="Jam tercatat" v={hours.toFixed(1) + " jam"} />
          <Metric
            l="Menunggu approval"
            v={pending.length + " pengajuan"}
          />
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-[#eaf6ef] p-4 text-sm font-bold text-[#0b3d2e] shadow-xs"
          >
            {notice}
          </div>
        )}

        {/* Section 1: Policies & Shift Schedule */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Box title="Aturan Absensi dan POS" icon={<ShieldCheck size={18} />}>
            <p className="text-xs text-[#527867]">
              Aturan ini diperiksa server secara otomatis, sehingga tidak dapat dimanipulasi dari perangkat staf.
            </p>
            <Toggle
              text="Wajib selfie saat masuk dan pulang"
              checked={policy.selfie}
              onChange={(v) => setPolicy({ ...policy, selfie: v })}
            />
            <Toggle
              text="Wajib lokasi GPS perangkat"
              checked={policy.location}
              onChange={(v) => setPolicy({ ...policy, location: v })}
            />
            <button
              onClick={() =>
                run(
                  () =>
                    saveAttendancePolicyAction({
                      requireSelfie: policy.selfie,
                      requireLocation: policy.location,
                    }),
                  "Aturan absensi disimpan."
                )
              }
              disabled={saving}
              className="primary"
            >
              Simpan aturan absensi
            </button>
            <div className="mt-5 border-t border-[#d8e3de] pt-4">
              <Toggle
                text="Kasir wajib punya jadwal shift untuk buka POS"
                checked={policy.pos}
                onChange={(v) => setPolicy({ ...policy, pos: v })}
              />
              <p className="mt-1 text-xs text-[#527867]">
                Owner tetap dapat membuka POS kapan saja. Aktifkan setelah jadwal shift mulai diterapkan.
              </p>
              <button
                onClick={() =>
                  run(
                    () => setPosSchedulePolicyAction(policy.pos),
                    "Aturan shift POS disimpan."
                  )
                }
                disabled={saving}
                className="secondary mt-3"
              >
                Simpan aturan POS
              </button>
            </div>
          </Box>

          <Box title="Buat Jadwal Shift" icon={<CalendarClock size={18} />}>
            <p className="text-xs text-[#527867]">
              Jadwal yang bertabrakan untuk staf yang sama akan diverifikasi dan dicegah otomatis.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field l="Pilih Staf">
                <select
                  value={staff}
                  onChange={(e) => setStaff(e.target.value)}
                  className="field"
                >
                  {data.staff.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field l="Tugas / Posisi Shift">
                <input
                  value={shift.roleLabel}
                  onChange={(e) =>
                    setShift({ ...shift, roleLabel: e.target.value })
                  }
                  placeholder="Contoh: Kasir, Barista"
                  className="field"
                />
              </Field>
              <Field l="Waktu Mulai">
                <input
                  required
                  type="datetime-local"
                  value={shift.startsAt}
                  onChange={(e) =>
                    setShift({ ...shift, startsAt: e.target.value })
                  }
                  className="field"
                />
              </Field>
              <Field l="Waktu Selesai">
                <input
                  required
                  type="datetime-local"
                  value={shift.endsAt}
                  onChange={(e) =>
                    setShift({ ...shift, endsAt: e.target.value })
                  }
                  className="field"
                />
              </Field>
            </div>
            <Toggle
              text="Staf boleh buka shift kasir POS pada jam ini"
              checked={shift.pos}
              onChange={(v) => setShift({ ...shift, pos: v })}
            />
            <button
              onClick={() =>
                run(
                  () =>
                    saveStaffScheduleAction({
                      userId: staff,
                      startsAt: new Date(shift.startsAt).toISOString(),
                      endsAt: new Date(shift.endsAt).toISOString(),
                      roleLabel: shift.roleLabel,
                      posShiftAllowed: shift.pos,
                    }),
                  "Jadwal shift disimpan."
                )
              }
              disabled={saving || !staff || !shift.startsAt || !shift.endsAt}
              className="primary"
            >
              Simpan jadwal shift
            </button>
          </Box>
        </section>

        {/* Section 2: Attendance Sites & Active Schedules */}
        <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <Box title="Tambah Titik Absensi" icon={<MapPin size={18} />}>
            <p className="text-xs text-[#527867]">
              Cari nama usaha atau alamat. KAEL mengambil Place ID dan koordinat resmi langsung dari Google Maps.
            </p>
            <Field l="Cari Lokasi Google Maps">
              <div className="flex gap-2">
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPlace();
                    }
                  }}
                  placeholder="Contoh: Mochi Cafe n Resto"
                  className="field"
                />
                <button
                  type="button"
                  onClick={searchPlace}
                  disabled={saving || placeQuery.trim().length < 3}
                  className="secondary shrink-0 mt-1"
                >
                  Cari
                </button>
              </div>
            </Field>

            {placeResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] divide-y divide-[#e5ede9]">
                {placeResults.map((place) => (
                  <button
                    type="button"
                    key={place.placeId}
                    onClick={() => resolvePlace(place.placeId)}
                    className="w-full p-3 text-left text-xs transition-colors hover:bg-[#edf8f3]"
                  >
                    <b className="text-[#0b3d2e] block text-sm">{place.name}</b>
                    <span className="mt-0.5 block text-[11px] text-[#527867]">
                      {place.address}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Field l="Place ID Terpilih">
              <input
                value={site.placeId}
                readOnly
                placeholder="Akan terisi otomatis saat lokasi dipilih"
                className="field bg-[#f0f5f2]/80 text-[#527867]"
              />
            </Field>
            <Field l="Nama Titik Outlet">
              <input
                required
                value={site.name}
                onChange={(e) => setSite({ ...site, name: e.target.value })}
                placeholder="Contoh: Outlet Utama Mochi"
                className="field"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field l="Latitude">
                <input
                  value={site.latitude}
                  onChange={(e) =>
                    setSite({ ...site, latitude: e.target.value })
                  }
                  className="field"
                />
              </Field>
              <Field l="Longitude">
                <input
                  value={site.longitude}
                  onChange={(e) =>
                    setSite({ ...site, longitude: e.target.value })
                  }
                  className="field"
                />
              </Field>
            </div>
            <Field l="Radius Toleransi (Meter)">
              <input
                type="number"
                min="10"
                max="5000"
                value={site.radius}
                onChange={(e) => setSite({ ...site, radius: e.target.value })}
                className="field"
              />
            </Field>
            <button
              onClick={() =>
                run(
                  () =>
                    saveAttendanceSiteAction({
                      name: site.name,
                      googlePlaceId: site.placeId || undefined,
                      latitude: site.latitude
                        ? Number(site.latitude)
                        : undefined,
                      longitude: site.longitude
                        ? Number(site.longitude)
                        : undefined,
                      radiusMeters: Number(site.radius),
                    }),
                  "Titik absensi dibuat."
                )
              }
              disabled={saving || !site.name}
              className="primary"
            >
              <Plus size={16} /> Buat Titik &amp; QR Absensi
            </button>
          </Box>

          <Box
            title="Titik &amp; Jadwal Shift Aktif"
            icon={<ClipboardList size={18} />}
          >
            <div className="space-y-2.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#167052] block">
                {"Titik Absensi (" + data.sites.length + ")"}
              </span>
              {data.sites.map((x) => (
                <div key={x.id} className="row">
                  <div>
                    <b className="text-[#0b3d2e] block">{x.name}</b>
                    <small>
                      {x.latitude === null
                        ? "Verifikasi via QR & Selfie Kamera"
                        : "Radius " + x.allowed_radius_meters + " meter dari koordinat GPS"}
                    </small>
                  </div>
                  <button onClick={() => copy(x.qr_token)} className="small">
                    <Copy size={13} /> Salin Tautan QR
                  </button>
                </div>
              ))}
              {!data.sites.length && <Empty t="Belum ada titik absensi." />}
            </div>

            <div className="mt-5 border-t border-[#d8e3de] pt-4 space-y-2.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#167052] block">
                {"Jadwal Shift Terjadwal (" + data.schedules.length + ")"}
              </span>
              {data.schedules.slice(0, 8).map((x) => (
                <div className="row" key={x.id}>
                  <div>
                    <b className="text-[#0b3d2e]">
                      {x.staff_name + " · " + (x.role_label || "Shift")}
                    </b>
                    <small>
                      {time(x.starts_at) + " - " + time(x.ends_at) + " · " + (x.pos_shift_allowed ? "POS Kasir Diizinkan" : "Tanpa Akses POS")}
                    </small>
                  </div>
                  {x.status === "scheduled" && (
                    <button
                      onClick={() =>
                        run(
                          () => cancelStaffScheduleAction(x.id),
                          "Jadwal dibatalkan."
                        )
                      }
                      className="danger"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              ))}
              {!data.schedules.length && (
                <Empty t="Belum ada jadwal shift aktif." />
              )}
            </div>
          </Box>
        </section>

        {/* Section 3: Leave, Sick, & Approval */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Box title="Izin, Cuti, dan Lembur" icon={<ClipboardList size={18} />}>
            <p className="text-xs text-[#527867]">
              Catat pengajuan staf dari panel ini, atau biarkan staf mengajukan sendiri dari beranda staf.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field l="Staf">
                <select
                  value={leave.userId}
                  onChange={(e) =>
                    setLeave({ ...leave, userId: e.target.value })
                  }
                  className="field"
                >
                  {data.staff.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field l="Jenis Pengajuan">
                <select
                  value={leave.leaveType}
                  onChange={(e) =>
                    setLeave({
                      ...leave,
                      leaveType: e.target.value as typeof leave.leaveType,
                    })
                  }
                  className="field"
                >
                  <option value="leave">Cuti</option>
                  <option value="sick">Sakit</option>
                  <option value="permission">Izin</option>
                  <option value="overtime">Lembur</option>
                </select>
              </Field>
              <Field l="Waktu Mulai">
                <input
                  type="datetime-local"
                  value={leave.startsAt}
                  onChange={(e) =>
                    setLeave({ ...leave, startsAt: e.target.value })
                  }
                  className="field"
                />
              </Field>
              <Field l="Waktu Selesai">
                <input
                  type="datetime-local"
                  value={leave.endsAt}
                  onChange={(e) =>
                    setLeave({ ...leave, endsAt: e.target.value })
                  }
                  className="field"
                />
              </Field>
            </div>
            <Field l="Alasan Pengajuan">
              <textarea
                minLength={5}
                value={leave.reason}
                onChange={(e) =>
                  setLeave({ ...leave, reason: e.target.value })
                }
                placeholder="Tulis alasan singkat dan jelas..."
                className="field min-h-20"
              />
            </Field>
            <button
              onClick={() =>
                run(
                  () => createLeaveForStaffAction(leave.userId, leave),
                  "Pengajuan dicatat dan menunggu approval."
                )
              }
              disabled={
                saving ||
                !leave.userId ||
                !leave.startsAt ||
                !leave.endsAt ||
                leave.reason.length < 5
              }
              className="primary"
            >
              Catat pengajuan
            </button>
          </Box>

          <Box title="Menunggu Persetujuan Owner" icon={<Check size={18} />}>
            <div className="space-y-2.5">
              {pending.map((x) => (
                <div className="row" key={x.id}>
                  <div>
                    <b className="text-[#0b3d2e]">
                      {x.staff_name + " · " + (
                        {
                          leave: "Cuti",
                          sick: "Sakit",
                          permission: "Izin",
                          overtime: "Lembur",
                        } as Record<string, string>
                      )[x.leave_type]}
                    </b>
                    <small>
                      {time(x.starts_at) + " sampai " + time(x.ends_at)}
                      <br />
                      <span className="italic text-[#18392f]">
                        {"\"" + x.reason + "\""}
                      </span>
                    </small>
                  </div>
                  <span className="flex gap-2">
                    <button
                      onClick={() =>
                        run(
                          () => reviewLeaveRequestAction(x.id, true),
                          "Pengajuan disetujui."
                        )
                      }
                      title="Setujui"
                      className="ok"
                    >
                      <Check size={14} /> Setuju
                    </button>
                    <button
                      onClick={() =>
                        run(
                          () => reviewLeaveRequestAction(x.id, false),
                          "Pengajuan ditolak."
                        )
                      }
                      title="Tolak"
                      className="danger"
                    >
                      <X size={14} /> Tolak
                    </button>
                  </span>
                </div>
              ))}
              {!pending.length && (
                <Empty t="Tidak ada pengajuan izin/lembur yang menunggu approval." />
              )}
            </div>
          </Box>
        </section>

        {/* Section 4: Payroll Periods & Line Items */}
        <Box title="Penggajian Per Periode" icon={<ReceiptText size={18} />}>
          <p className="text-xs text-[#527867]">
            Buat periode gaji, isi komponen gaji (pokok, lembur, bonus, potongan), lalu setujui agar angka terkunci sebelum dibayarkan.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4">
            <Field l="Tanggal Mulai">
              <input
                type="date"
                value={range.startsOn}
                onChange={(e) =>
                  setRange({ ...range, startsOn: e.target.value })
                }
                className="field"
              />
            </Field>
            <Field l="Tanggal Selesai">
              <input
                type="date"
                value={range.endsOn}
                onChange={(e) =>
                  setRange({ ...range, endsOn: e.target.value })
                }
                className="field"
              />
            </Field>
            <button
              onClick={() =>
                run(
                  () => createPayrollPeriodAction(range),
                  "Periode gaji dibuat untuk semua staf aktif."
                )
              }
              disabled={saving || !range.startsOn || !range.endsOn}
              className="primary mb-0.5"
            >
              + Buat Periode Gaji
            </button>
          </div>

          {data.periods.length > 0 ? (
            <>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {data.periods.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setPeriodId(x.id)}
                    className={x.id === periodId ? "period active" : "period"}
                  >
                    <span>
                      {x.period_start + " - " + x.period_end}
                    </span>
                    <small>
                      {(x.status === "approved"
                        ? "Terkunci"
                        : x.status === "paid"
                        ? "Lunas"
                        : "Draft") + " · " + fmt(x.total_pay)}
                    </small>
                  </button>
                ))}
              </div>

              {period && (
                <div className="mt-5 rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-xs overflow-x-auto">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e3de] pb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#0b3d2e]">
                        {"Rincian Periode: " + period.period_start + " s/d " + period.period_end}
                      </h3>
                      <span className="font-mono text-xs text-[#527867]">
                        Status: <b className="uppercase text-[#0b3d2e]">{period.status}</b> · Total: {fmt(period.total_pay)}
                      </span>
                    </div>
                    <div>
                      {period.status === "draft" ? (
                        <button
                          onClick={() =>
                            run(
                              () =>
                                setPayrollPeriodStatusAction(
                                  period.id,
                                  "approved"
                                ),
                              "Periode disetujui dan dikunci."
                            )
                          }
                          className="secondary"
                        >
                          Kunci &amp; Setujui Periode
                        </button>
                      ) : period.status === "approved" ? (
                        <button
                          onClick={() =>
                            run(
                              () =>
                                setPayrollPeriodStatusAction(period.id, "paid"),
                              "Periode ditandai lunas."
                            )
                          }
                          className="primary"
                        >
                          ✓ Tandai Sudah Dibayar (Lunas)
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr>
                        <th className="px-3">Staf</th>
                        <th className="px-3">Gaji Pokok</th>
                        <th className="px-3">Lembur</th>
                        <th className="px-3">Insentif</th>
                        <th className="px-3">Komisi</th>
                        <th className="px-3">Potongan</th>
                        <th className="px-3">Net Gaji</th>
                        <th className="px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const n =
                          [
                            "base_pay",
                            "overtime_pay",
                            "incentive_pay",
                            "commission_pay",
                          ].reduce((a, k) => a + Number(val(line, k)), 0) -
                          Number(val(line, "deduction"));
                        return (
                          <tr key={line.id}>
                            <td className="px-3">
                              <b className="text-[#0b3d2e]">
                                {line.staff_name}
                              </b>
                            </td>
                            {[
                              "base_pay",
                              "overtime_pay",
                              "incentive_pay",
                              "commission_pay",
                              "deduction",
                            ].map((k) => (
                              <td key={k} className="px-2">
                                <input
                                  disabled={period.status !== "draft"}
                                  value={val(line, k)}
                                  onChange={(e) =>
                                    change(line, k, e.target.value)
                                  }
                                  className="money"
                                />
                              </td>
                            ))}
                            <td className="px-3">
                              <b className="font-mono text-emerald-800">
                                {fmt(n)}
                              </b>
                            </td>
                            <td className="px-3 text-right">
                              {period.status === "draft" && (
                                <button
                                  onClick={() =>
                                    run(
                                      () =>
                                        savePayrollLineAction({
                                          periodId: period.id,
                                          userId: line.user_id,
                                          basePay: Number(val(line, "base_pay")),
                                          overtimePay: Number(
                                            val(line, "overtime_pay")
                                          ),
                                          incentivePay: Number(
                                            val(line, "incentive_pay")
                                          ),
                                          commissionPay: Number(
                                            val(line, "commission_pay")
                                          ),
                                          deduction: Number(
                                            val(line, "deduction")
                                          ),
                                        }),
                                      "Komponen gaji disimpan."
                                    )
                                  }
                                  className="small"
                                >
                                  Simpan
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!lines.length && (
                    <Empty t="Tidak ada staf aktif saat periode gaji ini dibuat." />
                  )}
                </div>
              )}
            </>
          ) : (
            <Empty t="Belum ada periode gaji dibuat." />
          )}
        </Box>

        {/* Section 5: 30-Day Attendance Report */}
        <Box
          title="Laporan Rekap Kehadiran 30 Hari"
          icon={<CalendarClock size={18} />}
        >
          <p className="text-xs text-[#527867]">
            Gunakan ringkasan kehadiran ini saat memverifikasi jam lembur, potongan keterlambatan, atau bonus kedisiplinan staf.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#d8e3de] bg-white p-2">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className="px-4">Nama Staf</th>
                  <th className="px-4">Total Masuk</th>
                  <th className="px-4">Sudah Checkout</th>
                  <th className="px-4">Shift Berjalan</th>
                  <th className="px-4">Total Jam Kerja</th>
                </tr>
              </thead>
              <tbody>
                {data.attendanceSummary.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4">
                      <b className="text-[#0b3d2e]">{x.name}</b>
                    </td>
                    <td className="px-4 font-mono">{x.attendance_count}</td>
                    <td className="px-4 font-mono">{x.completed_count}</td>
                    <td className="px-4 font-mono">{x.open_count}</td>
                    <td className="px-4 font-mono font-bold text-[#167052]">
                      {Number(x.hours_worked).toFixed(1) + " jam"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      </main>
    </div>
  );
}

function Box({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
      <div className="mb-4 flex items-center gap-2.5 text-[#0b3d2e]">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e] border border-emerald-100">
          {icon}
        </span>
        <h2 className="font-extrabold text-base text-[#0b3d2e]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-xs font-bold text-[#18392f]">
      <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
        {l}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  text,
  checked,
  onChange,
}: {
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-3.5 text-sm font-semibold text-[#18392f] hover:bg-[#f4faf6] cursor-pointer transition-colors">
      <span>{text}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded-md border-[#d8e3de] text-[#0b3d2e] accent-[#0b3d2e] focus:ring-emerald-500 cursor-pointer"
      />
    </label>
  );
}

function Empty({ t }: { t: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#d8e3de] bg-[#f8faf9] p-4 text-center text-sm font-medium text-[#527867]">
      {t}
    </p>
  );
}

function Metric({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#167052]">
        {l}
      </p>
      <p className="mt-2 text-2xl font-black font-mono text-[#0b3d2e]">{v}</p>
    </div>
  );
}

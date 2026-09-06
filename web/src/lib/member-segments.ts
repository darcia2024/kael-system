export type MemberSegment = "new" | "active" | "at_risk" | "inactive";

export const MEMBER_SEGMENT_COPY: Record<MemberSegment, { label: string; description: string }> = {
  new: {
    label: "Baru daftar",
    description: "Sudah menjadi member, tapi belum ada belanja yang tercatat.",
  },
  active: {
    label: "Aktif",
    description: "Masih berbelanja dalam 30 hari terakhir.",
  },
  at_risk: {
    label: "Mulai jarang datang",
    description: "Sudah 31 sampai 60 hari tidak ada transaksi yang tercatat.",
  },
  inactive: {
    label: "Lama tidak belanja",
    description: "Lebih dari 60 hari tidak ada transaksi yang tercatat.",
  },
};

/** Satu aturan bersama untuk profil member, segmentasi, dan campaign berikutnya. */
export function getMemberSegment(input: { purchase_count: number; last_activity_at: string | null }): MemberSegment {
  if (!input.purchase_count || !input.last_activity_at) return "new";

  const daysSinceVisit = Math.floor((Date.now() - new Date(input.last_activity_at).getTime()) / 86_400_000);
  if (daysSinceVisit <= 30) return "active";
  if (daysSinceVisit <= 60) return "at_risk";
  return "inactive";
}

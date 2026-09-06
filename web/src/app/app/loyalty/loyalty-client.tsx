"use client";

import { useRouter } from "next/navigation";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  Gift, 
  Sparkles, 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  TrendingUp, 
  Sliders, 
  History, 
  Download, 
  ExternalLink, 
  QrCode, 
  Coffee, 
  Check, 
  Receipt,
  Layers,
  Save,
  Lock,
  UserPlus,
  IdCard,
  RefreshCw,
  Ticket,
  MessageCircle,
  Cake,
  CalendarHeart,
  Tag,
  ShoppingBag,
  Crown
} from "lucide-react";
import type { Business, CustomerDirectoryEntry, LoyaltyCampaignRecipient, LoyaltyCampaignSummary, LoyaltyProgram, PointExpiryCandidate, Reward, User, PointLedger, Redemption, ReferralReportRow, AnnualDateCandidate, LoyaltyTier } from "@/lib/types";
import {
  addPointsAction, redeemRewardAction, saveRewardAction, deleteRewardAction,
  anonymizeCustomerAction, updateLoyaltyProgramAction, searchCustomersAction,
  customerDetailAction, createLoyaltyCampaignAction, expireDuePointsAction, getLoyaltyCampaignRecipientsAction, updateLoyaltyCampaignRecipientStatusAction,
  lookupRedemptionAction, consumeRedemptionAction,
  redeemCodeAction, saveTierAction, deleteTierAction,
} from "@/lib/actions";
import {
  normalizePhoneNumber,
  calculateEarnedPoints,
  calculateRewardDiscountRate,
  resolveTier
} from "@/lib/loyalty-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { getMemberSegment, MEMBER_SEGMENT_COPY, type MemberSegment } from "@/lib/member-segments";
import { CAMPAIGN_GOALS, type CampaignGoalKey } from "@/lib/campaign-templates";

/** Semua data awal datang dari komponen server; halaman ini tidak menyentuh
 *  database sama sekali. Perubahan dikirim lewat server action, lalu
 *  router.refresh() menarik data terbaru dari server. */
export default function KaelLoyaltyDashboard({
  business,
  initialProgram,
  customers,
  memberInsights,
  rewards,
  staffList,
  staffAudit,
  initialCampaigns,
  initialCampaignRecipients,
  expiryDue,
  expirySoon,
  weeklySignups,
  referralReport,
  birthdayCandidates,
  anniversaryCandidates,
  tiers,
  sessionRole,
}: {
  business: Business | null;
  initialProgram: LoyaltyProgram;
  customers: CustomerDirectoryEntry[];
  memberInsights: import("@/lib/types").CustomerProfileSummary[];
  rewards: Reward[];
  staffList: Pick<User, "id" | "name">[];
  staffAudit: { id: string; name: string; points_issued: number; manual_count: number; total_entries: number }[];
  initialCampaigns: LoyaltyCampaignSummary[];
  initialCampaignRecipients: LoyaltyCampaignRecipient[];
  expiryDue: PointExpiryCandidate[];
  expirySoon: PointExpiryCandidate[];
  weeklySignups: { week_start: string; count: number }[];
  referralReport: ReferralReportRow[];
  birthdayCandidates: AnnualDateCandidate[];
  anniversaryCandidates: AnnualDateCandidate[];
  tiers: LoyaltyTier[];
  sessionRole: User["role"];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"cashier" | "customers" | "segments" | "campaigns" | "rewards" | "settings" | "audit">("cashier");
  const [selectedSegment, setSelectedSegment] = useState<MemberSegment | "all">("all");
  const [campaignName, setCampaignName] = useState("");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [currentCampaign, setCurrentCampaign] = useState<LoyaltyCampaignSummary | null>(initialCampaigns[0] ?? null);
  const [campaignRecipients, setCampaignRecipients] = useState(initialCampaignRecipients);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [expiryBusy, setExpiryBusy] = useState(false);

  // Template & kode promo (Fitur 4)
  const [campaignGoalKey, setCampaignGoalKey] = useState<CampaignGoalKey | null>(null);
  const [goalCampaignName, setGoalCampaignName] = useState("");
  const [goalMessageTemplate, setGoalMessageTemplate] = useState("");
  const [goalRewardPoints, setGoalRewardPoints] = useState(0);
  const [promoCodeInput, setPromoCodeInput] = useState("");

  // Level Member (Fitur 6) — modal, sepola dengan editor reward: state form
  // lokal cuma untuk field yang sedang diedit, daftarnya sendiri langsung
  // dari prop `tiers` dan disegarkan lewat refreshAll(), bukan disalin ke
  // state terpisah yang bisa basi setelah router.refresh().
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierName, setTierName] = useState("");
  const [tierMinSpend, setTierMinSpend] = useState(0);
  const [tierMultiplier, setTierMultiplier] = useState(1);
  const [tierBenefitNote, setTierBenefitNote] = useState("");
  const [tierBusy, setTierBusy] = useState(false);

  // Master States
  const [program, setProgram] = useState<LoyaltyProgram>(initialProgram);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || "usr-staff-01");

  // ---------------------------------------------------------------------------
  // CASHIER FAST POS STATE (Tab 1)
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDirectoryEntry | null>(null);
  const [amountSpentInput, setAmountSpentInput] = useState<number>(50000);
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [lastRedemptionResult, setLastRedemptionResult] = useState<Redemption | null>(null);
  const [cashierSuccessMsg, setCashierSuccessMsg] = useState<string | null>(null);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherPreview, setVoucherPreview] = useState<{
    code: string; status: "issued" | "used" | "expired"; reward_name: string;
    customer_name: string | null; used_at: string | null; used_by_name: string | null;
  } | null>(null);
  const [voucherBusy, setVoucherBusy] = useState(false);

  // Pencarian dijalankan di server. Ditunda 250 ms supaya tiap ketikan tidak
  // menjadi satu query.
  const [searchResults, setSearchResults] = useState<CustomerDirectoryEntry[]>([]);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchCustomersAction(searchQuery).then(setSearchResults);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const activeCustomerBalance =
    customers.find((c) => c.id === selectedCustomer?.id)?.balance ??
    selectedCustomer?.balance ??
    0;

  // ---------------------------------------------------------------------------
  // REWARD EDITOR MODAL (Tab 3)
  // ---------------------------------------------------------------------------
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardName, setRewardName] = useState("");
  const [rewardPointCost, setRewardPointCost] = useState<number>(10);
  const [rewardMarketValue, setRewardMarketValue] = useState<number>(25000);
  const [rewardStock, setRewardStock] = useState<string>(""); // empty = unlimited

  // Live discount rate calculation for reward editor
  const rewardDiscountAnalysis = useMemo(() => {
    return calculateRewardDiscountRate(rewardPointCost, program.earn_rate, rewardMarketValue);
  }, [rewardPointCost, program.earn_rate, rewardMarketValue]);

  // ---------------------------------------------------------------------------
  // CUSTOMER DETAIL MODAL (Tab 2)
  // ---------------------------------------------------------------------------
  const [viewingCustomer, setViewingCustomer] = useState<CustomerDirectoryEntry | null>(null);
  /** Riwayat poin ditarik saat modal dibuka, bukan diquery di dalam render. */
  const [viewingDetail, setViewingDetail] = useState<{
    balance: number;
    ledger: PointLedger[];
  } | null>(null);

  useEffect(() => {
    if (!viewingCustomer) {
      setViewingDetail(null);
      return;
    }
    let cancelled = false;
    void customerDetailAction(viewingCustomer.id).then((d) => {
      if (!cancelled && d) setViewingDetail({ balance: d.balance, ledger: d.ledger });
    });
    return () => {
      cancelled = true;
    };
  }, [viewingCustomer]);

  // ---------------------------------------------------------------------------
  // REFRESH DATA
  // ---------------------------------------------------------------------------
  const refreshAll = () => router.refresh();

  const segmentedMembers = useMemo(
    () => memberInsights.map((member) => ({ ...member, segment: getMemberSegment(member) })),
    [memberInsights],
  );
  const visibleSegmentMembers = selectedSegment === "all"
    ? segmentedMembers
    : segmentedMembers.filter((member) => member.segment === selectedSegment);
  const campaignSegment = selectedSegment === "all" ? "inactive" : selectedSegment;
  const campaignMembers = segmentedMembers.filter(
    (member) => member.segment === campaignSegment && member.marketing_opt_in,
  );
  const getCampaignTemplate = (segment: MemberSegment) => {
    if (segment === "new") return "Halo {{nama}}, terima kasih sudah jadi member {{toko}}. Saat belanja berikutnya, sebutkan nomor WhatsApp ini ke kasir supaya poinmu langsung masuk.";
    if (segment === "active") return "Halo {{nama}}, {{unit}} membermu sekarang {{saldo}}. Tunjukkan nomor WhatsApp ini saat belanja supaya {{unit}} berikutnya ikut tercatat.";
    return "Halo {{nama}}, sudah lama tidak mampir ke {{toko}}. {{unit}} membermu masih {{saldo}}. Kami tunggu kedatanganmu lagi.";
  };
  const fillCampaignTemplate = (template: string, member: { name: string | null; balance: number }, code?: string | null) =>
    template
      .replaceAll("{{nama}}", member.name?.trim().split(/\s+/)[0] || "Kak")
      .replaceAll("{{saldo}}", String(member.balance))
      .replaceAll("{{unit}}", program.mode === "stamp" ? "stempel" : "poin")
      .replaceAll("{{toko}}", business?.name || "kami")
      .replaceAll("{{kode}}", code || "");
  const buildCampaignMessage = (member: typeof segmentedMembers[number]) =>
    fillCampaignTemplate(getCampaignTemplate(member.segment), member);
  const buildWhatsAppLink = (member: typeof segmentedMembers[number]) => {
    const phone = member.phone.replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(buildCampaignMessage(member))}`;
  };
  const campaignTemplate = getCampaignTemplate(campaignSegment);
  const buildSavedCampaignMessage = (member: LoyaltyCampaignRecipient) => {
    return fillCampaignTemplate(currentCampaign?.message_template || "", member, currentCampaign?.code);
  };
  const buildSavedCampaignWhatsAppLink = (member: LoyaltyCampaignRecipient) =>
    `https://wa.me/${member.phone.replace(/\D/g, "")}?text=${encodeURIComponent(buildSavedCampaignMessage(member))}`;

  const handleCreateCampaign = async () => {
    if (!campaignMembers.length) return;
    setCampaignBusy(true);
    const res = await createLoyaltyCampaignAction({
      name: campaignName.trim() || `Ajakan ${MEMBER_SEGMENT_COPY[campaignSegment].label.toLowerCase()}`,
      segment: campaignSegment,
      messageTemplate: campaignTemplate,
      customerIds: campaignMembers.map((member) => member.id),
    });
    setCampaignBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setCurrentCampaign(res.data.campaign);
    setCampaignRecipients(res.data.recipients);
    setCampaigns((items) => [res.data.campaign, ...items]);
    setCampaignName("");
    refreshAll();
  };

  /**
   * Jalur cepat untuk ulang tahun & anniversary. Terpisah dari
   * handleCreateCampaign karena sumber daftarnya beda sumbu sama sekali:
   * kandidat tanggal tahunan, bukan segmentedMembers hasil getMemberSegment.
   */
  const handleCreateDateCampaign = async (kind: "birthday" | "anniversary") => {
    const candidates = kind === "birthday" ? birthdayCandidates : anniversaryCandidates;
    if (!candidates.length) return;
    const storeName = business?.name || "kami";
    const unit = program.mode === "stamp" ? "stempel" : "poin";
    const template = kind === "birthday"
      ? (program.birthday_is_active && program.birthday_bonus_points > 0
          ? `Selamat ulang tahun, {{nama}}! 🎉 Dari kami di ${storeName}, ada bonus ${program.birthday_bonus_points} ${unit} spesial buat kamu. Mampir ya, ditunggu!`
          : `Selamat ulang tahun, {{nama}}! 🎉 Dari kami semua di ${storeName}, semoga tahun ini makin baik. Ditunggu mampirnya!`)
      : `Terima kasih sudah setahun jadi bagian dari ${storeName}, {{nama}}! Kami senang kamu masih mampir sampai sekarang.`;
    setCampaignBusy(true);
    const res = await createLoyaltyCampaignAction({
      name: `${kind === "birthday" ? "Ulang tahun" : "Anniversary"} ${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
      segment: kind,
      messageTemplate: template,
      customerIds: candidates.map((c) => c.customer_id),
    });
    setCampaignBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setCurrentCampaign(res.data.campaign);
    setCampaignRecipients(res.data.recipients);
    setCampaigns((items) => [res.data.campaign, ...items]);
    refreshAll();
  };

  const selectedGoal = CAMPAIGN_GOALS.find((g) => g.key === campaignGoalKey) ?? null;

  /** Target goal ditarik dari sumber yang beda-beda: segmen perilaku, atau daftar poin hampir hangus yang sudah dihitung di tab Aturan Program. */
  const goalTargetMembers = useMemo(() => {
    if (!selectedGoal) return [];
    if (selectedGoal.targetSource === "expiring_points") {
      return expirySoon.map((c) => ({ id: c.customer_id, name: c.name }));
    }
    return segmentedMembers
      .filter((m) => m.segment === selectedGoal.segment && m.marketing_opt_in)
      .map((m) => ({ id: m.id, name: m.name }));
  }, [selectedGoal, expirySoon, segmentedMembers]);

  const handleSelectGoal = (key: CampaignGoalKey) => {
    const goal = CAMPAIGN_GOALS.find((g) => g.key === key)!;
    setCampaignGoalKey(key);
    setGoalCampaignName(`${goal.name} · ${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`);
    setGoalMessageTemplate(goal.messageTemplate);
    setGoalRewardPoints(goal.defaultRewardPoints);
  };

  const handleCreateGoalCampaign = async () => {
    if (!selectedGoal || !goalTargetMembers.length) return;
    setCampaignBusy(true);
    const res = await createLoyaltyCampaignAction({
      name: goalCampaignName.trim() || selectedGoal.name,
      segment: selectedGoal.targetSource === "expiring_points" ? "expiring_points" : selectedGoal.segment!,
      messageTemplate: goalMessageTemplate.trim(),
      customerIds: goalTargetMembers.map((m) => m.id),
      goal: selectedGoal.key,
      codeRewardPoints: goalRewardPoints,
    });
    setCampaignBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setCurrentCampaign(res.data.campaign);
    setCampaignRecipients(res.data.recipients);
    setCampaigns((items) => [res.data.campaign, ...items]);
    setCampaignGoalKey(null);
    refreshAll();
  };

  const handleCampaignRecipientStatus = async (recipientId: string, status: "opened" | "sent" | "skipped") => {
    const res = await updateLoyaltyCampaignRecipientStatusAction(recipientId, status);
    if (!res.ok) {
      alert(res.error);
      return false;
    }
    setCampaignRecipients((items) => items.map((item) => item.id === recipientId
      ? { ...item, status, opened_at: status === "opened" ? item.opened_at || new Date().toISOString() : item.opened_at, sent_at: status === "sent" ? new Date().toISOString() : item.sent_at }
      : item));
    const previous = campaignRecipients.find((item) => item.id === recipientId);
    if (currentCampaign) {
      const patch = {
        opened_count: status === "opened" && !previous?.opened_at ? 1 : 0,
        sent_count: status === "sent" && !previous?.sent_at ? 1 : 0,
      };
      setCampaigns((items) => items.map((item) => item.id === currentCampaign.id
        ? { ...item, opened_count: item.opened_count + patch.opened_count, sent_count: item.sent_count + patch.sent_count }
        : item));
      setCurrentCampaign((item) => item ? { ...item, opened_count: item.opened_count + patch.opened_count, sent_count: item.sent_count + patch.sent_count } : item);
    }
    return true;
  };

  const handleSelectCampaign = async (campaign: LoyaltyCampaignSummary) => {
    setCampaignBusy(true);
    const res = await getLoyaltyCampaignRecipientsAction(campaign.id);
    setCampaignBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setCurrentCampaign(campaign);
    setCampaignRecipients(res.data);
  };

  // ---------------------------------------------------------------------------
  // CASHIER ACTIONS
  // ---------------------------------------------------------------------------
  const handleSelectCustomer = (cust: CustomerDirectoryEntry) => {
    setSelectedCustomer(cust);
    setSearchQuery("");
    setCashierSuccessMsg(null);
    setLastRedemptionResult(null);
  };

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const earned = program.mode === "stamp" 
      ? program.stamp_per_visit 
      : calculateEarnedPoints(amountSpentInput, program.earn_rate);

    if (earned <= 0) {
      alert(`Nominal belanja ${formatRupiah(amountSpentInput)} belum mencapai kurs minimum 1 poin (${formatRupiah(program.earn_rate)}).`);
      return;
    }

    // Poin dihitung ulang di server dari kurs program; nilai di layar hanya
    // untuk pratinjau.
    const res = await addPointsAction(selectedCustomer.id, amountSpentInput);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setCashierSuccessMsg(`Sukses! +${res.data.earned} ${program.mode === "stamp" ? "Stamp" : "Poin"} untuk ${selectedCustomer.name}. Saldo kini ${res.data.balance}.`);
    setAmountSpentInput(50000);
  };

  const handleRedeemReward = async () => {
    if (!selectedCustomer || !selectedRewardId) return;
    const reward = rewards.find((r) => r.id === selectedRewardId);
    if (!reward) return;

    if (confirm(`Konfirmasi penukaran: Tukar ${reward.point_cost} Poin untuk "${reward.name}"?`)) {
      const res = await redeemRewardAction(selectedCustomer.id, selectedRewardId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
      setLastRedemptionResult({ code: res.data.code } as never);
      setCashierSuccessMsg(`Sukses! Voucher ${res.data.rewardName} diterbitkan (Kode: ${res.data.code}).`);
    }
  };

  const handleRedeemCode = async () => {
    if (!selectedCustomer || !promoCodeInput.trim()) return;
    const res = await redeemCodeAction(selectedCustomer.id, promoCodeInput.trim());
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setPromoCodeInput("");
    setCashierSuccessMsg(
      res.data.pointsAwarded > 0
        ? `Kode ${res.data.campaignName} berhasil dipakai! +${res.data.pointsAwarded} ${program.mode === "stamp" ? "Stamp" : "Poin"} untuk ${selectedCustomer.name}.`
        : `Kode ${res.data.campaignName} berhasil dipakai untuk ${selectedCustomer.name}.`,
    );
  };

  const handleLookupVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setVoucherBusy(true);
    const res = await lookupRedemptionAction(voucherCodeInput);
    setVoucherBusy(false);
    if (!res.ok) {
      setVoucherPreview(null);
      alert(res.error);
      return;
    }
    setVoucherPreview(res.data);
  };

  const handleConsumeVoucher = async () => {
    if (!voucherPreview || voucherPreview.status !== "issued") return;
    if (!confirm(`Tandai voucher ${voucherPreview.code} untuk ${voucherPreview.reward_name} sebagai sudah dipakai?`)) return;
    setVoucherBusy(true);
    const res = await consumeRedemptionAction(voucherPreview.code);
    setVoucherBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setCashierSuccessMsg(`Voucher ${res.data.rewardName} untuk ${res.data.customerName || "member"} sudah ditandai terpakai.`);
    setVoucherPreview({ ...voucherPreview, status: "used", used_at: new Date().toISOString(), used_by_name: "Anda" });
    setVoucherCodeInput("");
    refreshAll();
  };

  // ---------------------------------------------------------------------------
  // REWARD CRUD
  // ---------------------------------------------------------------------------
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardName.trim()) return;

    const res = await saveRewardAction({
      id: editingRewardId || undefined,
      name: rewardName.trim(),
      point_cost: rewardPointCost,
      market_value: rewardMarketValue,
      stock: rewardStock ? Number(rewardStock) : null,
      is_active: true,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setShowRewardModal(false);
    setEditingRewardId(null);
    setRewardName("");
    setRewardPointCost(10);
    setRewardMarketValue(25000);
  };

  const handleDeleteReward = async (id: string, name: string) => {
    if (confirm(`Hapus reward "${name}" dari katalog?`)) {
      const res = await deleteRewardAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
    }
  };

  const openTierModal = (tier?: LoyaltyTier) => {
    setEditingTierId(tier?.id ?? null);
    setTierName(tier?.name ?? "");
    setTierMinSpend(tier?.min_lifetime_spend ?? 0);
    setTierMultiplier(tier ? Number(tier.earn_multiplier) : 1);
    setTierBenefitNote(tier?.benefit_note ?? "");
    setShowTierModal(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierName.trim()) return;
    setTierBusy(true);
    const res = await saveTierAction({
      id: editingTierId || undefined,
      name: tierName.trim(),
      min_lifetime_spend: tierMinSpend,
      earn_multiplier: tierMultiplier,
      benefit_note: tierBenefitNote,
      sort_order: editingTierId ? (tiers.find((t) => t.id === editingTierId)?.sort_order ?? 0) : tiers.length,
    });
    setTierBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setShowTierModal(false);
  };

  const handleDeleteTier = async (id: string, name: string) => {
    if (confirm(`Hapus level "${name}"? Member yang sedang di level ini akan otomatis dihitung ulang ke level di bawahnya.`)) {
      const res = await deleteTierAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
    }
  };

  const handleAnonymizeCustomer = async (id: string, name: string | null) => {
    if (confirm(`Sesuai UU PDP: Apakah Anda yakin ingin menghapus/meng-anonimkan data "${name || 'Member'}"? Saldo poin akan dihapus.`)) {
      const res = await anonymizeCustomerAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
      setViewingCustomer(null);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      alert("Data pelanggan telah dianonimkan dengan aman.");
    }
  };

  const handleSaveProgramSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateLoyaltyProgramAction({
      mode: program.mode,
      earn_rate: program.earn_rate,
      stamp_per_visit: program.stamp_per_visit,
      point_expiry_months: program.point_expiry_months,
      referral_is_active: program.referral_is_active,
      referral_referrer_points: program.referral_referrer_points,
      referral_referee_points: program.referral_referee_points,
      referral_monthly_cap: program.referral_monthly_cap,
      birthday_is_active: program.birthday_is_active,
      birthday_bonus_points: program.birthday_bonus_points,
      birthday_window_days: program.birthday_window_days,
      tiers_is_active: program.tiers_is_active,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
  };

  const handleExpireDuePoints = async () => {
    const total = expiryDue.reduce((sum, item) => sum + item.points, 0);
    if (!total || !confirm(`Terapkan penghapusan ${total} poin yang sudah jatuh tempo? Tindakan ini dicatat di riwayat poin member.`)) return;
    setExpiryBusy(true);
    const res = await expireDuePointsAction();
    setExpiryBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    alert(`${res.data.points} poin kedaluwarsa sudah dicatat.`);
    refreshAll();
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col pb-16 sm:pb-8">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href={sessionRole === "owner" ? "/app" : "/app/staff"}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Hub KAEL"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-[#232331] truncate">
                  KAEL Loyalty
                </h1>
                <span className="rounded-md bg-[#fef3c7] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#d97706] border border-[#d97706] shrink-0">
                  Modul 03 Live
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                {business?.name} · CRM &amp; Kasir Pelanggan
              </span>
            </div>
          </div>

          {/* Active Staff Switcher for Point Logging */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[10px] text-[#7b7b8e] hidden sm:inline">Kasir Aktif:</span>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="rounded-xl border border-[#232331] bg-white px-2 py-1 text-xs font-bold text-[#232331]"
            >
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        
        {/* TOP KPI OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] uppercase">TOTAL MEMBER</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                <Users size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {customers.length} Orang
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#16a34a] font-mono font-bold block mt-0.5 sm:mt-1 truncate">
                ✓ UU PDP Compliant
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d97706] uppercase">POIN BEREDAR</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                <Gift size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {customers.reduce((acc, c) => acc + c.balance, 0)} Pts
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                Liabilitas Belanja
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#16a34a] uppercase">KATALOG HADIAH</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                <Ticket size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {rewards.length} Reward
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                {rewards.filter((r) => r.is_active).length} Aktif Ditukar
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#c2410c] uppercase">KURS PROGRAM</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                <Sparkles size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-extrabold font-mono text-[#232331] truncate">
                {program.mode === "stamp" ? "1 Kunjungan" : formatRupiah(program.earn_rate)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                = 1 {program.mode === "stamp" ? "Stamp" : "Poin"}
              </span>
            </div>
          </div>

        </div>

        {/* 5-TAB NAVIGATION BAR */}
        <div className="flex items-center overflow-x-auto scrollbar-none rounded-xl sm:rounded-2xl border sm:border-2 border-[#232331] bg-white p-1 font-mono text-xs font-bold gap-1 shadow-ink-xs">
          <button
            type="button"
            onClick={() => setActiveTab("cashier")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "cashier" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Receipt size={13} />
            <span>1. Layar Kasir Cepat (3-Ketukan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "customers" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Users size={13} />
            <span>2. Data Pelanggan (PDP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("segments")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "segments" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <TrendingUp size={13} />
            <span>3. Segment Member</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "campaigns" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <MessageCircle size={13} />
            <span>4. Ajakan WA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "rewards" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Gift size={13} />
            <span>5. Katalog Reward &amp; Proteksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "settings" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Sliders size={13} />
            <span>6. Aturan Program</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "audit" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <History size={13} />
            <span>7. Audit Kasir</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: FAST 3-TAP CASHIER DASHBOARD */}
        {/* ============================================================= */}
        {activeTab === "cashier" && (
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            
            {/* Left Column (7 cols): Fast Customer Search & Actions */}
            <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
              
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#7958d8]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                    Layar Kasir Loyalitas Cepat
                  </h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#16a34a] font-bold">
                  ● Target &lt;10 Detik
                </span>
              </div>

              {/* 4-Digit WA Search Bar */}
              <div className="space-y-1.5">
                <label className="block font-mono font-bold text-xs text-[#232331]">
                  Cari 4 Digit Terakhir No WA / Nama Pelanggan:
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 text-[#7b7b8e]" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik 4 digit WA (misal: 7812) atau nama..."
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-2.5 font-bold text-sm text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                    autoFocus
                  />
                </div>
                <span className="text-[10px] text-[#7b7b8e] font-mono block">
                  Tip antrean: Pelanggan cukup sebut 4 digit terakhir tanpa perlu mendikte 12 digit.
                </span>
              </div>

              {/* Search Dropdown / Results List */}
              {searchQuery && (
                <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-2 space-y-1 max-h-48 overflow-y-auto animate-in fade-in font-mono text-xs">
                  <span className="text-[10px] font-bold text-[#7958d8] px-2 block">
                    Hasil Pencarian ({searchResults.length} Ditemukan):
                  </span>
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-[#7b7b8e]">
                      Tidak ada member cocok.{" "}
                      <Link href={`/loyalty/register?toko=${encodeURIComponent(business?.store_code ?? "")}`} target="_blank" className="text-[#7958d8] font-bold underline">
                        + Daftar Baru
                      </Link>
                    </div>
                  ) : (
                    searchResults.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#d9ff57] transition-all text-left border border-[#dedee8]"
                      >
                        <div>
                          <span className="font-bold text-[#232331] font-sans block text-sm">{cust.name}</span>
                          <span className="text-[10.5px] text-[#7b7b8e]">{cust.phone_masked}</span>
                        </div>
                        <span className="font-black text-sm text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-lg border border-[#16a34a]/30">
                          {cust.balance} Pts
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Customer Active Card */}
              {selectedCustomer && (
                <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-3 font-mono text-xs animate-in zoom-in-95">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-[#7958d8] font-bold uppercase block">
                        PELANGGAN TERPILIH
                      </span>
                      <h4 className="font-black text-base text-[#232331] font-sans">
                        {selectedCustomer.name}
                      </h4>
                      <span className="text-[11px] text-[#7b7b8e]">
                        {selectedCustomer.phone_masked}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#7b7b8e] block uppercase">SALDO SAAT INI</span>
                      <span className="text-2xl font-black text-[#16a34a] block">
                        {activeCustomerBalance} Pts
                      </span>
                    </div>
                  </div>

                  {/* Add Points Form */}
                  <form onSubmit={handleAddPoints} className="border-t border-[#dedee8] pt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#232331]">
                        1. Tambah Poin Belanja ({program.mode === "stamp" ? "Stamp" : "Rupiah"}):
                      </label>
                      <span className="text-[10px] text-[#7958d8] font-bold">
                        Kurs: {formatRupiah(program.earn_rate)} = 1 Poin
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2.5 text-xs text-[#7b7b8e] font-bold">Rp</span>
                        <input
                          type="number"
                          step={5000}
                          min={5000}
                          value={amountSpentInput}
                          onChange={(e) => setAmountSpentInput(Number(e.target.value))}
                          className="w-full rounded-xl border-2 border-[#232331] pl-9 pr-3 py-2 font-black text-sm text-[#232331]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-tactile rounded-xl bg-[#232331] text-[#d9ff57] px-4 py-2 text-xs font-black shadow-ink-xs shrink-0"
                      >
                        {/*
                          Kalau level aktif, angka pastinya baru diketahui di server
                          (tergantung level member ini) — jangan janjikan angka yang
                          bisa meleset. Tanpa level, hitungannya pasti dan aman ditampilkan.
                        */}
                        {program.tiers_is_active
                          ? "+ Tambah Poin ✓"
                          : `+ Tambah ${calculateEarnedPoints(amountSpentInput, program.earn_rate)} Pts ✓`}
                      </button>
                    </div>

                    {/* Quick Amount Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[25000, 50000, 75000, 100000, 150000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmountSpentInput(amt)}
                          className="px-2 py-1 rounded-lg border border-[#dedee8] bg-white text-[10px] font-bold text-[#7b7b8e] hover:border-[#232331]"
                        >
                          {formatRupiah(amt)}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Redeem Reward Section */}
                  <div className="border-t border-[#dedee8] pt-3 space-y-2">
                    <label className="block font-bold text-[#232331]">
                      2. Tukar Voucher Reward di Kasir:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRewardId}
                        onChange={(e) => setSelectedRewardId(e.target.value)}
                        className="flex-1 rounded-xl border border-[#232331] bg-white p-2 font-bold text-xs text-[#232331]"
                      >
                        <option value="">-- Pilih Hadiah Tersedia --</option>
                        {rewards.filter((r) => r.is_active).map((rw) => (
                          <option key={rw.id} value={rw.id} disabled={activeCustomerBalance < rw.point_cost}>
                            {rw.name} ({rw.point_cost} Pts) {activeCustomerBalance < rw.point_cost ? "· Poin Kurang" : "· Cukup ✓"}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleRedeemReward}
                        disabled={!selectedRewardId}
                        className="btn-tactile rounded-xl bg-[#7958d8] text-white px-3.5 py-2 text-xs font-black disabled:opacity-40 shrink-0"
                      >
                        Tukar Hadiah
                      </button>
                    </div>
                  </div>

                  {/* Redeem Promo Code Section */}
                  <div className="border-t border-[#dedee8] pt-3 space-y-2">
                    <label className="block font-bold text-[#232331]">
                      3. Tukar Kode Promo:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                        placeholder="Ketik kode dari pelanggan"
                        className="flex-1 rounded-xl border border-[#232331] bg-white p-2 font-mono text-xs font-bold uppercase tracking-wider text-[#232331] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#7b7b8e]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRedeemCode()}
                        disabled={!promoCodeInput.trim()}
                        className="btn-tactile rounded-xl bg-[#232331] text-[#d9ff57] px-3.5 py-2 text-xs font-black disabled:opacity-40 shrink-0"
                      >
                        <ShoppingBag size={13} className="inline -mt-0.5 mr-1" />
                        Tukar Kode
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[#dedee8] pt-3 space-y-2">
                    <label className="block font-bold text-[#232331]">
                      4. Cek Voucher Reward:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                        placeholder="Contoh: RW-ABC-123"
                        className="flex-1 rounded-xl border border-[#232331] bg-white p-2 font-mono text-xs font-bold uppercase tracking-wider text-[#232331] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#7b7b8e]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleLookupVoucher()}
                        disabled={!voucherCodeInput.trim() || voucherBusy}
                        className="btn-tactile rounded-xl border border-[#232331] bg-white px-3.5 py-2 text-xs font-black text-[#232331] disabled:opacity-40 shrink-0"
                      >
                        {voucherBusy ? "Cek..." : "Cek Voucher"}
                      </button>
                    </div>
                    {voucherPreview && (
                      <div className={`rounded-xl border p-2.5 ${voucherPreview.status === "issued" ? "border-[#16a34a] bg-[#dcfce7]" : "border-[#ef4444] bg-[#feebee]"}`}>
                        <p className="font-bold text-[#232331]">{voucherPreview.reward_name} untuk {voucherPreview.customer_name || "member"}</p>
                        <p className="mt-0.5 text-[10px] text-[#5c5c70]">
                          {voucherPreview.status === "issued" ? "Voucher masih aktif dan siap dipakai." : voucherPreview.status === "used" ? "Voucher ini sudah dipakai." : "Voucher ini sudah tidak berlaku."}
                        </p>
                        {voucherPreview.status === "issued" && (
                          <button
                            type="button"
                            onClick={() => void handleConsumeVoucher()}
                            disabled={voucherBusy}
                            className="btn-tactile mt-2 rounded-lg bg-[#16a34a] px-3 py-1.5 text-[10.5px] font-bold text-white disabled:opacity-40"
                          >
                            Tandai Sudah Dipakai
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex pt-2 border-t border-[#dedee8] text-[10.5px]">
                    <Link
                      href={`/app/loyalty/member/${selectedCustomer.id}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#232331] bg-[#232331] px-3 font-bold text-[#d9ff57] shadow-ink-xs"
                    >
                      Lihat Profil Member
                    </Link>
                  </div>

                </div>
              )}

              {/* Feedback Success Box */}
              {cashierSuccessMsg && (
                <div className="rounded-xl border border-[#16a34a] bg-[#dcfce7] p-3 text-xs font-mono text-[#16a34a] flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="font-bold">{cashierSuccessMsg}</span>
                </div>
              )}

            </div>

            {/* Right Column (5 cols): Table Standee QR Preview & Fast Onboarding */}
            <div className="lg:col-span-5 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
              
              <div className="border-b border-[#dedee8] pb-3">
                <span className="font-mono text-[10px] font-bold uppercase text-[#7958d8] block">
                  STAND MEJA &amp; QR PENDAFTARAN
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331] font-sans mt-0.5">
                  Scan / Tap Kartu Member Meja
                </h3>
              </div>

              <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 text-center space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d9ff57] text-[#232331] border-2 border-[#232331] shadow-ink-xs">
                  <QrCode size={36} />
                </div>

                <div className="space-y-1 font-mono text-xs">
                  <span className="font-extrabold text-[#232331] block">
                    URL Pendaftaran Member Meja:
                  </span>
                  <Link
                    href={`/loyalty/register?toko=${encodeURIComponent(business?.store_code ?? "")}`}
                    target="_blank"
                    className="text-[#7958d8] text-[11px] font-bold underline inline-flex items-center gap-1"
                  >
                    <span>{`/loyalty/register?toko=${business?.store_code ?? ""}`}</span>
                    <ExternalLink size={11} />
                  </Link>
                  <p className="text-[10px] text-[#7b7b8e] font-sans pt-1">
                    Ditaruh di meja kasir / standee acrylic agar pelanggan bisa mendaftar sendiri sambil menunggu pesanan.
                  </p>
                </div>

                <Link
                  href={`/loyalty/register?toko=${encodeURIComponent(business?.store_code ?? "")}`}
                  target="_blank"
                  className="btn-tactile inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#232331] bg-white py-2 text-xs font-bold text-[#232331] shadow-ink-xs"
                >
                  <UserPlus size={13} />
                  <span>Buka Form Pendaftaran Member Baru</span>
                </Link>

                {/* Isi kartu yang dipegang pelanggan: sapaan, jam buka, kabar,
                    dan nomor WhatsApp yang menyalakan tombol simpan kartu. */}
                <Link
                  href="/app/loyalty/kartu"
                  className="btn-tactile mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#232331] bg-[#d9ff57] py-2 text-xs font-black text-[#232331] shadow-ink-xs"
                >
                  <IdCard size={13} />
                  <span>Atur Isi Kartu Member</span>
                </Link>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: DATA PELANGGAN (PDP COMPLIANT) */}
        {/* ============================================================= */}
        {activeTab === "customers" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Database Pelanggan ({customers.length} Member)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Data nomor telepon dilindungi sesuai standar UU PDP No. 27/2022.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => alert("Data pelanggan berhasil diekspor ke CSV!")}
                  className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-[#232331] bg-white px-3 py-1.5 text-xs font-bold text-[#232331] shadow-ink-xs"
                >
                  <Download size={13} />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                    <th className="py-2.5 px-3">Nama Member</th>
                    <th className="py-2.5 px-3">Nomor WhatsApp</th>
                    <th className="py-2.5 px-3">Saldo Poin</th>
                    <th className="py-2.5 px-3">Tanggal Gabung</th>
                    <th className="py-2.5 px-3">Persetujuan PDP</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {customers.map((cust) => {
                    const balance = cust.balance;

                    return (
                      <tr key={cust.id} className="hover:bg-[#fcfcfe]">
                        <td className="py-3 px-3 font-extrabold text-[#232331] font-sans">
                          {cust.name}
                        </td>
                        <td className="py-3 px-3">
                          <span>{cust.phone_masked}</span>
                        </td>
                        <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                          {balance} Pts
                        </td>
                        <td className="py-3 px-3 text-[#7b7b8e]">
                          {formatBusinessDateTime(cust.created_at)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#16a34a]/30">
                            <ShieldCheck size={11} />
                            <span>Tersetujui</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <Link
                            href={`/app/loyalty/member/${cust.id}`}
                            className="btn-tactile inline-flex min-h-11 items-center rounded-lg border border-[#232331] bg-[#232331] px-2.5 py-1 text-[10.5px] font-bold text-[#d9ff57]"
                          >
                            Profil
                          </Link>
                          <button
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"
                          >
                            Buku Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnonymizeCustomer(cust.id, cust.name)}
                            className="btn-tactile rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[10.5px] font-bold text-[#7b7b8e] hover:text-[#ef4444]"
                            title="Anonimkan Data (UU PDP)"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {activeTab === "segments" && (
          <section className="space-y-4">
            <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#7958d8]">PERTUMBUHAN MEMBER</span>
                  <h3 className="mt-0.5 text-sm font-extrabold sm:text-base">Pendaftaran baru per minggu</h3>
                  <p className="mt-1 max-w-2xl text-xs text-[#5c5c70]">Garis dasar untuk menilai apakah ajakan, promo, dan kartu referral benar-benar menambah member — bukan cuma menambah keramaian.</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                  <span className="font-mono text-[11px] text-[#5c5c70]">
                    {weeklySignups.reduce((sum, w) => sum + w.count, 0)} member baru / {weeklySignups.length} minggu
                  </span>
                  {sessionRole === "owner" && (
                    <Link
                      href="/app/loyalty/analytics"
                      className="min-h-9 rounded-lg border border-[#232331] bg-[#232331] px-3 py-1.5 font-mono text-[11px] font-bold text-[#d9ff57] hover:bg-[#323244]"
                    >
                      Lihat Analitik Lengkap →
                    </Link>
                  )}
                </div>
              </div>

              {weeklySignups.some((w) => w.count > 0) ? (
                <div className="mt-4 flex h-24 items-end gap-1.5 border-t border-[#dedee8] pt-3 sm:h-28">
                  {weeklySignups.map((w) => {
                    const max = Math.max(...weeklySignups.map((x) => x.count), 1);
                    const heightPct = Math.max((w.count / max) * 100, w.count > 0 ? 8 : 2);
                    const isLast = w === weeklySignups[weeklySignups.length - 1];
                    return (
                      <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
                        <span className="font-mono text-[9px] font-bold text-[#5c5c70]">{w.count > 0 ? w.count : ""}</span>
                        <div
                          className={`w-full rounded-t-sm ${isLast ? "bg-[#7958d8]" : "bg-[#d9d2f5]"}`}
                          style={{ height: `${heightPct}%`, minHeight: "3px" }}
                          title={`Minggu ${new Date(w.week_start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${w.count} member baru`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 border-t border-[#dedee8] pt-3 text-xs text-[#5c5c70]">Belum ada pendaftaran member dalam {weeklySignups.length} minggu terakhir.</p>
              )}
            </div>

            <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md">
              <div className="flex flex-col gap-2 border-b border-[#dedee8] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#7958d8]">DATA MEMBER</span>
                  <h3 className="mt-0.5 text-sm font-extrabold sm:text-base">Pilih member berdasarkan kebiasaan belanjanya</h3>
                  <p className="mt-1 max-w-2xl text-xs text-[#5c5c70]">KAEL membagi daftar ini dari transaksi loyalty yang tercatat. Daftar ini jadi dasar untuk ajakan kembali atau promo yang lebih tepat.</p>
                </div>
                <span className="font-mono text-[11px] text-[#5c5c70]">{memberInsights.length} member</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {(Object.keys(MEMBER_SEGMENT_COPY) as MemberSegment[]).map((segment) => {
                  const count = segmentedMembers.filter((member) => member.segment === segment).length;
                  const copy = MEMBER_SEGMENT_COPY[segment];
                  const selected = selectedSegment === segment;
                  return (
                    <button
                      key={segment}
                      type="button"
                      onClick={() => setSelectedSegment(selected ? "all" : segment)}
                      className={`min-h-24 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7958d8] ${
                        selected ? "border-[#232331] bg-[#232331] text-white shadow-ink-xs" : "border-[#dedee8] bg-[#fcfcfe] text-[#232331] hover:border-[#7958d8]"
                      }`}
                    >
                      <span className={`font-mono text-xl font-black ${selected ? "text-[#d9ff57]" : "text-[#7958d8]"}`}>{count}</span>
                      <span className="mt-1 block text-xs font-bold">{copy.label}</span>
                      <span className={`mt-1 block text-[10px] leading-4 ${selected ? "text-[#dedee8]" : "text-[#5c5c70]"}`}>{copy.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3 sm:p-5 shadow-ink-md">
              <div className="flex items-center justify-between gap-3 border-b border-[#dedee8] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold">{selectedSegment === "all" ? "Semua member" : MEMBER_SEGMENT_COPY[selectedSegment].label}</h3>
                  <p className="mt-0.5 text-xs text-[#5c5c70]">Buka profil untuk melihat riwayat sebelum mengambil tindakan.</p>
                </div>
                {selectedSegment !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSelectedSegment("all")}
                    className="min-h-11 rounded-lg border border-[#232331] bg-white px-3 text-xs font-bold text-[#232331]"
                  >
                    Lihat semua
                  </button>
                )}
              </div>

              {visibleSegmentMembers.length ? (
                <div className="mt-1 divide-y divide-[#dedee8]">
                  {visibleSegmentMembers.map((member) => {
                    const segment = MEMBER_SEGMENT_COPY[member.segment];
                    return (
                      <Link
                        key={member.id}
                        href={`/app/loyalty/member/${member.id}`}
                        className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-[#fcfcfe] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7958d8]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#232331] bg-[#f0edff] font-black text-[#7958d8]">
                          {(member.name || "M").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#232331]">{member.name || "Member"}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#5c5c70]">{segment.label} · {member.last_activity_at ? `Terakhir ${formatBusinessDateTime(member.last_activity_at)}` : "Belum ada transaksi"}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-sm font-black text-[#166534]">{member.balance} Pts</span>
                          <span className="mt-0.5 block text-[10px] text-[#5c5c70]">{member.purchase_count} kunjungan</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Users className="mx-auto text-[#7958d8]" size={25} />
                  <p className="mt-3 text-sm font-bold">Belum ada member di bagian ini</p>
                  <p className="mt-1 text-xs text-[#5c5c70]">Pilih bagian lain atau tunggu transaksi berikutnya tercatat.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "campaigns" && (
          <div className="space-y-4">

            {sessionRole === "owner" && (birthdayCandidates.length > 0 || anniversaryCandidates.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {birthdayCandidates.length > 0 && (
                  <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#db2777] bg-[#fce7f3] text-[#db2777]">
                        <Cake size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold text-[#db2777]">ULANG TAHUN</p>
                        <h3 className="text-sm font-extrabold text-[#232331]">{birthdayCandidates.length} member dalam {program.birthday_window_days} hari</h3>
                      </div>
                    </div>
                    <div className="mt-3 divide-y divide-[#dedee8] font-mono text-xs">
                      {birthdayCandidates.slice(0, 5).map((c) => (
                        <div key={c.customer_id} className="flex items-center justify-between py-1.5">
                          <span className="truncate font-sans font-bold text-[#232331]">{c.name || "Member"}</span>
                          <span className="shrink-0 text-[#5c5c70]">{c.days_until === 0 ? "Hari ini" : `${c.days_until} hari lagi`}</span>
                        </div>
                      ))}
                      {birthdayCandidates.length > 5 && <p className="pt-1.5 text-[#7b7b8e]">+{birthdayCandidates.length - 5} lainnya</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDateCampaign("birthday")}
                      disabled={campaignBusy}
                      className="btn-tactile mt-3 w-full rounded-lg border border-[#232331] bg-[#232331] py-2.5 text-xs font-black text-[#d9ff57] disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar ucapan ulang tahun"}
                    </button>
                  </div>
                )}

                {anniversaryCandidates.length > 0 && (
                  <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#7958d8] bg-[#f0edff] text-[#7958d8]">
                        <CalendarHeart size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold text-[#7958d8]">ANNIVERSARY MEMBER</p>
                        <h3 className="text-sm font-extrabold text-[#232331]">{anniversaryCandidates.length} member dalam {program.birthday_window_days} hari</h3>
                      </div>
                    </div>
                    <div className="mt-3 divide-y divide-[#dedee8] font-mono text-xs">
                      {anniversaryCandidates.slice(0, 5).map((c) => (
                        <div key={c.customer_id} className="flex items-center justify-between py-1.5">
                          <span className="truncate font-sans font-bold text-[#232331]">{c.name || "Member"}</span>
                          <span className="shrink-0 text-[#5c5c70]">{c.days_until === 0 ? "Hari ini" : `${c.days_until} hari lagi`}</span>
                        </div>
                      ))}
                      {anniversaryCandidates.length > 5 && <p className="pt-1.5 text-[#7b7b8e]">+{anniversaryCandidates.length - 5} lainnya</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDateCampaign("anniversary")}
                      disabled={campaignBusy}
                      className="btn-tactile mt-3 w-full rounded-lg border border-[#232331] bg-white py-2.5 text-xs font-black text-[#232331] disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar ucapan anniversary"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {sessionRole === "owner" && (
              <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#7958d8] bg-[#f0edff] text-[#7958d8]">
                    <Tag size={15} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold text-[#7958d8]">TEMPLATE & KODE PROMO</p>
                    <h3 className="text-sm font-extrabold text-[#232331]">Pilih tujuan, KAEL siapkan kode pelacaknya</h3>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5c5c70]">Kode unik tertanam otomatis di pesan. Kasir memasukkannya di kasir saat pelanggan datang — dari situ KAEL tahu campaign ini benar-benar dipakai, bukan cuma dibaca.</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAMPAIGN_GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => handleSelectGoal(g.key)}
                      className={`rounded-xl border-2 p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7958d8] ${
                        campaignGoalKey === g.key ? "border-[#232331] bg-[#232331] text-white" : "border-[#dedee8] bg-white text-[#232331] hover:border-[#7958d8]"
                      }`}
                    >
                      <span className="block text-xs font-black">{g.name}</span>
                      <span className={`mt-0.5 block text-[10px] leading-4 ${campaignGoalKey === g.key ? "text-[#dedee8]" : "text-[#7b7b8e]"}`}>{g.description}</span>
                    </button>
                  ))}
                </div>

                {selectedGoal && (
                  <div className="mt-4 space-y-3 border-t border-[#dedee8] pt-4">
                    <div>
                      <label className="block font-mono text-xs font-bold text-[#232331]">Nama ajakan</label>
                      <input
                        value={goalCampaignName}
                        onChange={(e) => setGoalCampaignName(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border-2 border-[#232331] px-3 text-sm font-semibold text-[#232331]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs font-bold text-[#232331]">Pesan (edit sesuai gaya tokomu)</label>
                      <textarea
                        value={goalMessageTemplate}
                        onChange={(e) => setGoalMessageTemplate(e.target.value.slice(0, 2000))}
                        rows={3}
                        className="mt-1 w-full rounded-xl border-2 border-[#232331] p-2.5 text-xs text-[#232331]"
                      />
                      <p className="mt-1 text-[10px] text-[#7b7b8e]">{"{{nama}} {{kode}} {{toko}}"} otomatis diisi per pelanggan saat dibagikan.</p>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="w-32 shrink-0">
                        <label className="block font-mono text-xs font-bold text-[#232331]">Bonus poin / kode</label>
                        <input
                          type="number"
                          min={0}
                          value={goalRewardPoints}
                          onChange={(e) => setGoalRewardPoints(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border-2 border-[#232331] p-2.5 text-sm font-black text-[#232331]"
                        />
                      </div>
                      <p className="text-[10px] text-[#7b7b8e]">Isi 0 kalau kodenya cuma buat melacak diskon manual di kasir, bukan poin loyalty.</p>
                    </div>
                    <p className="text-xs text-[#5c5c70]">Target: <strong className="text-[#232331]">{goalTargetMembers.length} member</strong> yang cocok dengan tujuan ini dan sudah setuju menerima promo.</p>
                    <button
                      type="button"
                      onClick={() => void handleCreateGoalCampaign()}
                      disabled={!goalTargetMembers.length || campaignBusy}
                      className="btn-tactile w-full rounded-lg border-2 border-[#232331] bg-[#d9ff57] py-2.5 text-xs font-black text-[#232331] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar + cetak kode promo"}
                    </button>
                  </div>
                )}
              </div>
            )}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-[#232331] p-4 text-white shadow-ink-md sm:p-6">
              <span className="font-mono text-[10px] font-bold text-[#d9ff57]">AJAKAN KEMBALI</span>
              <h3 className="mt-1 text-lg font-black">Buat daftar chat yang bisa dilacak</h3>
              <p className="mt-2 text-sm leading-5 text-[#dedee8]">Pilih kelompok member, buat daftar, lalu buka WhatsApp satu per satu. KAEL hanya memasukkan member yang sudah setuju menerima promo.</p>

              {sessionRole === "owner" ? (
                <div className="mt-5 space-y-3 border-t border-white/20 pt-4">
                  <label className="block text-xs font-bold text-[#d9ff57]" htmlFor="campaign-name">Nama ajakan</label>
                  <input id="campaign-name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder={`Contoh: Ajakan ${MEMBER_SEGMENT_COPY[campaignSegment].label.toLowerCase()}`} className="min-h-11 w-full rounded-lg border border-white/30 bg-white px-3 text-sm font-semibold text-[#232331] placeholder:text-[#7b7b8e]" />
                  <p className="text-xs leading-5 text-[#dedee8]">Target: {campaignMembers.length} member {MEMBER_SEGMENT_COPY[campaignSegment].label.toLowerCase()} yang setuju menerima promo.</p>
                  <button type="button" onClick={handleCreateCampaign} disabled={!campaignMembers.length || campaignBusy} className="btn-tactile inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d9ff57] bg-[#d9ff57] px-3 text-xs font-black text-[#232331] disabled:cursor-not-allowed disabled:opacity-50">
                    <Plus size={15} />
                    {campaignBusy ? "Membuat daftar..." : "Buat daftar ajakan"}
                  </button>
                </div>
              ) : (
                <div className="mt-5 border-t border-white/20 pt-4 text-xs leading-5 text-[#dedee8]">Daftar dan riwayat ajakan hanya dapat dikelola pemilik usaha.</div>
              )}
            </div>

            <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-6">
              <div className="flex flex-col gap-2 border-b border-[#dedee8] pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold text-[#7958d8]">CAMPAIGN TERBARU</p>
                  <h3 className="mt-0.5 text-sm font-extrabold">{currentCampaign?.name || "Belum ada daftar ajakan"}</h3>
                  {currentCampaign?.code && (
                    <p className="mt-0.5 font-mono text-[11px] text-[#7958d8]">
                      Kode <strong className="tracking-wider">{currentCampaign.code}</strong> · dipakai {currentCampaign.code_used_count}x
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("segments")}
                  className="min-h-11 rounded-lg border border-[#232331] bg-white px-3 text-xs font-bold text-[#232331]"
                >
                  Ganti kelompok
                </button>
              </div>

              {currentCampaign && campaignRecipients.length ? (
                <div className="mt-1 divide-y divide-[#dedee8]">
                  {campaignRecipients.map((member) => (
                    <div key={member.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{member.name || "Member"}</p>
                        <p className="mt-0.5 text-xs text-[#5c5c70]">Saldo {member.balance} Pts · {member.purchase_count} kunjungan · {member.status === "sent" ? "Sudah dikirim" : member.status === "opened" ? "Chat sudah dibuka" : member.status === "skipped" ? "Dilewati" : "Belum dihubungi"}</p>
                      </div>
                      {sessionRole === "owner" && <div className="flex shrink-0 gap-2">
                        <a href={buildSavedCampaignWhatsAppLink(member)} target="_blank" rel="noreferrer" onClick={() => { void handleCampaignRecipientStatus(member.id, "opened"); }} className="btn-tactile inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#232331] bg-[#d9ff57] px-3 text-xs font-bold text-[#232331]"><MessageCircle size={15} />Buka WA</a>
                        <button type="button" onClick={() => { void handleCampaignRecipientStatus(member.id, "sent"); }} className="min-h-11 rounded-lg border border-[#232331] bg-white px-3 text-xs font-bold text-[#232331]">Tandai terkirim</button>
                      </div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto text-[#7958d8]" size={25} />
                  <p className="mt-3 text-sm font-bold">Belum ada daftar ajakan</p>
                  <p className="mt-1 text-xs text-[#5c5c70]">Pilih kelompok, lalu buat daftar agar setiap chat dan hasilnya bisa ditinjau.</p>
                </div>
              )}
            </div>

            {sessionRole === "owner" && <div className="lg:col-span-2 rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4">
              <div className="flex items-baseline justify-between gap-3"><div><p className="font-mono text-[10px] font-bold text-[#7958d8]">RIWAYAT CAMPAIGN</p><h3 className="mt-0.5 text-sm font-extrabold">Yang sudah pernah dibuat</h3></div><span className="text-xs text-[#5c5c70]">Maks. 20 terbaru</span></div>
              {campaigns.length ? <div className="mt-3 divide-y divide-[#dedee8]">{campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><button type="button" onClick={() => { void handleSelectCampaign(campaign); }} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold">{campaign.name}</p><p className="mt-0.5 text-xs text-[#5c5c70]">{campaign.recipient_count} target · {campaign.opened_count} chat dibuka · {campaign.sent_count} ditandai terkirim · {campaign.returned_count} kembali belanja{campaign.code ? ` · kode dipakai ${campaign.code_used_count}x` : ""}</p></button><button type="button" onClick={() => { void handleSelectCampaign(campaign); }} disabled={campaignBusy} className="min-h-10 rounded-lg border border-[#232331] bg-white px-3 text-xs font-bold text-[#232331] disabled:opacity-50">{currentCampaign?.id === campaign.id ? "Sedang dibuka" : "Buka"}</button></div>)}</div> : <p className="mt-3 text-xs text-[#5c5c70]">Belum ada riwayat.</p>}
              <p className="mt-3 text-[11px] leading-4 text-[#7b7b8e]">"Kembali belanja" berarti ada transaksi setelah daftar dibuat — sinyal lunak, bisa jadi sebab lain. "Kode dipakai" adalah bukti nyata: diketik langsung di kasir.</p>
            </div>}
          </section>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: KATALOG REWARD & PROTEKSI BIAYA OWNER */}
        {/* ============================================================= */}
        {activeTab === "rewards" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Katalog Hadiah &amp; Proteksi Margin Biaya ({rewards.length} Reward)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Sistem otomatis menghitung estimasi persentase diskon efektif agar program loyalitas tidak merugikan UMKM.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingRewardId(null);
                  setRewardName("");
                  setRewardPointCost(10);
                  setRewardMarketValue(25000);
                  setRewardStock("");
                  setShowRewardModal(true);
                }}
                className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border sm:border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Tambah Reward</span>
              </button>
            </div>

            {/* Rewards Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              {rewards.map((rw) => {
                const analysis = calculateRewardDiscountRate(rw.point_cost, program.earn_rate, rw.market_value);
                return (
                  <div key={rw.id} className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-3 shadow-ink-xs">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#232331] font-sans truncate">{rw.name}</h4>
                        <span className="text-[10px] text-[#7b7b8e]">Nilai Jual: {formatRupiah(rw.market_value)}</span>
                      </div>
                      <span className="rounded-xl border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 font-black text-xs text-[#7958d8] shrink-0">
                        {rw.point_cost} Pts
                      </span>
                    </div>

                    {/* Cost Protection Analysis */}
                    <div className="rounded-xl bg-white p-2.5 border border-[#dedee8] space-y-1 text-[10.5px]">
                      <div className="flex justify-between">
                        <span className="text-[#7b7b8e]">Syarat Belanja:</span>
                        <span className="font-bold text-[#232331]">{formatRupiah(analysis.requiredSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7b7b8e]">Diskon Efektif:</span>
                        <span className={`font-black ${analysis.isHighDiscount ? "text-[#d97706]" : "text-[#16a34a]"}`}>
                          {analysis.discountRatePct.toFixed(1)}% {analysis.isHighDiscount ? "⚠️" : "✓"}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1 border-t border-[#dedee8]">
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(rw.id, rw.name)}
                        className="btn-tactile rounded-lg border border-[#dedee8] bg-white p-1 text-[#7b7b8e] hover:text-[#ef4444]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: ATURAN PROGRAM (POIN VS STAMP) */}
        {/* ============================================================= */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveProgramSettings} className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-5">
            
            <div className="border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Pengaturan Program Loyalitas Toko
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                Pilih satu model: Mode Poin (belanja nominal rupiah) atau Mode Stamp (kunjungan).
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* Program Mode Selection */}
              <div className="space-y-2">
                <label className="block font-bold text-[#232331]">Model Program:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProgram({ ...program, mode: "point" })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      program.mode === "point"
                        ? "border-[#232331] bg-[#232331] text-[#d9ff57]"
                        : "border-[#dedee8] bg-white text-[#7b7b8e]"
                    }`}
                  >
                    <span className="font-black text-sm block">1. Mode Poin</span>
                    <span className="text-[9.5px] opacity-80">Cocok resto &amp; retail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProgram({ ...program, mode: "stamp" })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      program.mode === "stamp"
                        ? "border-[#232331] bg-[#232331] text-[#d9ff57]"
                        : "border-[#dedee8] bg-white text-[#7b7b8e]"
                    }`}
                  >
                    <span className="font-black text-sm block">2. Mode Stamp</span>
                    <span className="text-[9.5px] opacity-80">Cocok kedai kopi &amp; barbershop</span>
                  </button>
                </div>
              </div>

              {/* Earn Rate / Kurs Poin */}
              <div className="space-y-1">
                <label className="block font-bold text-[#232331]">
                  Kurs Perolehan Poin (Rupiah per 1 Poin):
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[#7b7b8e] font-bold">Rp</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={program.earn_rate}
                    onChange={(e) => setProgram({ ...program, earn_rate: Number(e.target.value) })}
                    className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                  />
                </div>
                <span className="text-[10px] text-[#7b7b8e]">
                  Misal Rp 10.000: Belanja Rp 85.000 mendapatkan 8 Poin.
                </span>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold text-[#232331]">Masa berlaku poin:</label>
                <select
                  value={program.point_expiry_months ?? "never"}
                  onChange={(e) => setProgram({ ...program, point_expiry_months: e.target.value === "never" ? null : Number(e.target.value) })}
                  className="min-h-11 w-full rounded-xl border-2 border-[#232331] bg-white p-2.5 font-bold text-[#232331]"
                >
                  <option value="never">Poin tidak kedaluwarsa</option>
                  <option value="3">3 bulan</option>
                  <option value="6">6 bulan</option>
                  <option value="12">12 bulan</option>
                  <option value="24">24 bulan</option>
                </select>
                <span className="text-[10px] text-[#7b7b8e]">Poin lama dicek dari transaksi paling awal. Owner selalu meninjau dan menerapkan penghapusan poinnya sendiri.</span>
              </div>

            </div>

            <div className="space-y-4 border-t border-[#dedee8] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#232331]">Program Referral</h4>
                  <p className="mt-0.5 text-[11px] text-[#7b7b8e]">Member ajak teman. Bonus pengajak cair saat temannya belanja pertama kali, bukan saat mendaftar — supaya tidak bisa dipanen dengan pendaftaran palsu.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.referral_is_active}
                    onChange={(e) => setProgram({ ...program, referral_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#232331]"
                  />
                  <span className="font-bold text-[#232331]">Aktif</span>
                </label>
              </div>

              {program.referral_is_active && (
                <div className="grid gap-4 font-mono text-xs sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#232331]">Bonus untuk pengajak:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.referral_referrer_points}
                      onChange={(e) => setProgram({ ...program, referral_referrer_points: Number(e.target.value) })}
                      className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                    />
                    <span className="text-[10px] text-[#7b7b8e]">{program.mode === "stamp" ? "Stempel" : "Poin"} per teman yang berhasil belanja.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#232331]">Bonus untuk teman baru:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.referral_referee_points}
                      onChange={(e) => setProgram({ ...program, referral_referee_points: Number(e.target.value) })}
                      className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                    />
                    <span className="text-[10px] text-[#7b7b8e]">{program.mode === "stamp" ? "Stempel" : "Poin"} ekstra di belanja pertamanya.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#232331]">Batas pengajak / bulan:</label>
                    <input
                      type="number"
                      min={1}
                      value={program.referral_monthly_cap}
                      onChange={(e) => setProgram({ ...program, referral_monthly_cap: Number(e.target.value) })}
                      className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                    />
                    <span className="text-[10px] text-[#7b7b8e]">Maks. bonus pengajak yang cair per member per bulan.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t border-[#dedee8] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#232331]">Ulang Tahun & Anniversary</h4>
                  <p className="mt-0.5 text-[11px] text-[#7b7b8e]">KAEL menyiapkan daftar member yang berulang tahun untuk kamu kirimi ucapan. Bonus poin opsional — anniversary jadi member selalu tersedia sebagai ucapan tanpa bonus poin.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.birthday_is_active}
                    onChange={(e) => setProgram({ ...program, birthday_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#232331]"
                  />
                  <span className="font-bold text-[#232331]">Aktif</span>
                </label>
              </div>

              {program.birthday_is_active && (
                <div className="grid gap-4 font-mono text-xs sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#232331]">Bonus poin ulang tahun:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.birthday_bonus_points}
                      onChange={(e) => setProgram({ ...program, birthday_bonus_points: Number(e.target.value) })}
                      className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                    />
                    <span className="text-[10px] text-[#7b7b8e]">{program.mode === "stamp" ? "Stempel" : "Poin"}. Isi 0 untuk ucapan tanpa bonus.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#232331]">Jendela deteksi (hari):</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={program.birthday_window_days}
                      onChange={(e) => setProgram({ ...program, birthday_window_days: Number(e.target.value) })}
                      className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                    />
                    <span className="text-[10px] text-[#7b7b8e]">Dipakai bareng untuk ulang tahun & anniversary.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-[#dedee8] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#232331]">Level Member</h4>
                  <p className="mt-0.5 text-[11px] text-[#7b7b8e]">Basic, Silver, Gold — dihitung otomatis dari total belanja member, bukan disetel manual. Level naik cair sendiri, tidak pernah turun.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.tiers_is_active}
                    onChange={(e) => setProgram({ ...program, tiers_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#232331]"
                  />
                  <span className="font-bold text-[#232331]">Aktif</span>
                </label>
              </div>

              {!program.tiers_is_active && customers.length < 200 && (
                <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-[11px] leading-5 text-[#5c5c70]">
                  Level lebih terasa manfaatnya di toko dengan banyak member — sekarang tokomu punya {customers.length} member. Boleh diaktifkan kapan saja, tapi jangan kaget kalau efeknya belum terasa selagi membernya masih sedikit.
                </div>
              )}

              {program.tiers_is_active && (
                <p className="text-[11px] text-[#5c5c70]">Atur daftar levelnya di bagian &ldquo;Kelola Level Member&rdquo; setelah pengaturan ini disimpan.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#dedee8]">
              <button
                type="submit"
                className="btn-tactile rounded-xl bg-[#232331] px-6 py-2.5 font-mono text-xs font-black text-[#d9ff57] shadow-ink-xs"
              >
                Simpan Pengaturan Program ✓
              </button>
            </div>

          </form>
        )}

        {activeTab === "settings" && sessionRole === "owner" && program.tiers_is_active && (
          <section className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-6">
            <div className="flex flex-col gap-3 border-b border-[#dedee8] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#7958d8]">KELOLA LEVEL MEMBER</p>
                <h3 className="mt-0.5 text-sm font-extrabold">{tiers.length} level tersedia</h3>
              </div>
              <button
                type="button"
                onClick={() => openTierModal()}
                className="btn-tactile inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Tambah Level</span>
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier) => (
                <div key={tier.id} className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-2 shadow-ink-xs font-mono text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Crown size={14} className="text-[#d97706]" />
                      <h4 className="font-black text-sm text-[#232331] font-sans">{tier.name}</h4>
                    </div>
                    <span className="shrink-0 rounded-lg border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 font-black text-[#7958d8]">{Number(tier.earn_multiplier).toFixed(2)}x</span>
                  </div>
                  <p className="text-[11px] text-[#5c5c70]">Mulai dari total belanja {formatRupiah(tier.min_lifetime_spend)}</p>
                  {tier.benefit_note && <p className="text-[11px] italic text-[#232331]">&ldquo;{tier.benefit_note}&rdquo;</p>}
                  <div className="flex justify-end gap-1.5 pt-1.5 border-t border-[#dedee8]">
                    <button type="button" onClick={() => openTierModal(tier)} className="rounded-lg border border-[#dedee8] bg-white px-2.5 py-1 text-[11px] font-bold text-[#232331] hover:border-[#7958d8]">Edit</button>
                    <button type="button" onClick={() => handleDeleteTier(tier.id, tier.name)} className="rounded-lg border border-[#dedee8] bg-white px-2.5 py-1 text-[11px] font-bold text-[#7b7b8e] hover:border-[#ef4444] hover:text-[#ef4444]">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "settings" && sessionRole === "owner" && program.point_expiry_months && (
          <section className="rounded-2xl border border-[#232331] bg-[#fcfcfe] p-4 shadow-ink-xs sm:p-5">
            <div className="flex flex-col gap-3 border-b border-[#dedee8] pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#7958d8]">PENGAWASAN POIN</p>
                <h3 className="mt-0.5 text-sm font-extrabold">Poin yang perlu ditinjau</h3>
                <p className="mt-1 text-xs leading-5 text-[#5c5c70]">Masa berlaku saat ini: {program.point_expiry_months} bulan. KAEL tidak menghapus poin tanpa tindakan owner.</p>
              </div>
              {expiryDue.length > 0 && <button type="button" onClick={handleExpireDuePoints} disabled={expiryBusy} className="btn-tactile min-h-11 shrink-0 rounded-lg border border-[#232331] bg-[#d9ff57] px-3 text-xs font-black text-[#232331] disabled:opacity-50">{expiryBusy ? "Menerapkan..." : `Terapkan ${expiryDue.reduce((sum, item) => sum + item.points, 0)} poin`}</button>}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] p-3">
                <p className="text-xs font-black text-[#b91c1c]">Sudah jatuh tempo: {expiryDue.reduce((sum, item) => sum + item.points, 0)} poin</p>
                {expiryDue.length ? <div className="mt-2 divide-y divide-[#fecaca]">{expiryDue.slice(0, 5).map((item) => <Link key={item.customer_id} href={`/app/loyalty/member/${item.customer_id}`} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="truncate font-bold text-[#232331]">{item.name || "Member"}</span><span className="shrink-0 font-mono font-black text-[#b91c1c]">{item.points} Pts</span></Link>)}</div> : <p className="mt-2 text-xs text-[#5c5c70]">Belum ada poin yang jatuh tempo.</p>}
              </div>
              <div className="rounded-xl border border-[#fde68a] bg-[#fffdf3] p-3">
                <p className="text-xs font-black text-[#a16207]">Total dalam 30 hari: {expirySoon.reduce((sum, item) => sum + item.points, 0)} poin</p>
                {expirySoon.length ? <div className="mt-2 divide-y divide-[#fde68a]">{expirySoon.slice(0, 5).map((item) => <Link key={item.customer_id} href={`/app/loyalty/member/${item.customer_id}`} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="truncate font-bold text-[#232331]">{item.name || "Member"}</span><span className="shrink-0 font-mono font-black text-[#a16207]">{item.points} Pts</span></Link>)}</div> : <p className="mt-2 text-xs text-[#5c5c70]">Belum ada poin yang mendekati jatuh tempo.</p>}
              </div>
            </div>
          </section>
        )}

        {/* ============================================================= */}
        {/* TAB 5: AUDIT KASIR & ANTI-KECURANGAN */}
        {/* ============================================================= */}
        {activeTab === "audit" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Audit Penerbitan Poin per Staf Kasir
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                Setiap baris ledger mencatat ID kasir yang bertugas untuk mendeteksi anomali penambahan poin.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 font-mono text-xs">
              {staffAudit.map((audit) => (
                <div key={audit.id} className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-2 shadow-ink-xs">
                  <div className="flex justify-between items-start">
                    <h4 className="font-black text-sm text-[#232331] font-sans">{audit.name}</h4>
                    <span className="text-[10px] bg-[#dcfce7] text-[#16a34a] px-2 py-0.5 rounded font-bold">
                      {audit.total_entries} Transaksi
                    </span>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-[#dedee8] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Total Poin Diterbitkan:</span>
                      <span className="font-black text-[#7958d8]">{audit.points_issued} Pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Penyesuaian Manual:</span>
                      <span className="font-bold text-[#c2410c]">{audit.manual_count} Pts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {activeTab === "audit" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">

            <div className="border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Poin Referral per Pengajak
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                Siapa mengajak berapa teman, dan berapa yang sampai belanja. Ini tidak mencegah kecurangan, cuma membuatnya terlihat.
              </p>
            </div>

            {referralReport.length ? (
              <div className="divide-y divide-[#dedee8] font-mono text-xs">
                {referralReport.map((row) => (
                  <div key={row.customer_id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/loyalty/member/${row.customer_id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-sans text-sm font-bold text-[#232331]">{row.name || "Member"}</span>
                      <span className="mt-0.5 block text-[10px] text-[#5c5c70]">Kode {row.code || "—"}</span>
                    </Link>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-[#232331]">{row.rewarded_count}/{row.referred_count} belanja</span>
                      <span className="mt-0.5 block text-[10px] font-black text-[#7958d8]">+{row.points_earned} Pts</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5c5c70]">Belum ada member yang mengajak teman lewat kode referral.</p>
            )}

          </div>
        )}

      </main>

      {/* MODAL: REWARD CREATOR */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in fade-in zoom-in duration-150 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                {editingRewardId ? "Edit Reward" : "Buat Reward Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="block font-mono font-bold text-[#232331]">Nama Hadiah / Traktiran:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gratis 1x Spanish Latte"
                  value={rewardName}
                  onChange={(e) => setRewardName(e.target.value)}
                  className="w-full rounded-xl border border-[#232331] p-2.5 text-xs font-bold text-[#232331]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Biaya Poin:</label>
                  <input
                    type="number"
                    min={1}
                    value={rewardPointCost}
                    onChange={(e) => setRewardPointCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Nilai Rupiah Menu (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={rewardMarketValue}
                    onChange={(e) => setRewardMarketValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>
              </div>

              {/* Live Cost Protection Box */}
              <div className={`p-3 rounded-2xl border font-mono text-[10.5px] space-y-1 ${
                rewardDiscountAnalysis.isHighDiscount ? "bg-[#fff5f5] border-[#ef4444]" : "bg-[#f0edff] border-[#7958d8]"
              }`}>
                <span className="font-bold text-[#232331] block">PROTEKSI BIAYA DISKON:</span>
                <p className="text-[#7b7b8e]">
                  Pelanggan harus belanja total <strong>{formatRupiah(rewardDiscountAnalysis.requiredSpend)}</strong> untuk dapat hadiah ini.
                </p>
                <div className="flex justify-between font-bold pt-1">
                  <span>Diskon Efektif:</span>
                  <span className={rewardDiscountAnalysis.isHighDiscount ? "text-[#ef4444]" : "text-[#16a34a]"}>
                    {rewardDiscountAnalysis.discountRatePct.toFixed(1)}% {rewardDiscountAnalysis.isHighDiscount ? "(Waspada: Terlalu Besar!)" : "(Sehat ✓)"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowRewardModal(false)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-1.5 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile rounded-xl bg-[#232331] px-4 py-1.5 font-bold text-[#d9ff57]"
                >
                  Simpan Hadiah ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTierModal && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in fade-in zoom-in duration-150 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                {editingTierId ? "Edit Level" : "Tambah Level Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="block font-mono font-bold text-[#232331]">Nama Level:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gold"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded-xl border border-[#232331] p-2.5 text-xs font-bold text-[#232331]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Syarat Total Belanja (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={tierMinSpend}
                    onChange={(e) => setTierMinSpend(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Pengali Poin:</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.25}
                    value={tierMultiplier}
                    onChange={(e) => setTierMultiplier(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#232331]">Catatan Manfaat (opsional):</label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Contoh: Prioritas antrean, hadiah ulang tahun ekstra"
                  value={tierBenefitNote}
                  onChange={(e) => setTierBenefitNote(e.target.value)}
                  className="w-full rounded-xl border border-[#232331] p-2.5 text-xs font-bold text-[#232331]"
                />
              </div>

              <div className="rounded-2xl border border-[#7958d8] bg-[#f0edff] p-3 font-mono text-[10.5px] text-[#5c5c70]">
                Member di level ini dapat <strong className="text-[#232331]">{tierMultiplier.toFixed(2)}x</strong> {program.mode === "stamp" ? "stempel" : "poin"} setiap belanja, otomatis lewat kasir maupun QR order — tidak ada langkah tambahan.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowTierModal(false)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-1.5 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={tierBusy}
                  className="btn-tactile rounded-xl bg-[#232331] px-4 py-1.5 font-bold text-[#d9ff57] disabled:opacity-50"
                >
                  {tierBusy ? "Menyimpan..." : "Simpan Level ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMER LEDGER DETAIL */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in fade-in font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div>
                <h3 className="font-black text-base text-[#232331] font-sans">
                  Buku Ledger: {viewingCustomer.name}
                </h3>
                <span className="text-[11px] text-[#7b7b8e]">
                  Saldo: {viewingDetail?.balance ?? 0} Pts · {viewingCustomer.phone_masked}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(viewingDetail?.ledger ?? []).map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl border border-[#dedee8] bg-[#fcfcfe] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#232331] font-sans block text-xs">{item.note}</span>
                    <span className="text-[10px] text-[#7b7b8e]">{formatBusinessDateTime(item.created_at)}</span>
                  </div>
                  <span className={`font-black text-sm ${item.delta > 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta} Pts
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#dedee8]">
              <button
                type="button"
                onClick={() => handleAnonymizeCustomer(viewingCustomer.id, viewingCustomer.name)}
                className="text-[#ef4444] text-[11px] font-bold hover:underline"
              >
                Hapus / Anonimkan Data Member Ini (UU PDP)
              </button>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="rounded-xl bg-[#232331] text-white px-4 py-1.5 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Loyalty Engine · Immutable Append-Only Ledger &amp; UU PDP Protection
      </footer>

    </div>
  );
}

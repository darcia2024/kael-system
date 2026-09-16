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
  redeemCodeAction, saveTierAction, deleteTierAction, exportLoyaltyCustomersAction,
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
import { BusinessMark } from "@/components/business-mark";
import { MemberQrCard, MemberQrModal } from "@/components/member-qr-modal";
import { siteHost } from "@/lib/site";

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
  const [exportingCustomers, setExportingCustomers] = useState(false);
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
  const [showMemberQrModal, setShowMemberQrModal] = useState(false);

  const isMochi = (business?.store_code?.toUpperCase() ?? "") === "MOCHIKAFE" || (business?.name?.toLowerCase().includes("mochi") ?? false);

  // ---------------------------------------------------------------------------
  // PERSONAL MEMBER NOTIFICATION MODAL (Direct WA & Voucher Generator)
  // ---------------------------------------------------------------------------
  const [notifTargetCustomer, setNotifTargetCustomer] = useState<{
    id: string;
    name: string | null;
    phone: string;
    phone_masked: string;
    balance: number;
    token?: string;
  } | null>(null);
  const [notifTemplateType, setNotifTemplateType] = useState<"voucher" | "event" | "birthday" | "reengage" | "custom">("voucher");
  const [notifCustomText, setNotifCustomText] = useState("");

  const activeNotifMessage = useMemo(() => {
    if (!notifTargetCustomer) return "";
    const name = notifTargetCustomer.name?.trim().split(/\s+/)[0] || "Kak";
    const store = business?.name || "Mochi Cafe n Resto";
    const balance = notifTargetCustomer.balance;
    const link = notifTargetCustomer.token ? `https://${siteHost}/m/${notifTargetCustomer.token}` : `https://${siteHost}/m`;

    if (notifTemplateType === "voucher") {
      return `Halo Kak ${name}! 🎉 Terima kasih sudah setia jadi member ${store}.\n\nKamu memiliki saldo ${balance} poin yang siap ditukarkan dengan berbagai voucher & menu gratis.\n\nCek kartu member & katalog hadiahmu di sini:\n${link}\n\nSampai jumpa di kasir ${store} ya!`;
    }
    if (notifTemplateType === "event") {
      return `Halo Kak ${name}! Ada kabar gembira dari ${store} 📅✨\n\nMinggu ini kami mengadakan promo & event spesial khusus member! Kumpulkan poin lebih banyak dan nikmati menu spesial kami.\n\nLihat info lengkap dan kartu membermu:\n${link}\n\nJangan sampai terlewat ya!`;
    }
    if (notifTemplateType === "birthday") {
      return `Selamat Ulang Tahun Kak ${name}! 🎂🎉🎁\n\nSeluruh tim ${store} mengucapkan selamat bertambah usia! Kami sudah menyiapkan traktiran & voucher spesial untuk hari bahagiamu.\n\nTunjukkan kartu membermu ke kasir saat mampir:\n${link}\n\nSemoga hari-harimu selalu menyenangkan!`;
    }
    if (notifTemplateType === "reengage") {
      return `Halo Kak ${name}! Udah lama nih gak ketemu di ${store} ☕✨\n\nKami kangen kehadiranmu! Saldo poinmu masih tersimpan aman (${balance} poin) dan ada menu baru yang siap kamu coba.\n\nBuka kartu membermu di sini:\n${link}\n\nMampir lagi yuk!`;
    }
    return notifCustomText || `Halo Kak ${name}, ada info spesial dari ${store} untuk kartu membermu (${link}).`;
  }, [notifTargetCustomer, notifTemplateType, notifCustomText, business?.name]);

  const handleOpenNotifModal = (cust: CustomerDirectoryEntry) => {
    const insight = memberInsights.find((m) => m.id === cust.id);
    setNotifTargetCustomer({
      id: cust.id,
      name: cust.name,
      phone: insight?.phone || cust.phone_masked,
      phone_masked: cust.phone_masked,
      balance: cust.balance,
      token: insight?.token,
    });
    setNotifTemplateType("voucher");
    setNotifCustomText("");
  };


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

  const exportCustomers = async () => {
    setExportingCustomers(true);
    const result = await exportLoyaltyCustomersAction();
    setExportingCustomers(false);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Nama", "WhatsApp", "Saldo poin", "Setuju promo", "Tanggal gabung"],
      ...result.data.map((customer) => [customer.name ?? "Member", customer.phone, customer.point_balance, customer.marketing_opt_in ? "Ya" : "Tidak", customer.created_at]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `member-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
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
    <div className="min-h-screen bg-[#f0f5f2] text-[#0b3d2e] font-sans flex flex-col pb-16 sm:pb-8">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] text-white backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href={sessionRole === "owner" ? "/app" : "/app/staff"}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors"
              title="Kembali ke Hub KAEL"
            >
              <ArrowLeft size={16} />
            </Link>

            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-xs sm:text-base text-white truncate tracking-tight">
                  KAEL Loyalty
                </h1>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[8.5px] sm:text-[9.5px] font-bold text-[#073829] shrink-0">
                  CRM Pelanggan
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-emerald-200/80 font-mono block truncate">
                {business?.name || "Mochi Cafe n Resto"} · CRM &amp; Kasir Pelanggan
              </span>
            </div>
          </div>

          {/* Actions: QR Member & Active Staff Switcher */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setShowMemberQrModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#c8f53a]/40 bg-[#c8f53a] px-2.5 sm:px-3 py-1.5 text-xs font-black text-[#073829] hover:bg-[#d9ff57] transition-all shadow-xs shrink-0"
              title="Buka QR & Link Pendaftaran Member"
            >
              <QrCode size={14} />
              <span className="hidden xs:inline">QR Member</span>
            </button>

            <span className="text-[10.5px] text-emerald-200/80 hidden sm:inline">Kasir:</span>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="rounded-xl border border-emerald-600/40 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white focus:bg-emerald-900 focus:outline-none transition-colors"
            >
              {staffList.map((st) => (
                <option key={st.id} value={st.id} className="text-[#1a382d] bg-white">
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
          
          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#167052] uppercase tracking-wider">TOTAL MEMBER</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#167052]">
                <Users size={14} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#0b3d2e]">
                {customers.length} Orang
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#167052] font-mono font-bold block mt-0.5 sm:mt-1 truncate">
                ✓ UU PDP Compliant
              </span>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d97706] uppercase tracking-wider">POIN BEREDAR</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Gift size={14} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#0b3d2e]">
                {customers.reduce((acc, c) => acc + c.balance, 0)} Pts
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#527867] font-mono block mt-0.5 sm:mt-1 truncate">
                Liabilitas Belanja
              </span>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#167052] uppercase tracking-wider">KATALOG HADIAH</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#167052]">
                <Ticket size={14} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#0b3d2e]">
                {rewards.length} Reward
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#527867] font-mono block mt-0.5 sm:mt-1 truncate">
                {rewards.filter((r) => r.is_active).length} Aktif Ditukar
              </span>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#0b3d2e] uppercase tracking-wider">KURS PROGRAM</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e]">
                <Sparkles size={14} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-extrabold font-mono text-[#0b3d2e] truncate">
                {program.mode === "stamp" ? "1 Kunjungan" : formatRupiah(program.earn_rate)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#527867] font-mono block mt-0.5 sm:mt-1 truncate">
                = 1 {program.mode === "stamp" ? "Stamp" : "Poin"}
              </span>
            </div>
          </div>

        </div>

        {/* 5-TAB NAVIGATION BAR */}
        <div className="flex items-center overflow-x-auto scrollbar-none rounded-2xl border border-[#d8e3de] bg-white p-1.5 font-mono text-xs font-bold gap-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("cashier")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "cashier" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <Receipt size={13} />
            <span>1. Layar Kasir Cepat (3-Ketukan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "customers" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <Users size={13} />
            <span>2. Data Pelanggan (PDP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("segments")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "segments" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <TrendingUp size={13} />
            <span>3. Segment Member</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "campaigns" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <MessageCircle size={13} />
            <span>4. Ajakan WA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "rewards" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <Gift size={13} />
            <span>5. Katalog Reward &amp; Proteksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "settings" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
            }`}
          >
            <Sliders size={13} />
            <span>6. Aturan Program</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "audit" ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3]"
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
            <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
              
              <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#167052]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                    Kasir Member: Poin dan Hadiah
                  </h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#16a34a] font-bold">
                  ● Selesai dalam beberapa detik
                </span>
              </div>

              {/* 4-Digit WA Search Bar */}
              <div className="space-y-1.5">
                <label className="block font-mono font-bold text-xs text-[#1a382d]">
                  1. Cari pelanggan member
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 text-[#527867]" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama atau 4 angka belakang WA, misal 7812"
                    className="w-full rounded-2xl border border-[#d8e3de] pl-10 pr-4 py-2.5 font-bold text-sm text-[#1a382d] focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    autoFocus
                  />
                </div>
                <span className="text-[10px] text-[#527867] font-mono block">
                  Pelanggan cukup sebut nama atau 4 angka terakhir WhatsApp. Nomor lengkap tidak perlu diketik.
                </span>
              </div>

              {/* Search Dropdown / Results List */}
              {searchQuery && (
                <div className="rounded-2xl border border-emerald-300 bg-[#edf8f3] p-2 space-y-1 max-h-48 overflow-y-auto animate-in fade-in font-mono text-xs">
                  <span className="text-[10px] font-bold text-[#167052] px-2 block">
                    Hasil Pencarian ({searchResults.length} Ditemukan):
                  </span>
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-[#527867]">
                      Tidak ada member cocok.{" "}
                      <Link href={`/loyalty/register?toko=${encodeURIComponent(business?.store_code ?? "")}`} target="_blank" className="text-[#167052] font-bold underline">
                        + Daftar Baru
                      </Link>
                    </div>
                  ) : (
                    searchResults.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#c8f53a] transition-all text-left border border-[#d8e3de]"
                      >
                        <div>
                          <span className="font-bold text-[#0b3d2e] font-sans block text-sm">{cust.name}</span>
                          <span className="text-[10.5px] text-[#527867]">{cust.phone_masked}</span>
                        </div>
                        <span className="font-black text-sm text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-lg border border-[#16a34a]/30">
                          {cust.balance} Pts
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!selectedCustomer && !searchQuery && (
                <div className="rounded-xl border border-dashed border-emerald-300 bg-[#f4faf6] p-3 font-sans">
                  <p className="font-bold text-[#1a382d]">Alur kasir yang paling mudah</p>
                  <ol className="mt-2 grid gap-2 text-[11px] leading-relaxed text-[#5c5c70] sm:grid-cols-3">
                    <li><strong className="text-[#167052]">1. Cari</strong><br />Cari nama atau 4 angka WA.</li>
                    <li><strong className="text-[#167052]">2. Pilih</strong><br />Pastikan nama dan saldo member benar.</li>
                    <li><strong className="text-[#167052]">3. Proses</strong><br />Tambah poin atau tukar hadiah.</li>
                  </ol>
                </div>
              )}

              {/* Selected Customer Active Card */}
              {selectedCustomer && (
                <div className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4 space-y-3 font-mono text-xs animate-in zoom-in-95">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-[#167052] font-bold uppercase block">
                        PELANGGAN TERPILIH
                      </span>
                      <h4 className="font-black text-base text-[#0b3d2e] font-sans">
                        {selectedCustomer.name}
                      </h4>
                      <span className="text-[11px] text-[#527867]">
                        {selectedCustomer.phone_masked}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#527867] block uppercase">SALDO SAAT INI</span>
                      <span className="text-2xl font-black text-[#16a34a] block">
                        {activeCustomerBalance} Pts
                      </span>
                    </div>
                  </div>

                  {/* Add Points Form */}
                  <form onSubmit={handleAddPoints} className="border-t border-[#d8e3de] pt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#1a382d]">
                        2. Catat belanja dan beri poin ({program.mode === "stamp" ? "pakai stamp" : "pakai nominal belanja"})
                      </label>
                      <span className="text-[10px] text-[#167052] font-bold">
                        Setiap {formatRupiah(program.earn_rate)} dapat 1 poin
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2.5 text-xs text-[#527867] font-bold">Rp</span>
                        <input
                          type="number"
                          step={5000}
                          min={5000}
                          value={amountSpentInput}
                          onChange={(e) => setAmountSpentInput(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#d8e3de] pl-9 pr-3 py-2 font-black text-sm text-[#1a382d]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-xl bg-[#0b3d2e] text-[#c8f53a] px-4 py-2 text-xs font-black shadow-xs shrink-0"
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
                          className="px-2 py-1 rounded-lg border border-[#d8e3de] bg-white text-[10px] font-bold text-[#527867] hover:border-[#d8e3de]"
                        >
                          {formatRupiah(amt)}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Redeem Reward Section */}
                  <div className="border-t border-[#d8e3de] pt-3 space-y-2">
                    <label className="block font-bold text-[#1a382d]">
                      3. Tukar hadiah dengan poin (bila pelanggan minta)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRewardId}
                        onChange={(e) => setSelectedRewardId(e.target.value)}
                        className="flex-1 rounded-xl border border-[#d8e3de] bg-white p-2 font-bold text-xs text-[#1a382d]"
                      >
                        <option value="">Pilih hadiah yang ingin ditukar</option>
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
                        className="rounded-xl bg-[#0b3d2e] text-white px-3.5 py-2 text-xs font-black disabled:opacity-40 shrink-0"
                      >
                        Tukar Hadiah
                      </button>
                    </div>
                  </div>

                  {/* Redeem Promo Code Section */}
                  <div className="border-t border-[#d8e3de] pt-3 space-y-2">
                    <label className="block font-bold text-[#1a382d]">
                      4. Pakai kode promo (bila ada)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                        placeholder="Ketik kode dari pelanggan"
                        className="flex-1 rounded-xl border border-[#d8e3de] bg-white p-2 font-mono text-xs font-bold uppercase tracking-wider text-[#1a382d] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#527867]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRedeemCode()}
                        disabled={!promoCodeInput.trim()}
                        className="rounded-xl bg-[#0b3d2e] text-[#c8f53a] px-3.5 py-2 text-xs font-black disabled:opacity-40 shrink-0"
                      >
                        <ShoppingBag size={13} className="inline -mt-0.5 mr-1" />
                        Tukar Kode
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[#d8e3de] pt-3 space-y-2">
                    <label className="block font-bold text-[#1a382d]">
                      5. Cek voucher dari pelanggan
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                        placeholder="Contoh: RW-ABC-123"
                        className="flex-1 rounded-xl border border-[#d8e3de] bg-white p-2 font-mono text-xs font-bold uppercase tracking-wider text-[#1a382d] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#527867]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleLookupVoucher()}
                        disabled={!voucherCodeInput.trim() || voucherBusy}
                        className="rounded-xl border border-[#d8e3de] bg-white px-3.5 py-2 text-xs font-black text-[#1a382d] disabled:opacity-40 shrink-0"
                      >
                        {voucherBusy ? "Cek..." : "Cek Voucher"}
                      </button>
                    </div>
                    {voucherPreview && (
                      <div className={`rounded-xl border p-2.5 ${voucherPreview.status === "issued" ? "border-[#16a34a] bg-[#dcfce7]" : "border-[#ef4444] bg-rose-50"}`}>
                        <p className="font-bold text-[#1a382d]">{voucherPreview.reward_name} untuk {voucherPreview.customer_name || "member"}</p>
                        <p className="mt-0.5 text-[10px] text-[#5c5c70]">
                          {voucherPreview.status === "issued" ? "Voucher masih aktif dan siap dipakai." : voucherPreview.status === "used" ? "Voucher ini sudah dipakai." : "Voucher ini sudah tidak berlaku."}
                        </p>
                        {voucherPreview.status === "issued" && (
                          <button
                            type="button"
                            onClick={() => void handleConsumeVoucher()}
                            disabled={voucherBusy}
                            className="mt-2 rounded-lg bg-[#16a34a] px-3 py-1.5 text-[10.5px] font-bold text-white disabled:opacity-40"
                          >
                            Tandai Sudah Dipakai
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex pt-2 border-t border-[#d8e3de] text-[10.5px]">
                    <Link
                      href={`/app/loyalty/member/${selectedCustomer.id}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d8e3de] bg-[#0b3d2e] px-3 font-bold text-[#c8f53a] shadow-xs"
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

            {/* Right Column (5 cols): Table Standee QR Card & Fast Onboarding */}
            <div className="lg:col-span-5 space-y-4">
              <MemberQrCard
                businessName={business?.name}
                storeCode={business?.store_code}
                logoUrl={business?.logo_url}
                isMochi={isMochi}
                earnRate={program.earn_rate}
              />

              <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 shadow-xs space-y-2.5">
                <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 text-left font-sans text-[11.5px] leading-relaxed text-[#5c5c70]">
                  <p className="font-bold text-[#1a382d]">💡 Panduan Kasir</p>
                  <p className="mt-1">
                    Arahkan pelanggan baru scan QR di atas untuk mengisi formulir di HP sendiri. Setelah sukses terdaftar, cari nama atau 4 angka WhatsApp mereka di panel kiri untuk mencatat poin belanja.
                  </p>
                </div>

                {/* Isi kartu yang dipegang pelanggan: sapaan, jam buka, kabar,
                    dan nomor WhatsApp yang menyalakan tombol simpan kartu. */}
                <Link
                  href="/app/loyalty/kartu"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] py-2.5 text-xs font-bold text-[#c8f53a] shadow-xs transition-colors"
                >
                  <IdCard size={13} />
                  <span>Atur Tampilan &amp; Isi Kartu Member</span>
                </Link>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: DATA PELANGGAN (PDP COMPLIANT) */}
        {/* ============================================================= */}
        {activeTab === "customers" && (
          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8e3de] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                  Database Pelanggan ({customers.length} Member)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#527867]">
                  Data nomor telepon dilindungi sesuai standar UU PDP No. 27/2022.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={exportCustomers}
                  disabled={exportingCustomers || sessionRole !== "owner"}
                  title={sessionRole !== "owner" ? "Hanya owner yang dapat mengekspor data kontak member" : undefined}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 text-xs font-bold text-[#073829] shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={13} />
                  <span>{exportingCustomers ? "Menyiapkan..." : "Ekspor CSV"}</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#d8e3de] text-[#527867] text-[10px] uppercase">
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
                      <tr key={cust.id} className="hover:bg-[#fbfdfc]">
                        <td className="py-3 px-3 font-extrabold text-[#0b3d2e] font-sans">
                          {cust.name}
                        </td>
                        <td className="py-3 px-3">
                          <span>{cust.phone_masked}</span>
                        </td>
                        <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                          {balance} Pts
                        </td>
                        <td className="py-3 px-3 text-[#527867]">
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
                            className="inline-flex min-h-11 items-center rounded-lg border border-[#d8e3de] bg-[#0b3d2e] px-2.5 py-1 text-[10.5px] font-bold text-[#c8f53a]"
                          >
                            Profil
                          </Link>
                          <button
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            className="rounded-lg border border-emerald-300 bg-[#edf8f3] px-2.5 py-1 text-[10.5px] font-bold text-[#167052]"
                          >
                            Buku Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnonymizeCustomer(cust.id, cust.name)}
                            className="rounded-lg border border-[#d8e3de] bg-white px-2 py-1 text-[10.5px] font-bold text-[#527867] hover:text-[#ef4444]"
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
            <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#167052]">PERTUMBUHAN MEMBER</span>
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
                      className="min-h-9 rounded-lg border border-[#d8e3de] bg-[#0b3d2e] px-3 py-1.5 font-mono text-[11px] font-bold text-[#c8f53a] hover:bg-[#0e4837]"
                    >
                      Lihat Analitik Lengkap →
                    </Link>
                  )}
                </div>
              </div>

              {weeklySignups.some((w) => w.count > 0) ? (
                <div className="mt-4 flex h-24 items-end gap-1.5 border-t border-[#d8e3de] pt-3 sm:h-28">
                  {weeklySignups.map((w) => {
                    const max = Math.max(...weeklySignups.map((x) => x.count), 1);
                    const heightPct = Math.max((w.count / max) * 100, w.count > 0 ? 8 : 2);
                    const isLast = w === weeklySignups[weeklySignups.length - 1];
                    return (
                      <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
                        <span className="font-mono text-[9px] font-bold text-[#5c5c70]">{w.count > 0 ? w.count : ""}</span>
                        <div
                          className={`w-full rounded-t-sm ${isLast ? "bg-[#0b3d2e]" : "bg-emerald-100"}`}
                          style={{ height: `${heightPct}%`, minHeight: "3px" }}
                          title={`Minggu ${new Date(w.week_start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${w.count} member baru`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 border-t border-[#d8e3de] pt-3 text-xs text-[#5c5c70]">Belum ada pendaftaran member dalam {weeklySignups.length} minggu terakhir.</p>
              )}
            </div>

            <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex flex-col gap-2 border-b border-[#d8e3de] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#167052]">DATA MEMBER</span>
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
                      className={`min-h-24 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                        selected ? "border-[#d8e3de] bg-[#0b3d2e] text-white shadow-xs" : "border-[#d8e3de] bg-[#fbfdfc] text-[#1a382d] hover:border-emerald-300"
                      }`}
                    >
                      <span className={`font-mono text-xl font-black ${selected ? "text-[#c8f53a]" : "text-[#167052]"}`}>{count}</span>
                      <span className="mt-1 block text-xs font-bold">{copy.label}</span>
                      <span className={`mt-1 block text-[10px] leading-4 ${selected ? "text-[#dedee8]" : "text-[#5c5c70]"}`}>{copy.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#d8e3de] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold">{selectedSegment === "all" ? "Semua member" : MEMBER_SEGMENT_COPY[selectedSegment].label}</h3>
                  <p className="mt-0.5 text-xs text-[#5c5c70]">Buka profil untuk melihat riwayat sebelum mengambil tindakan.</p>
                </div>
                {selectedSegment !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSelectedSegment("all")}
                    className="min-h-11 rounded-lg border border-[#d8e3de] bg-white px-3 text-xs font-bold text-[#1a382d]"
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
                        className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-[#fbfdfc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d8e3de] bg-[#edf8f3] font-black text-[#167052]">
                          {(member.name || "M").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#1a382d]">{member.name || "Member"}</span>
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
                  <Users className="mx-auto text-[#167052]" size={25} />
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
                  <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#db2777] bg-[#fce7f3] text-[#db2777]">
                        <Cake size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold text-[#db2777]">ULANG TAHUN</p>
                        <h3 className="text-sm font-extrabold text-[#1a382d]">{birthdayCandidates.length} member dalam {program.birthday_window_days} hari</h3>
                      </div>
                    </div>
                    <div className="mt-3 divide-y divide-[#dedee8] font-mono text-xs">
                      {birthdayCandidates.slice(0, 5).map((c) => (
                        <div key={c.customer_id} className="flex items-center justify-between py-1.5">
                          <span className="truncate font-sans font-bold text-[#1a382d]">{c.name || "Member"}</span>
                          <span className="shrink-0 text-[#5c5c70]">{c.days_until === 0 ? "Hari ini" : `${c.days_until} hari lagi`}</span>
                        </div>
                      ))}
                      {birthdayCandidates.length > 5 && <p className="pt-1.5 text-[#527867]">+{birthdayCandidates.length - 5} lainnya</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDateCampaign("birthday")}
                      disabled={campaignBusy}
                      className="mt-3 w-full rounded-lg border border-[#d8e3de] bg-[#0b3d2e] py-2.5 text-xs font-black text-[#c8f53a] disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar ucapan ulang tahun"}
                    </button>
                  </div>
                )}

                {anniversaryCandidates.length > 0 && (
                  <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-[#edf8f3] text-[#167052]">
                        <CalendarHeart size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold text-[#167052]">ANNIVERSARY MEMBER</p>
                        <h3 className="text-sm font-extrabold text-[#1a382d]">{anniversaryCandidates.length} member dalam {program.birthday_window_days} hari</h3>
                      </div>
                    </div>
                    <div className="mt-3 divide-y divide-[#dedee8] font-mono text-xs">
                      {anniversaryCandidates.slice(0, 5).map((c) => (
                        <div key={c.customer_id} className="flex items-center justify-between py-1.5">
                          <span className="truncate font-sans font-bold text-[#1a382d]">{c.name || "Member"}</span>
                          <span className="shrink-0 text-[#5c5c70]">{c.days_until === 0 ? "Hari ini" : `${c.days_until} hari lagi`}</span>
                        </div>
                      ))}
                      {anniversaryCandidates.length > 5 && <p className="pt-1.5 text-[#527867]">+{anniversaryCandidates.length - 5} lainnya</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDateCampaign("anniversary")}
                      disabled={campaignBusy}
                      className="mt-3 w-full rounded-lg border border-[#d8e3de] bg-white py-2.5 text-xs font-black text-[#1a382d] disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar ucapan anniversary"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {sessionRole === "owner" && (
              <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-[#edf8f3] text-[#167052]">
                    <Tag size={15} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold text-[#167052]">TEMPLATE & KODE PROMO</p>
                    <h3 className="text-sm font-extrabold text-[#1a382d]">Pilih tujuan, KAEL siapkan kode pelacaknya</h3>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5c5c70]">Kode unik tertanam otomatis di pesan. Kasir memasukkannya di kasir saat pelanggan datang — dari situ KAEL tahu campaign ini benar-benar dipakai, bukan cuma dibaca.</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAMPAIGN_GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => handleSelectGoal(g.key)}
                      className={`rounded-xl border-2 p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                        campaignGoalKey === g.key ? "border-[#d8e3de] bg-[#0b3d2e] text-white" : "border-[#d8e3de] bg-white text-[#1a382d] hover:border-emerald-300"
                      }`}
                    >
                      <span className="block text-xs font-black">{g.name}</span>
                      <span className={`mt-0.5 block text-[10px] leading-4 ${campaignGoalKey === g.key ? "text-[#dedee8]" : "text-[#527867]"}`}>{g.description}</span>
                    </button>
                  ))}
                </div>

                {selectedGoal && (
                  <div className="mt-4 space-y-3 border-t border-[#d8e3de] pt-4">
                    <div>
                      <label className="block font-mono text-xs font-bold text-[#1a382d]">Nama ajakan</label>
                      <input
                        value={goalCampaignName}
                        onChange={(e) => setGoalCampaignName(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-sm font-semibold text-[#1a382d]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs font-bold text-[#1a382d]">Pesan (edit sesuai gaya tokomu)</label>
                      <textarea
                        value={goalMessageTemplate}
                        onChange={(e) => setGoalMessageTemplate(e.target.value.slice(0, 2000))}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-[#d8e3de] p-2.5 text-xs text-[#1a382d]"
                      />
                      <p className="mt-1 text-[10px] text-[#527867]">{"{{nama}} {{kode}} {{toko}}"} otomatis diisi per pelanggan saat dibagikan.</p>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="w-32 shrink-0">
                        <label className="block font-mono text-xs font-bold text-[#1a382d]">Bonus poin / kode</label>
                        <input
                          type="number"
                          min={0}
                          value={goalRewardPoints}
                          onChange={(e) => setGoalRewardPoints(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-black text-[#1a382d]"
                        />
                      </div>
                      <p className="text-[10px] text-[#527867]">Isi 0 kalau kodenya cuma buat melacak diskon manual di kasir, bukan poin loyalty.</p>
                    </div>
                    <p className="text-xs text-[#5c5c70]">Target: <strong className="text-[#1a382d]">{goalTargetMembers.length} member</strong> yang cocok dengan tujuan ini dan sudah setuju menerima promo.</p>
                    <button
                      type="button"
                      onClick={() => void handleCreateGoalCampaign()}
                      disabled={!goalTargetMembers.length || campaignBusy}
                      className="w-full rounded-lg border border-[#d8e3de] bg-[#c8f53a] py-2.5 text-xs font-black text-[#1a382d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {campaignBusy ? "Membuat daftar..." : "Buat daftar + cetak kode promo"}
                    </button>
                  </div>
                )}
              </div>
            )}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-[#0b3d2e] p-4 text-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6">
              <span className="font-mono text-[10px] font-bold text-[#c8f53a]">AJAKAN KEMBALI</span>
              <h3 className="mt-1 text-lg font-black">Buat daftar chat yang bisa dilacak</h3>
              <p className="mt-2 text-sm leading-5 text-[#dedee8]">Pilih kelompok member, buat daftar, lalu buka WhatsApp satu per satu. KAEL hanya memasukkan member yang sudah setuju menerima promo.</p>

              {sessionRole === "owner" ? (
                <div className="mt-5 space-y-3 border-t border-white/20 pt-4">
                  <label className="block text-xs font-bold text-[#c8f53a]" htmlFor="campaign-name">Nama ajakan</label>
                  <input id="campaign-name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder={`Contoh: Ajakan ${MEMBER_SEGMENT_COPY[campaignSegment].label.toLowerCase()}`} className="min-h-11 w-full rounded-lg border border-white/30 bg-white px-3 text-sm font-semibold text-[#1a382d] placeholder:text-[#527867]" />
                  <p className="text-xs leading-5 text-[#dedee8]">Target: {campaignMembers.length} member {MEMBER_SEGMENT_COPY[campaignSegment].label.toLowerCase()} yang setuju menerima promo.</p>
                  <button type="button" onClick={handleCreateCampaign} disabled={!campaignMembers.length || campaignBusy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#c8f53a] bg-[#c8f53a] px-3 text-xs font-black text-[#1a382d] disabled:cursor-not-allowed disabled:opacity-50">
                    <Plus size={15} />
                    {campaignBusy ? "Membuat daftar..." : "Buat daftar ajakan"}
                  </button>
                </div>
              ) : (
                <div className="mt-5 border-t border-white/20 pt-4 text-xs leading-5 text-[#dedee8]">Daftar dan riwayat ajakan hanya dapat dikelola pemilik usaha.</div>
              )}
            </div>

            <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6">
              <div className="flex flex-col gap-2 border-b border-[#d8e3de] pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold text-[#167052]">CAMPAIGN TERBARU</p>
                  <h3 className="mt-0.5 text-sm font-extrabold">{currentCampaign?.name || "Belum ada daftar ajakan"}</h3>
                  {currentCampaign?.code && (
                    <p className="mt-0.5 font-mono text-[11px] text-[#167052]">
                      Kode <strong className="tracking-wider">{currentCampaign.code}</strong> · dipakai {currentCampaign.code_used_count}x
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("segments")}
                  className="min-h-11 rounded-lg border border-[#d8e3de] bg-white px-3 text-xs font-bold text-[#1a382d]"
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
                        <a href={buildSavedCampaignWhatsAppLink(member)} target="_blank" rel="noreferrer" onClick={() => { void handleCampaignRecipientStatus(member.id, "opened"); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8e3de] bg-[#c8f53a] px-3 text-xs font-bold text-[#1a382d]"><MessageCircle size={15} />Buka WA</a>
                        <button type="button" onClick={() => { void handleCampaignRecipientStatus(member.id, "sent"); }} className="min-h-11 rounded-lg border border-[#d8e3de] bg-white px-3 text-xs font-bold text-[#1a382d]">Tandai terkirim</button>
                      </div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto text-[#167052]" size={25} />
                  <p className="mt-3 text-sm font-bold">Belum ada daftar ajakan</p>
                  <p className="mt-1 text-xs text-[#5c5c70]">Pilih kelompok, lalu buat daftar agar setiap chat dan hasilnya bisa ditinjau.</p>
                </div>
              )}
            </div>

            {sessionRole === "owner" && <div className="lg:col-span-2 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4">
              <div className="flex items-baseline justify-between gap-3"><div><p className="font-mono text-[10px] font-bold text-[#167052]">RIWAYAT CAMPAIGN</p><h3 className="mt-0.5 text-sm font-extrabold">Yang sudah pernah dibuat</h3></div><span className="text-xs text-[#5c5c70]">Maks. 20 terbaru</span></div>
              {campaigns.length ? <div className="mt-3 divide-y divide-[#dedee8]">{campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><button type="button" onClick={() => { void handleSelectCampaign(campaign); }} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold">{campaign.name}</p><p className="mt-0.5 text-xs text-[#5c5c70]">{campaign.recipient_count} target · {campaign.opened_count} chat dibuka · {campaign.sent_count} ditandai terkirim · {campaign.returned_count} kembali belanja{campaign.code ? ` · kode dipakai ${campaign.code_used_count}x` : ""}</p></button><button type="button" onClick={() => { void handleSelectCampaign(campaign); }} disabled={campaignBusy} className="min-h-10 rounded-lg border border-[#d8e3de] bg-white px-3 text-xs font-bold text-[#1a382d] disabled:opacity-50">{currentCampaign?.id === campaign.id ? "Sedang dibuka" : "Buka"}</button></div>)}</div> : <p className="mt-3 text-xs text-[#5c5c70]">Belum ada riwayat.</p>}
              <p className="mt-3 text-[11px] leading-4 text-[#527867]">"Kembali belanja" berarti ada transaksi setelah daftar dibuat — sinyal lunak, bisa jadi sebab lain. "Kode dipakai" adalah bukti nyata: diketik langsung di kasir.</p>
            </div>}
          </section>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: KATALOG REWARD & PROTEKSI BIAYA OWNER */}
        {/* ============================================================= */}
        {activeTab === "rewards" && (
          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8e3de] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                  Katalog Hadiah &amp; Proteksi Margin Biaya ({rewards.length} Reward)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#527867]">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-[#c8f53a] px-3 py-1.5 font-mono text-xs font-bold text-[#073829] shadow-xs"
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
                  <div key={rw.id} className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#0b3d2e] font-sans truncate">{rw.name}</h4>
                        <span className="text-[10px] text-[#527867]">Nilai Jual: {formatRupiah(rw.market_value)}</span>
                      </div>
                      <span className="rounded-xl border border-emerald-300 bg-[#edf8f3] px-2 py-0.5 font-black text-xs text-[#167052] shrink-0">
                        {rw.point_cost} Pts
                      </span>
                    </div>

                    {/* Cost Protection Analysis */}
                    <div className="rounded-xl bg-white p-2.5 border border-[#d8e3de] space-y-1 text-[10.5px]">
                      <div className="flex justify-between">
                        <span className="text-[#527867]">Syarat Belanja:</span>
                        <span className="font-bold text-[#1a382d]">{formatRupiah(analysis.requiredSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#527867]">Diskon Efektif:</span>
                        <span className={`font-black ${analysis.isHighDiscount ? "text-[#d97706]" : "text-[#16a34a]"}`}>
                          {analysis.discountRatePct.toFixed(1)}% {analysis.isHighDiscount ? "⚠️" : "✓"}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1 border-t border-[#d8e3de]">
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(rw.id, rw.name)}
                        className="rounded-lg border border-[#d8e3de] bg-white p-1 text-[#527867] hover:text-[#ef4444]"
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
          <form onSubmit={handleSaveProgramSettings} className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-5">
            
            <div className="border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                Pengaturan Program Loyalitas Toko
              </h3>
              <p className="text-[11px] sm:text-xs text-[#527867]">
                Pilih satu model: Mode Poin (belanja nominal rupiah) atau Mode Stamp (kunjungan).
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* Program Mode Selection */}
              <div className="space-y-2">
                <label className="block font-bold text-[#1a382d]">Model Program:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProgram({ ...program, mode: "point" })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      program.mode === "point"
                        ? "border-[#d8e3de] bg-[#0b3d2e] text-[#c8f53a]"
                        : "border-[#d8e3de] bg-white text-[#527867]"
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
                        ? "border-[#d8e3de] bg-[#0b3d2e] text-[#c8f53a]"
                        : "border-[#d8e3de] bg-white text-[#527867]"
                    }`}
                  >
                    <span className="font-black text-sm block">2. Mode Stamp</span>
                    <span className="text-[9.5px] opacity-80">Cocok kedai kopi &amp; barbershop</span>
                  </button>
                </div>
              </div>

              {/* Earn Rate / Kurs Poin */}
              <div className="space-y-1">
                <label className="block font-bold text-[#1a382d]">
                  Kurs Perolehan Poin (Rupiah per 1 Poin):
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[#527867] font-bold">Rp</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={program.earn_rate}
                    onChange={(e) => setProgram({ ...program, earn_rate: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                  />
                </div>
                <span className="text-[10px] text-[#527867]">
                  Misal Rp 10.000: Belanja Rp 85.000 mendapatkan 8 Poin.
                </span>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold text-[#1a382d]">Masa berlaku poin:</label>
                <select
                  value={program.point_expiry_months ?? "never"}
                  onChange={(e) => setProgram({ ...program, point_expiry_months: e.target.value === "never" ? null : Number(e.target.value) })}
                  className="min-h-11 w-full rounded-xl border border-[#d8e3de] bg-white p-2.5 font-bold text-[#1a382d]"
                >
                  <option value="never">Poin tidak kedaluwarsa</option>
                  <option value="3">3 bulan</option>
                  <option value="6">6 bulan</option>
                  <option value="12">12 bulan</option>
                  <option value="24">24 bulan</option>
                </select>
                <span className="text-[10px] text-[#527867]">Poin lama dicek dari transaksi paling awal. Owner selalu meninjau dan menerapkan penghapusan poinnya sendiri.</span>
              </div>

            </div>

            <div className="space-y-4 border-t border-[#d8e3de] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1a382d]">Program Referral</h4>
                  <p className="mt-0.5 text-[11px] text-[#527867]">Member ajak teman. Bonus pengajak cair saat temannya belanja pertama kali, bukan saat mendaftar — supaya tidak bisa dipanen dengan pendaftaran palsu.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.referral_is_active}
                    onChange={(e) => setProgram({ ...program, referral_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#0b3d2e]"
                  />
                  <span className="font-bold text-[#1a382d]">Aktif</span>
                </label>
              </div>

              {program.referral_is_active && (
                <div className="grid gap-4 font-mono text-xs sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Bonus untuk pengajak:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.referral_referrer_points}
                      onChange={(e) => setProgram({ ...program, referral_referrer_points: Number(e.target.value) })}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                    />
                    <span className="text-[10px] text-[#527867]">{program.mode === "stamp" ? "Stempel" : "Poin"} per teman yang berhasil belanja.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Bonus untuk teman baru:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.referral_referee_points}
                      onChange={(e) => setProgram({ ...program, referral_referee_points: Number(e.target.value) })}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                    />
                    <span className="text-[10px] text-[#527867]">{program.mode === "stamp" ? "Stempel" : "Poin"} ekstra di belanja pertamanya.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Batas pengajak / bulan:</label>
                    <input
                      type="number"
                      min={1}
                      value={program.referral_monthly_cap}
                      onChange={(e) => setProgram({ ...program, referral_monthly_cap: Number(e.target.value) })}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                    />
                    <span className="text-[10px] text-[#527867]">Maks. bonus pengajak yang cair per member per bulan.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t border-[#d8e3de] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1a382d]">Ulang Tahun & Anniversary</h4>
                  <p className="mt-0.5 text-[11px] text-[#527867]">KAEL menyiapkan daftar member yang berulang tahun untuk kamu kirimi ucapan. Bonus poin opsional — anniversary jadi member selalu tersedia sebagai ucapan tanpa bonus poin.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.birthday_is_active}
                    onChange={(e) => setProgram({ ...program, birthday_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#0b3d2e]"
                  />
                  <span className="font-bold text-[#1a382d]">Aktif</span>
                </label>
              </div>

              {program.birthday_is_active && (
                <div className="grid gap-4 font-mono text-xs sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Bonus poin ulang tahun:</label>
                    <input
                      type="number"
                      min={0}
                      value={program.birthday_bonus_points}
                      onChange={(e) => setProgram({ ...program, birthday_bonus_points: Number(e.target.value) })}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                    />
                    <span className="text-[10px] text-[#527867]">{program.mode === "stamp" ? "Stempel" : "Poin"}. Isi 0 untuk ucapan tanpa bonus.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Jendela deteksi (hari):</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={program.birthday_window_days}
                      onChange={(e) => setProgram({ ...program, birthday_window_days: Number(e.target.value) })}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 font-black text-sm text-[#1a382d]"
                    />
                    <span className="text-[10px] text-[#527867]">Dipakai bareng untuk ulang tahun & anniversary.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-[#d8e3de] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1a382d]">Level Member</h4>
                  <p className="mt-0.5 text-[11px] text-[#527867]">Basic, Silver, Gold — dihitung otomatis dari total belanja member, bukan disetel manual. Level naik cair sendiri, tidak pernah turun.</p>
                </div>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={program.tiers_is_active}
                    onChange={(e) => setProgram({ ...program, tiers_is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#0b3d2e]"
                  />
                  <span className="font-bold text-[#1a382d]">Aktif</span>
                </label>
              </div>

              {!program.tiers_is_active && customers.length < 200 && (
                <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 text-[11px] leading-5 text-[#5c5c70]">
                  Level lebih terasa manfaatnya di toko dengan banyak member — sekarang tokomu punya {customers.length} member. Boleh diaktifkan kapan saja, tapi jangan kaget kalau efeknya belum terasa selagi membernya masih sedikit.
                </div>
              )}

              {program.tiers_is_active && (
                <p className="text-[11px] text-[#5c5c70]">Atur daftar levelnya di bagian &ldquo;Kelola Level Member&rdquo; setelah pengaturan ini disimpan.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#d8e3de]">
              <button
                type="submit"
                className="rounded-xl bg-[#0b3d2e] px-6 py-2.5 font-mono text-xs font-black text-[#c8f53a] shadow-xs"
              >
                Simpan Pengaturan Program ✓
              </button>
            </div>

          </form>
        )}

        {activeTab === "settings" && sessionRole === "owner" && program.tiers_is_active && (
          <section className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6">
            <div className="flex flex-col gap-3 border-b border-[#d8e3de] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#167052]">KELOLA LEVEL MEMBER</p>
                <h3 className="mt-0.5 text-sm font-extrabold">{tiers.length} level tersedia</h3>
              </div>
              <button
                type="button"
                onClick={() => openTierModal()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-[#c8f53a] px-3 py-1.5 font-mono text-xs font-bold text-[#073829] shadow-xs"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Tambah Level</span>
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier) => (
                <div key={tier.id} className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4 space-y-2 shadow-xs font-mono text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Crown size={14} className="text-[#d97706]" />
                      <h4 className="font-black text-sm text-[#0b3d2e] font-sans">{tier.name}</h4>
                    </div>
                    <span className="shrink-0 rounded-lg border border-emerald-300 bg-[#edf8f3] px-2 py-0.5 font-black text-[#167052]">{Number(tier.earn_multiplier).toFixed(2)}x</span>
                  </div>
                  <p className="text-[11px] text-[#5c5c70]">Mulai dari total belanja {formatRupiah(tier.min_lifetime_spend)}</p>
                  {tier.benefit_note && <p className="text-[11px] italic text-[#1a382d]">&ldquo;{tier.benefit_note}&rdquo;</p>}
                  <div className="flex justify-end gap-1.5 pt-1.5 border-t border-[#d8e3de]">
                    <button type="button" onClick={() => openTierModal(tier)} className="rounded-lg border border-[#d8e3de] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1a382d] hover:border-emerald-300">Edit</button>
                    <button type="button" onClick={() => handleDeleteTier(tier.id, tier.name)} className="rounded-lg border border-[#d8e3de] bg-white px-2.5 py-1 text-[11px] font-bold text-[#527867] hover:border-[#ef4444] hover:text-[#ef4444]">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "settings" && sessionRole === "owner" && program.point_expiry_months && (
          <section className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4 shadow-xs sm:p-5">
            <div className="flex flex-col gap-3 border-b border-[#d8e3de] pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#167052]">PENGAWASAN POIN</p>
                <h3 className="mt-0.5 text-sm font-extrabold">Poin yang perlu ditinjau</h3>
                <p className="mt-1 text-xs leading-5 text-[#5c5c70]">Masa berlaku saat ini: {program.point_expiry_months} bulan. KAEL tidak menghapus poin tanpa tindakan owner.</p>
              </div>
              {expiryDue.length > 0 && <button type="button" onClick={handleExpireDuePoints} disabled={expiryBusy} className="min-h-11 shrink-0 rounded-lg border border-[#d8e3de] bg-[#c8f53a] px-3 text-xs font-black text-[#1a382d] disabled:opacity-50">{expiryBusy ? "Menerapkan..." : `Terapkan ${expiryDue.reduce((sum, item) => sum + item.points, 0)} poin`}</button>}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] p-3">
                <p className="text-xs font-black text-[#b91c1c]">Sudah jatuh tempo: {expiryDue.reduce((sum, item) => sum + item.points, 0)} poin</p>
                {expiryDue.length ? <div className="mt-2 divide-y divide-[#fecaca]">{expiryDue.slice(0, 5).map((item) => <Link key={item.customer_id} href={`/app/loyalty/member/${item.customer_id}`} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="truncate font-bold text-[#1a382d]">{item.name || "Member"}</span><span className="shrink-0 font-mono font-black text-[#b91c1c]">{item.points} Pts</span></Link>)}</div> : <p className="mt-2 text-xs text-[#5c5c70]">Belum ada poin yang jatuh tempo.</p>}
              </div>
              <div className="rounded-xl border border-[#fde68a] bg-[#fffdf3] p-3">
                <p className="text-xs font-black text-[#a16207]">Total dalam 30 hari: {expirySoon.reduce((sum, item) => sum + item.points, 0)} poin</p>
                {expirySoon.length ? <div className="mt-2 divide-y divide-[#fde68a]">{expirySoon.slice(0, 5).map((item) => <Link key={item.customer_id} href={`/app/loyalty/member/${item.customer_id}`} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="truncate font-bold text-[#1a382d]">{item.name || "Member"}</span><span className="shrink-0 font-mono font-black text-[#a16207]">{item.points} Pts</span></Link>)}</div> : <p className="mt-2 text-xs text-[#5c5c70]">Belum ada poin yang mendekati jatuh tempo.</p>}
              </div>
            </div>
          </section>
        )}

        {/* ============================================================= */}
        {/* TAB 5: AUDIT KASIR & ANTI-KECURANGAN */}
        {/* ============================================================= */}
        {activeTab === "audit" && (
          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
            
            <div className="border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                Audit Penerbitan Poin per Staf Kasir
              </h3>
              <p className="text-[11px] sm:text-xs text-[#527867]">
                Setiap baris ledger mencatat ID kasir yang bertugas untuk mendeteksi anomali penambahan poin.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 font-mono text-xs">
              {staffAudit.map((audit) => (
                <div key={audit.id} className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <h4 className="font-black text-sm text-[#0b3d2e] font-sans">{audit.name}</h4>
                    <span className="text-[10px] bg-[#dcfce7] text-[#16a34a] px-2 py-0.5 rounded font-bold">
                      {audit.total_entries} Transaksi
                    </span>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-[#d8e3de] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#527867]">Total Poin Diterbitkan:</span>
                      <span className="font-black text-[#167052]">{audit.points_issued} Pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#527867]">Penyesuaian Manual:</span>
                      <span className="font-bold text-[#c2410c]">{audit.manual_count} Pts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {activeTab === "audit" && (
          <div className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">

            <div className="border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                Poin Referral per Pengajak
              </h3>
              <p className="text-[11px] sm:text-xs text-[#527867]">
                Siapa mengajak berapa teman, dan berapa yang sampai belanja. Ini tidak mencegah kecurangan, cuma membuatnya terlihat.
              </p>
            </div>

            {referralReport.length ? (
              <div className="divide-y divide-[#dedee8] font-mono text-xs">
                {referralReport.map((row) => (
                  <div key={row.customer_id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/loyalty/member/${row.customer_id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-sans text-sm font-bold text-[#1a382d]">{row.name || "Member"}</span>
                      <span className="mt-0.5 block text-[10px] text-[#5c5c70]">Kode {row.code || "—"}</span>
                    </Link>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-[#1a382d]">{row.rewarded_count}/{row.referred_count} belanja</span>
                      <span className="mt-0.5 block text-[10px] font-black text-[#167052]">+{row.points_earned} Pts</span>
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
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in fade-in zoom-in duration-150 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-base text-[#0b3d2e] font-sans">
                {editingRewardId ? "Edit Reward" : "Buat Reward Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="text-[#527867] hover:text-[#1a382d] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="block font-mono font-bold text-[#1a382d]">Nama Hadiah / Traktiran:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gratis 1x Spanish Latte"
                  value={rewardName}
                  onChange={(e) => setRewardName(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-xs font-bold text-[#1a382d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Biaya Poin:</label>
                  <input
                    type="number"
                    min={1}
                    value={rewardPointCost}
                    onChange={(e) => setRewardPointCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Nilai Rupiah Menu (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={rewardMarketValue}
                    onChange={(e) => setRewardMarketValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                  />
                </div>
              </div>

              {/* Live Cost Protection Box */}
              <div className={`p-3 rounded-2xl border font-mono text-[10.5px] space-y-1 ${
                rewardDiscountAnalysis.isHighDiscount ? "bg-[#fff5f5] border-[#ef4444]" : "bg-[#edf8f3] border-emerald-300"
              }`}>
                <span className="font-bold text-[#1a382d] block">PROTEKSI BIAYA DISKON:</span>
                <p className="text-[#527867]">
                  Pelanggan harus belanja total <strong>{formatRupiah(rewardDiscountAnalysis.requiredSpend)}</strong> untuk dapat hadiah ini.
                </p>
                <div className="flex justify-between font-bold pt-1">
                  <span>Diskon Efektif:</span>
                  <span className={rewardDiscountAnalysis.isHighDiscount ? "text-[#ef4444]" : "text-[#16a34a]"}>
                    {rewardDiscountAnalysis.discountRatePct.toFixed(1)}% {rewardDiscountAnalysis.isHighDiscount ? "(Waspada: Terlalu Besar!)" : "(Sehat ✓)"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d8e3de] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowRewardModal(false)}
                  className="rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0b3d2e] px-4 py-1.5 font-bold text-[#c8f53a]"
                >
                  Simpan Hadiah ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTierModal && (
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in fade-in zoom-in duration-150 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-base text-[#0b3d2e] font-sans">
                {editingTierId ? "Edit Level" : "Tambah Level Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="text-[#527867] hover:text-[#1a382d] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="block font-mono font-bold text-[#1a382d]">Nama Level:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gold"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-xs font-bold text-[#1a382d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Syarat Total Belanja (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={tierMinSpend}
                    onChange={(e) => setTierMinSpend(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Pengali Poin:</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.25}
                    value={tierMultiplier}
                    onChange={(e) => setTierMultiplier(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#1a382d]">Catatan Manfaat (opsional):</label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Contoh: Prioritas antrean, hadiah ulang tahun ekstra"
                  value={tierBenefitNote}
                  onChange={(e) => setTierBenefitNote(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-xs font-bold text-[#1a382d]"
                />
              </div>

              <div className="rounded-2xl border border-emerald-300 bg-[#edf8f3] p-3 font-mono text-[10.5px] text-[#5c5c70]">
                Member di level ini dapat <strong className="text-[#1a382d]">{tierMultiplier.toFixed(2)}x</strong> {program.mode === "stamp" ? "stempel" : "poin"} setiap belanja, otomatis lewat kasir maupun QR order — tidak ada langkah tambahan.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d8e3de] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowTierModal(false)}
                  className="rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={tierBusy}
                  className="rounded-xl bg-[#0b3d2e] px-4 py-1.5 font-bold text-[#c8f53a] disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in fade-in font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <div>
                <h3 className="font-black text-base text-[#0b3d2e] font-sans">
                  Buku Ledger: {viewingCustomer.name}
                </h3>
                <span className="text-[11px] text-[#527867]">
                  Saldo: {viewingDetail?.balance ?? 0} Pts · {viewingCustomer.phone_masked}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="text-[#527867] hover:text-[#1a382d] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(viewingDetail?.ledger ?? []).map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl border border-[#d8e3de] bg-[#fbfdfc] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0b3d2e] font-sans block text-xs">{item.note}</span>
                    <span className="text-[10px] text-[#527867]">{formatBusinessDateTime(item.created_at)}</span>
                  </div>
                  <span className={`font-black text-sm ${item.delta > 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta} Pts
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#d8e3de]">
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
                className="rounded-xl bg-[#0b3d2e] text-white px-4 py-1.5 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ============================================================= */}
      {/* MODAL: DIRECT PERSONAL MEMBER NOTIFICATION (WHATSAPP SENDER)  */}
      {/* ============================================================= */}
      {notifTargetCustomer && (
        <div className="fixed inset-0 z-50 bg-emerald-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in font-sans">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf8f3] text-[#167052]">
                  <MessageCircle size={18} />
                </span>
                <div>
                  <h3 className="font-black text-base text-[#0b3d2e]">
                    Kirim Pesan ke {notifTargetCustomer.name || "Member"}
                  </h3>
                  <p className="text-[11px] font-mono text-[#527867]">
                    WhatsApp: {notifTargetCustomer.phone_masked} · Saldo: {notifTargetCustomer.balance} Pts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifTargetCustomer(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078] hover:text-[#1a382d]"
              >
                ✕
              </button>
            </div>

            {/* Template Selector Tabs */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block font-bold text-[#1a382d]">Pilih Jenis Notifikasi / Template:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setNotifTemplateType("voucher")}
                  className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all ${
                    notifTemplateType === "voucher"
                      ? "border-[#167052] bg-[#0b3d2e] text-[#c8f53a]"
                      : "border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]"
                  }`}
                >
                  🎁 Voucher Poin
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTemplateType("event")}
                  className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all ${
                    notifTemplateType === "event"
                      ? "border-[#167052] bg-[#0b3d2e] text-[#c8f53a]"
                      : "border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]"
                  }`}
                >
                  📅 Undangan Event
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTemplateType("birthday")}
                  className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all ${
                    notifTemplateType === "birthday"
                      ? "border-[#167052] bg-[#0b3d2e] text-[#c8f53a]"
                      : "border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]"
                  }`}
                >
                  🎂 Ulang Tahun
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTemplateType("reengage")}
                  className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all ${
                    notifTemplateType === "reengage"
                      ? "border-[#167052] bg-[#0b3d2e] text-[#c8f53a]"
                      : "border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]"
                  }`}
                >
                  ☕ Ajakan Mampir
                </button>
              </div>
            </div>

            {/* Live Editable Message Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <label className="font-bold text-[#1a382d]">Isi Pesan WhatsApp (Bisa diedit):</label>
                <span className="text-[10px] text-[#527867]">Link kartu member tertanam otomatis</span>
              </div>
              <textarea
                value={notifTemplateType === "custom" ? notifCustomText : activeNotifMessage}
                onChange={(e) => {
                  setNotifTemplateType("custom");
                  setNotifCustomText(e.target.value);
                }}
                rows={5}
                className="w-full rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-3 text-xs leading-relaxed text-[#1a382d] focus:border-[#167052] focus:outline-hidden font-sans"
              />
            </div>

            {/* Launch WhatsApp CTA */}
            <div className="space-y-2 pt-1 border-t border-[#d8e3de]">
              {(() => {
                const cleanPhone = (notifTargetCustomer.phone || "").replace(/\D/g, "");
                const waUrl = cleanPhone
                  ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(activeNotifMessage)}`
                  : `https://wa.me/?text=${encodeURIComponent(activeNotifMessage)}`;

                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] px-4 py-3 text-sm font-black text-white shadow-sm transition-all active:scale-95 text-center font-sans tracking-tight"
                  >
                    <MessageCircle size={18} />
                    <span>Buka WhatsApp &amp; Kirim Pesan ke Member</span>
                  </a>
                );
              })()}

              <p className="text-center text-[10.5px] text-[#718078] font-mono">
                Pesan akan langsung terbuka di aplikasi WhatsApp / WhatsApp Web Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#d8e3de] bg-white py-4 text-center text-xs font-mono text-[#527867]">
        KAEL Loyalty Engine · Immutable Append-Only Ledger &amp; UU PDP Protection
      </footer>

      {/* Member QR Code & Tent Card Modal */}
      <MemberQrModal
        isOpen={showMemberQrModal}
        onClose={() => setShowMemberQrModal(false)}
        businessName={business?.name}
        storeCode={business?.store_code}
        logoUrl={business?.logo_url}
        isMochi={isMochi}
        earnRate={program.earn_rate}
      />

    </div>
  );
}

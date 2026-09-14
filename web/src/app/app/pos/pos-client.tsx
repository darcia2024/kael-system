"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Receipt, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowLeft, 
  Share2, 
  Printer, 
  QrCode, 
  Clock, 
  CreditCard, 
  DollarSign, 
  Coffee, 
  Utensils, 
  Percent, 
  FileText, 
  RotateCcw, 
  ExternalLink, 
  Sparkles, 
  Sliders, 
  Users, 
  ShieldCheck,
  TrendingUp,
  UtensilsCrossed,
  UserPlus,
  RefreshCw,
  MonitorSmartphone,
  ChefHat,
  LayoutGrid,
  CupSoda,
  Soup,
  Package,
  X,
  Camera,
  Bell,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import type { 
  MenuItem, 
  Category, 
  Business, 
  User, 
  CustomerDirectoryEntry,
  Shift,
  Order,
  OrderItem,
  LoyaltyProgram
} from "@/lib/types";
import { 
  createOrderAction,
  openShiftAction,
  closeShiftAction,
  updateOrderStatusAction,
  searchCustomersAction,
  lookupMemberAction,
  registerCustomerByStaffAction,
  recordReceiptPrintAction,
  getPendingQrOrdersAction,
} from "@/lib/actions";
import { 
  calculateCartTotals, 
  calculateCashChange, 
  generateEscPosReceiptText,
  generateKitchenTicketText,
  generateThreePlyReceiptText,
  SERVICE_TYPES,
  serviceTypeLabel,
  PAYMENT_STATUS_LABEL,
  FULFILLMENT_FLOW,
  type ServiceType,
} from "@/lib/pos-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import QrisPayment from "./qris-payment";
import OrderQueue from "./order-queue";
import { calculateEarnedPoints } from "@/lib/loyalty-engine";
import { PLACEHOLDER_MENU } from "@/lib/types";
import TableQrModal from "./table-qr-modal";
import PosMemberScannerModal from "./pos-member-scanner-modal";
import PosBellSettingsModal from "./pos-bell-settings-modal";
import { usePwaInstall } from "@/components/pwa-register";
import { alertNewIncomingOrder, buildPrinterBuzzerPayload } from "@/lib/pos-audio";

function getPosCategoryIcon(categoryName: string): LucideIcon {
  const normalized = categoryName.toLowerCase();
  if (normalized.includes("coffee") || normalized.includes("kopi")) return Coffee;
  if (normalized.includes("mie") || normalized.includes("sup") || normalized.includes("berkuah")) return Soup;
  if (normalized.includes("cemilan") || normalized.includes("snack") || normalized.includes("tambahan")) return Package;
  if (
    normalized.includes("minuman") ||
    normalized.includes("dalgona") ||
    normalized.includes("mojito") ||
    normalized.includes("milkshake") ||
    normalized.includes("float") ||
    normalized.includes("jus")
  ) {
    return CupSoda;
  }
  return UtensilsCrossed;
}

interface PosClientProps {
  business: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
  activeShift: Shift | null;
  pendingQrOrders: (Order & { items: OrderItem[] })[];
  staffList: { id: string; name: string }[];
  currentUserId: string;
  /** Pemasangan QRIS hanya untuk pemilik usaha: ini menentukan ke rekening siapa uang masuk. */
  userRole: "owner" | "staff";
  /** NULL kalau toko ini belum menyiapkan program loyalty. */
  loyaltyProgram: LoyaltyProgram | null;
  taxRatePct: number;
  serviceChargePct: number;
  themeClassName?: string;
  isMochi?: boolean;
}

export default function PosClient({
  business,
  categories,
  menuItems,
  activeShift,
  pendingQrOrders,
  staffList,
  currentUserId,
  userRole,
  loyaltyProgram,
  taxRatePct: configuredTaxRate,
  serviceChargePct: configuredServiceRate,
  themeClassName = "",
  isMochi = false,
}: PosClientProps) {
  const isMochiPos = isMochi || Boolean(business?.name?.toLowerCase().includes("mochi")) || themeClassName.includes("mochi-ui");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentUserId || staffList[0]?.id || "");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [showMobileCart, setShowMobileCart] = useState(false);
  // Cart State
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number; note: string }>>({});
  const [discountNominal, setDiscountNominal] = useState<number>(0);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "transfer">("cash");
  const [cashGivenInput, setCashGivenInput] = useState<number>(0);
  const [selectedTableNo, setSelectedTableNo] = useState<string>("");
  /**
   * Tipe layanan, bukan lagi "channel". Channel menjawab siapa yang membuat
   * pesanan, dan di layar ini jawabannya selalu kasir. Yang perlu dipilih
   * kasir adalah cara penyajiannya.
   */
  const [serviceType, setServiceType] = useState<ServiceType>("takeaway");

  // Pengantaran
  const [kirimNama, setKirimNama] = useState("");
  const [kirimHp, setKirimHp] = useState("");
  const [kirimAlamat, setKirimAlamat] = useState("");
  const [kirimOngkir, setKirimOngkir] = useState<number>(0);
  const [kirimCatatan, setKirimCatatan] = useState("");

  // Loyalty Customer Integration in POS
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState("");

  // Pendaftaran member dari layar kasir.
  const [formMemberBaru, setFormMemberBaru] = useState(false);
  const [memberBaruNama, setMemberBaruNama] = useState("");
  const [memberBaruTelp, setMemberBaruTelp] = useState("");
  const [simpanMemberBaru, setSimpanMemberBaru] = useState(false);
  const [galatMemberBaru, setGalatMemberBaru] = useState<string | null>(null);
  const [loyaltySearchResults, setLoyaltySearchResults] = useState<CustomerDirectoryEntry[]>([]);
  const [attachedCustomer, setAttachedCustomer] = useState<CustomerDirectoryEntry | null>(null);

  // Post-Payment Completed Order
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    orderNo: string;
    total: number;
    change: number;
    paymentMethod: string;
    tableNo?: string | null;
    serviceType: ServiceType;
    cashierName: string;
    createdAt: string;
    subtotal: number;
    discount: number;
    tax: number;
    serviceCharge: number;
    deliveryFee: number;
    cashGiven?: number;
    customerName?: string | null;
    items: { name: string; qty: number; price: number; note?: string }[];
  } | null>(null);
  const [printerState, setPrinterState] = useState<"idle" | "printing" | "connected" | "error">("idle");

  // Shift Modal State
  const [showQueue, setShowQueue] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showTableQrModal, setShowTableQrModal] = useState(false);
  const [showMemberScannerModal, setShowMemberScannerModal] = useState(false);
  const [shiftOpeningCashInput, setShiftOpeningCashInput] = useState<number>(100000);
  const [shiftClosingCashInput, setShiftClosingCashInput] = useState<number>(0);

  // Live QR Orders & Bell Notification States
  const [currentQrOrders, setCurrentQrOrders] = useState(pendingQrOrders);
  const knownOrderIds = useRef(new Set(pendingQrOrders.map((o) => o.id)));

  const [showBellModal, setShowBellModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [printerBuzzerEnabled, setPrinterBuzzerEnabled] = useState(false);
  const [autoPrintThreePly, setAutoPrintThreePly] = useState(true);
  const [staffWhatsapp, setStaffWhatsapp] = useState(business?.phone || "");
  const [incomingToast, setIncomingToast] = useState<{
    orderNo: string;
    tableNo: string;
    total: number;
    count: number;
  } | null>(null);

  // PWA Install Prompt State
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();

  // Sync props to state if props change
  useEffect(() => {
    setCurrentQrOrders(pendingQrOrders);
    pendingQrOrders.forEach((o) => knownOrderIds.current.add(o.id));
  }, [pendingQrOrders]);

  // Load bell preferences & auto-print from localStorage on mount
  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("kael_pos_bell_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      const savedVoice = localStorage.getItem("kael_pos_voice_enabled");
      if (savedVoice !== null) setVoiceEnabled(savedVoice === "true");

      const savedBuzzer = localStorage.getItem("kael_pos_printer_buzzer");
      if (savedBuzzer !== null) setPrinterBuzzerEnabled(savedBuzzer === "true");

      const savedAutoPrint = localStorage.getItem("kael_pos_autoprint_3ply");
      if (savedAutoPrint !== null) setAutoPrintThreePly(savedAutoPrint === "true");

      const savedWa = localStorage.getItem("kael_pos_wa_staff");
      if (savedWa) setStaffWhatsapp(savedWa);
    } catch {}
  }, []);

  const handleToggleAutoPrintThreePly = (val: boolean) => {
    setAutoPrintThreePly(val);
    try { localStorage.setItem("kael_pos_autoprint_3ply", String(val)); } catch {}
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    try { localStorage.setItem("kael_pos_bell_enabled", String(val)); } catch {}
  };

  const handleToggleVoice = (val: boolean) => {
    setVoiceEnabled(val);
    try { localStorage.setItem("kael_pos_voice_enabled", String(val)); } catch {}
  };

  const handleTogglePrinterBuzzer = (val: boolean) => {
    setPrinterBuzzerEnabled(val);
    try { localStorage.setItem("kael_pos_printer_buzzer", String(val)); } catch {}
  };

  const handleSaveStaffWhatsapp = (val: string) => {
    setStaffWhatsapp(val);
    try { localStorage.setItem("kael_pos_wa_staff", val); } catch {}
  };

  // Background live polling every 7 seconds for QR orders
  useEffect(() => {
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await getPendingQrOrdersAction();
        if (res.ok && res.data.orders) {
          const freshOrders = res.data.orders;
          const incoming = freshOrders.filter((o) => !knownOrderIds.current.has(o.id));
          
          if (incoming.length > 0) {
            const latest = incoming[0];
            setIncomingToast({
              orderNo: latest.order_no,
              tableNo: latest.table_no || "?",
              total: Number(latest.total),
              count: incoming.length,
            });

            if (soundEnabled) {
              alertNewIncomingOrder({
                tableNo: latest.table_no,
                total: Number(latest.total),
                withVoice: voiceEnabled,
              });
            }
          }

          freshOrders.forEach((o) => knownOrderIds.current.add(o.id));
          setCurrentQrOrders(freshOrders);
        }
      } catch {
        // network polling failure ignored
      }
    }, 7000);

    return () => window.clearInterval(pollInterval);
  }, [soundEnabled, voiceEnabled]);

  const handleQuickSearchOrScan = async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    const res = await lookupMemberAction(clean);
    if (res.ok && res.data.found && res.data.customer) {
      setAttachedCustomer(res.data.customer);
      setLoyaltySearchQuery("");
      setLoyaltySearchResults([]);
    } else if (res.ok && res.data.matches.length > 0) {
      setLoyaltySearchResults(res.data.matches);
    }
  };

  const refreshAll = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Cart Calculations
  const cartList = Object.values(cart);
  const cartTotals = useMemo(() => {
    return calculateCartTotals(
      cartList.map((c) => ({ price: c.item.price, qty: c.qty })),
      discountNominal,
      configuredTaxRate,
      configuredServiceRate
    );
  }, [cartList, discountNominal, configuredTaxRate, configuredServiceRate]);

  const checkoutTotal = cartTotals.total + (serviceType === "delivery" ? Math.max(0, kirimOngkir) : 0);

  useEffect(() => {
    if (!showMobileCart) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileCart]);

  useEffect(() => {
    if (cartList.length === 0 && showMobileCart) setShowMobileCart(false);
  }, [cartList.length, showMobileCart]);

  // Cash Change Calculation
  const cashChangeCalc = useMemo(() => {
    return calculateCashChange(checkoutTotal, cashGivenInput);
  }, [checkoutTotal, cashGivenInput]);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    const normalizedSearch = menuSearchQuery.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (activeCategory !== "all" && m.category_id !== activeCategory) return false;
      if (!normalizedSearch) return true;
      return `${m.name} ${m.description ?? ""}`.toLowerCase().includes(normalizedSearch);
    });
  }, [menuItems, activeCategory, menuSearchQuery]);

  // Search Loyalty Customers via Server Action
  useEffect(() => {
    if (!loyaltySearchQuery.trim()) {
      setLoyaltySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await searchCustomersAction(loyaltySearchQuery);
      setLoyaltySearchResults(res);
    }, 200);
    return () => clearTimeout(timer);
  }, [loyaltySearchQuery]);

  // ---------------------------------------------------------------------------
  // CART ACTIONS
  // ---------------------------------------------------------------------------
  const handleAddToCart = (item: MenuItem) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return { ...prev, [item.id]: { ...existing, qty: existing.qty + 1 } };
      }
      return { ...prev, [item.id]: { item, qty: 1, note: "" } };
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: { ...existing, qty: nextQty } };
    });
  };

  const handleUpdateNote = (itemId: string, note: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return { ...prev, [itemId]: { ...existing, note } };
    });
  };

  const handleClearCart = () => {
    if (confirm("Kosongkan seluruh keranjang kasir?")) {
      setCart({});
      setDiscountNominal(0);
      setAttachedCustomer(null);
      setShowMobileCart(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CHECKOUT & PAYMENT PROCESSING
  // ---------------------------------------------------------------------------
  const handleOpenPayment = () => {
    if (cartList.length === 0) return;
    setCashGivenInput(checkoutTotal);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartList.length === 0) return;

    if (paymentMethod === "cash" && !cashChangeCalc.isSufficient) {
      alert("Uang tunai yang diterima kurang dari total tagihan.");
      return;
    }

    const itemsPayload = cartList.map((c) => ({
      menu_item_id: c.item.id,
      qty: c.qty,
      note: c.note || undefined,
    }));

    const res = await createOrderAction({
      service_type: serviceType,
      table_no: selectedTableNo || null,
      payment_method: paymentMethod,
      delivery:
        serviceType === "delivery"
          ? {
              name: kirimNama,
              phone: kirimHp,
              address: kirimAlamat,
              fee: kirimOngkir,
              note: kirimCatatan || undefined,
            }
          : null,
      discount: cartTotals.discount,
      cash_given: paymentMethod === "cash" ? cashGivenInput : null,
      customer_id: attachedCustomer?.id || null,
      items: itemsPayload,
    });

    if (!res.ok) {
      alert(res.error);
      return;
    }

    const completed = {
      orderId: res.data.orderId,
      orderNo: res.data.orderNo,
      total: res.data.total,
      change: res.data.change,
      paymentMethod,
      tableNo: selectedTableNo || null,
      serviceType,
      cashierName: staffList.find((staff) => staff.id === selectedStaffId)?.name || "Kasir",
      createdAt: new Date().toISOString(),
      subtotal: res.data.subtotal,
      discount: res.data.discount,
      tax: res.data.tax,
      serviceCharge: res.data.serviceCharge,
      deliveryFee: res.data.deliveryFee,
      cashGiven: paymentMethod === "cash" ? cashGivenInput : undefined,
      customerName: attachedCustomer?.name,
      items: cartList.map((c) => ({
        name: c.item.name,
        qty: c.qty,
        price: c.item.price,
        note: c.note,
      })),
    };

    setShowPaymentModal(false);
    setShowMobileCart(false);
    setCart({});
    setDiscountNominal(0);
    setAttachedCustomer(null);
    setCompletedOrder(completed);
    refreshAll();

    // Otomatis cetak 3 rangkap jika preferensi auto-print aktif
    if (autoPrintThreePly) {
      setTimeout(() => {
        void handlePrintThreePlyBluetooth({
          order_no: completed.orderNo,
          table_no: completed.tableNo,
          service_type: completed.serviceType,
          created_at: completed.createdAt,
          items: completed.items.map((i) => ({
            name_snapshot: i.name,
            qty: i.qty,
            unit_price_snapshot: i.price,
            subtotal: i.price * i.qty,
            note: i.note,
          })),
          total: completed.total,
          payment_method: completed.paymentMethod,
          customer_name: completed.customerName,
        });
      }, 250);
    }
  };

  // Accept incoming QR order

  // ---------------------------------------------------------------------------
  // SHIFT MANAGEMENT
  // ---------------------------------------------------------------------------
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await openShiftAction(shiftOpeningCashInput, "Shift Kasir");
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setShowShiftModal(false);
    refreshAll();
    alert(`Shift baru dibuka dengan modal awal ${formatRupiah(shiftOpeningCashInput)}.`);
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const res = await closeShiftAction(activeShift.id, shiftClosingCashInput, "Tutup Shift");
    if (!res.ok) {
      alert(res.error);
      return;
    }

    setShowShiftModal(false);
    refreshAll();
    const variance = res.data.variance;
    alert(
      `Shift selesai ditutup!\n` +
      `Selisih Laci: ${formatRupiah(variance)} (${variance === 0 ? "PAS ✓" : variance > 0 ? "LEBIH" : "KURANG"})`
    );
  };

  // Web Bluetooth Thermal ESC/POS Trigger.
  // Mendukung cetak struk belanja pelanggan dan tiket dapur/barista (Kitchen Slip)
  // ke printer thermal 58mm/80mm Bluetooth, atau fallback ke dialog cetak browser.
  const sendRawEscPosToBluetooth = async (
    rawText: string,
    options: {
      jobName: string;
      orderId?: string;
      orderNo?: string;
      openCashDrawer?: boolean;
      isCustomerReceipt?: boolean;
    }
  ) => {
    setPrinterState("printing");
    const bluetooth = (navigator as Navigator & { bluetooth?: any }).bluetooth;
    if (!bluetooth) {
      if (options.isCustomerReceipt && options.orderId) {
        window.open(`/receipt/${options.orderId}`, "_blank", "noopener,noreferrer");
      } else {
        const printWindow = window.open("", "_blank", "width=380,height=600");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>${options.jobName} #${options.orderNo || ""}</title>
                <style>
                  body { font-family: monospace; font-size: 13px; white-space: pre-wrap; padding: 20px; line-height: 1.3; }
                  @media print { body { padding: 0; } }
                </style>
              </head>
              <body>${rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
        }
      }
      setPrinterState("idle");
      return;
    }

    try {
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        ],
      });
      const server = await device.gatt?.connect();
      if (!server) throw new Error("Printer tidak dapat dihubungkan.");

      const service = await (async () => {
        for (const uuid of ["000018f0-0000-1000-8000-00805f9b34fb", "49535343-fe7d-4ae5-8fa9-9fafd205e455"]) {
          try { return await server.getPrimaryService(uuid); } catch { /* coba profil printer berikutnya */ }
        }
        throw new Error("Profil ESC/POS printer belum dikenali.");
      })();
      const characteristic = await (async () => {
        for (const uuid of ["00002af1-0000-1000-8000-00805f9b34fb", "49535343-8841-43f4-a8d4-ecbe34729bb3"]) {
          try { return await service.getCharacteristic(uuid); } catch { /* coba karakteristik berikutnya */ }
        }
        throw new Error("Jalur tulis printer belum dikenali.");
      })();

      const encoded = new TextEncoder().encode(rawText);
      const openCashDrawer = Boolean(options.openCashDrawer);
      const drawerPulse = openCashDrawer ? [0x1b, 0x70, 0x00, 0x19, 0xfa] : [];
      const buzzerPulse = printerBuzzerEnabled ? [0x1b, 0x42, 0x03, 0x02, 0x1b, 0x70, 0x01, 0x19, 0xfa] : [];
      const finish = [0x0a, 0x0a, 0x0a, ...drawerPulse, ...buzzerPulse, 0x1d, 0x56, 0x00];
      const payload = new Uint8Array(encoded.length + 2 + finish.length);
      payload.set([0x1b, 0x40], 0);
      payload.set(encoded, 2);
      payload.set(finish, encoded.length + 2);

      for (let offset = 0; offset < payload.length; offset += 180) {
        const chunk = payload.slice(offset, offset + 180);
        if (typeof characteristic.writeValueWithoutResponse === "function") {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
      }
      device.gatt?.disconnect();

      if (options.isCustomerReceipt && options.orderId) {
        const printLog = await recordReceiptPrintAction(
          options.orderId,
          openCashDrawer,
          device.name || "printer thermal",
        );
        setPrinterState(printLog.ok ? "connected" : "error");
      } else {
        setPrinterState("connected");
      }

      alert(
        `${options.jobName} #${options.orderNo || ""} terkirim ke ${device.name || "printer thermal"}.` +
        (openCashDrawer ? " Laci uang dibuka." : ""),
      );
    } catch (error) {
      setPrinterState("error");
      console.warn("[KAEL] cetak Bluetooth gagal", error);
      const useBrowserPrint = window.confirm(`Printer Bluetooth belum bisa menerima ${options.jobName.toLowerCase()}. Buka versi cetak di dialog browser?`);
      if (useBrowserPrint) {
        if (options.isCustomerReceipt && options.orderId) {
          window.open(`/receipt/${options.orderId}`, "_blank", "noopener,noreferrer");
        } else {
          const printWindow = window.open("", "_blank", "width=380,height=600");
          if (printWindow) {
            printWindow.document.write(`
              <html>
                <head>
                  <title>${options.jobName} #${options.orderNo || ""}</title>
                  <style>
                    body { font-family: monospace; font-size: 13px; white-space: pre-wrap; padding: 20px; line-height: 1.3; }
                    @media print { body { padding: 0; } }
                  </style>
                </head>
                <body>${rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
              </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
            }, 300);
          }
        }
      }
    }
  };

  const handlePrintBluetoothThermal = async () => {
    if (!completedOrder) return;
    const receiptText = generateEscPosReceiptText({
      businessName: business?.name || "KAEL POS",
      businessAddress: business?.address || "",
      businessPhone: business?.phone || "",
      orderNo: completedOrder.orderNo,
      tableNo: completedOrder.tableNo,
      serviceType: completedOrder.serviceType,
      cashierName: completedOrder.cashierName,
      createdAt: completedOrder.createdAt,
      items: completedOrder.items,
      subtotal: completedOrder.subtotal,
      discount: completedOrder.discount,
      tax: completedOrder.tax,
      serviceCharge: completedOrder.serviceCharge,
      deliveryFee: completedOrder.deliveryFee,
      total: completedOrder.total,
      paymentMethod: completedOrder.paymentMethod,
      cashGiven: completedOrder.cashGiven,
      cashChange: completedOrder.change || undefined,
      customerName: completedOrder.customerName,
    });

    await sendRawEscPosToBluetooth(receiptText, {
      jobName: "Struk Kasir",
      orderId: completedOrder.orderId,
      orderNo: completedOrder.orderNo,
      openCashDrawer: completedOrder.paymentMethod === "cash",
      isCustomerReceipt: true,
    });
  };

  const handlePrintKitchenTicketBluetooth = async () => {
    if (!completedOrder) return;
    const ticketText = generateKitchenTicketText({
      businessName: business?.name || "KAEL POS",
      orderNo: completedOrder.orderNo,
      tableNo: completedOrder.tableNo,
      serviceType: completedOrder.serviceType,
      createdAt: completedOrder.createdAt,
      items: completedOrder.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        note: i.note,
      })),
      cashierName: completedOrder.cashierName,
    });

    await sendRawEscPosToBluetooth(ticketText, {
      jobName: "Tiket Dapur",
      orderId: completedOrder.orderId,
      orderNo: completedOrder.orderNo,
      openCashDrawer: false,
      isCustomerReceipt: false,
    });
  };

  const handlePrintKitchenTicketFromQueue = async (order: {
    order_no: string;
    table_no?: string | null;
    service_type: string;
    created_at: string;
    items: { name_snapshot: string; qty: number; note?: string | null }[];
  }) => {
    const activeCashier = staffList.find((staff) => staff.id === selectedStaffId)?.name || "Kasir";
    const ticketText = generateKitchenTicketText({
      businessName: business?.name || "KAEL POS",
      orderNo: order.order_no,
      tableNo: order.table_no,
      serviceType: (order.service_type || "dine_in") as "dine_in" | "takeaway" | "delivery",
      createdAt: order.created_at,
      items: order.items.map((i) => ({
        name: i.name_snapshot,
        qty: i.qty,
        note: i.note || undefined,
      })),
      cashierName: activeCashier,
    });

    await sendRawEscPosToBluetooth(ticketText, {
      jobName: "Tiket Dapur",
      orderNo: order.order_no,
      openCashDrawer: false,
      isCustomerReceipt: false,
    });
  };

  const handlePrintThreePlyBluetooth = async (customOrder?: {
    order_no: string;
    table_no?: string | null;
    service_type: string;
    created_at: string;
    items: { name_snapshot: string; qty: number; unit_price_snapshot?: number; subtotal?: number; note?: string | null }[];
    total: number | string;
    payment_method: string;
    customer_name?: string | null;
  }) => {
    const orderData = customOrder || (completedOrder ? {
      order_no: completedOrder.orderNo,
      table_no: completedOrder.tableNo,
      service_type: completedOrder.serviceType,
      created_at: completedOrder.createdAt,
      items: completedOrder.items.map((i) => ({
        name_snapshot: i.name,
        qty: i.qty,
        unit_price_snapshot: i.price,
        subtotal: i.price * i.qty,
        note: i.note,
      })),
      total: completedOrder.total,
      payment_method: completedOrder.paymentMethod,
      customer_name: completedOrder.customerName,
    } : null);

    if (!orderData) return;

    const activeCashier = staffList.find((staff) => staff.id === selectedStaffId)?.name || (completedOrder?.cashierName || "Kasir");
    const numTotal = Number(orderData.total) || 0;

    const receiptText = generateThreePlyReceiptText({
      businessName: business?.name || "Mochi Cafe n Resto",
      businessAddress: business?.address || "",
      businessPhone: business?.phone || "",
      orderNo: orderData.order_no,
      tableNo: orderData.table_no,
      serviceType: (orderData.service_type || "dine_in") as "dine_in" | "takeaway" | "delivery",
      cashierName: activeCashier,
      createdAt: orderData.created_at,
      items: orderData.items.map((i) => ({
        name: i.name_snapshot,
        qty: i.qty,
        price: Number(i.unit_price_snapshot) || Math.round(Number(i.subtotal) / Math.max(1, i.qty)) || 0,
        note: i.note || undefined,
      })),
      subtotal: completedOrder ? completedOrder.subtotal : numTotal,
      discount: completedOrder ? completedOrder.discount : 0,
      tax: completedOrder ? completedOrder.tax : 0,
      serviceCharge: completedOrder ? completedOrder.serviceCharge : 0,
      deliveryFee: completedOrder ? completedOrder.deliveryFee : 0,
      total: numTotal,
      paymentMethod: orderData.payment_method || "tunai",
      cashGiven: completedOrder?.cashGiven,
      cashChange: completedOrder?.change,
      customerName: orderData.customer_name,
    });

    await sendRawEscPosToBluetooth(receiptText, {
      jobName: "Struk 3 Rangkap (Dapur + Kasir + Pelanggan)",
      orderNo: orderData.order_no,
      openCashDrawer: orderData.payment_method === "cash",
      isCustomerReceipt: true,
      orderId: completedOrder?.orderId,
    });
  };

  const renderInvoice = (showCloseButton: boolean) => (
    <section className="flex h-full min-h-0 flex-col bg-[#fbfdfc]">
      <div className="flex items-start justify-between border-b border-[#dfe6e2] px-4 py-3 bg-white">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#167052] animate-pulse" />
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#728078]">
              {isMochiPos ? "Menu Dipilih" : "Pesanan Dipilih"}
            </p>
          </div>
          <h2 className="mt-0.5 text-base sm:text-lg font-black text-[#17382e]">
            {isMochiPos ? "Daftar Pesanan" : "Rincian Transaksi"}
          </h2>
          <p className="text-xs font-semibold text-[#7a8781]">
            <strong className="text-[#0b3d2e] font-black font-mono">{cartList.reduce((sum, line) => sum + line.qty, 0)}</strong> item dalam pesanan
          </p>
        </div>
        <div className="flex items-center gap-1">
          {cartList.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-[#b34539] transition-colors hover:bg-[#fff0ed] border border-red-200/60"
            >
              <Trash2 size={14} aria-hidden="true" />
              Reset
            </button>
          )}
          {showCloseButton && (
            <button
              type="button"
              aria-label="Tutup rincian pesanan"
              onClick={() => setShowMobileCart(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d5ded9] text-[#5d6c65]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <fieldset className="border-b border-[#dfe6e2] px-3.5 py-2 bg-white">
        <legend className="sr-only">Tipe layanan</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {SERVICE_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => setServiceType(type.key)}
              className={`h-9 rounded-xl border px-1.5 py-1 text-center text-[11px] font-extrabold transition-all ${
                serviceType === type.key
                  ? (isMochiPos ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] font-black shadow-2xs" : "border-[#167052] bg-[#e4f4ed] text-[#15533e]")
                  : (isMochiPos ? "border-[#d8e3de] bg-white text-[#526159] hover:bg-[#edf8f3]" : "border-[#d6dfda] bg-white text-[#66746d] hover:border-[#9db8ab]")
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        {serviceType === "dine_in" && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#556b62] shrink-0 font-mono">No. Meja:</span>
            <input
              type="text"
              value={selectedTableNo}
              onChange={(e) => setSelectedTableNo(e.target.value)}
              placeholder="Contoh: 04, Meja 2"
              className={`flex-1 h-8 rounded-lg border px-2.5 text-xs font-mono font-bold ${
                isMochiPos
                  ? "border-[#ccd9d3] bg-[#edf8f3] text-[#0b3d2e] focus:border-[#167052] focus:bg-white"
                  : "border-[#ccd7d2] bg-white text-[#21352d]"
              } focus:outline-hidden`}
            />
          </div>
        )}
      </fieldset>

      {/* Member Loyalty Bar / Attacher */}
      <div className={`border-b px-3.5 py-2 ${isMochiPos ? "border-[#dfe6e2] bg-[#f8faf9]" : "border-[#e0ebe5] bg-[#f9fbfa]"}`}>
        {attachedCustomer ? (
          <div className="rounded-xl border border-[#16a34a]/40 bg-[#edfbf3] p-2 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0b3d2e] text-[#c8f53a] font-black text-xs shadow-xs">
                ★
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-black text-[#14532d]">{attachedCustomer.name}</span>
                  <span className="rounded bg-[#bbf7d0] px-1 py-0.2 text-[8.5px] font-black text-[#166534]">
                    MEMBER
                  </span>
                </div>
                <p className="text-[9.5px] font-mono text-[#166534] truncate">
                  {attachedCustomer.phone_masked} · <strong>{attachedCustomer.balance} Pts</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowMemberScannerModal(true)}
                title="Ganti / Scan Member Lain"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#bbf7d0] text-[#166534] hover:bg-[#dcfce7] transition-colors"
              >
                <RefreshCw size={11} />
              </button>
              <button
                type="button"
                onClick={() => setAttachedCustomer(null)}
                title="Lepas Member"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMemberScannerModal(true)}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-bold transition-all group ${
              isMochiPos
                ? "border-emerald-700/25 bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e1f5eb] hover:border-[#167052]"
                : "border-[#d6dfda] bg-white text-[#344d41] hover:border-[#167052]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0b3d2e] text-[#c8f53a] shadow-xs">
                <QrCode size={11} />
              </div>
              <span className="truncate text-left text-[11px] font-extrabold text-[#0b3d2e]">
                Scan QR / No. WA Member
              </span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-black text-[#167052] bg-white/80 border border-emerald-600/30 px-2 py-0.5 rounded-lg group-hover:bg-[#167052] group-hover:text-white transition-colors">
              <Camera size={11} />
              <span>Pindai</span>
            </span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-2.5">
        {cartList.length === 0 ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center px-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf8f3] text-[#167052] mb-3">
              <ShoppingCart size={28} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <p className="text-sm font-extrabold text-[#294239]">Belum ada menu dipilih</p>
            <p className="mt-1 max-w-56 text-xs leading-relaxed text-[#7b8882]">
              Sentuh atau klik foto menu pada katalog di sebelah kiri untuk langsung memasukkan ke daftar pesanan.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cartList.map(({ item, qty, note }) => {
              const hasPhoto = item.photo_url && item.photo_url !== PLACEHOLDER_MENU;
              const unitPrice = Number(item.price);
              const lineTotal = unitPrice * qty;
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#dce7e2] bg-white p-3 shadow-2xs transition-all hover:border-[#167052]/40 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eaf3ef] text-[#34745d] border border-emerald-900/10">
                      {hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo_url ?? undefined} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <UtensilsCrossed size={20} aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] sm:text-sm font-extrabold leading-snug text-[#20382d]">
                        {item.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-[11px] text-[#6b7b74]">
                          @{formatRupiah(unitPrice)}
                        </span>
                        <span className="text-[#9cb0a6]">·</span>
                        <span className={`font-mono text-xs font-black ${isMochiPos ? "text-[#0b3d2e]" : "text-[#9b5332]"}`}>
                          {formatRupiah(lineTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 bg-[#f4f8f6] p-1 rounded-xl border border-[#dbe6e1]">
                      <button
                        type="button"
                        aria-label={`Kurangi ${item.name}`}
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                          isMochiPos
                            ? "border-[#ccd9d3] bg-white text-[#167052] hover:bg-[#edf8f3]"
                            : "border-[#cbd8d2] bg-white text-[#355a4b]"
                        }`}
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span className="w-5 text-center text-xs font-black tabular-nums font-mono text-[#0b3d2e]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Tambah ${item.name}`}
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-white transition-all active:scale-95 ${
                          isMochiPos ? "bg-[#0b3d2e] hover:bg-[#124d3b]" : "bg-[#167052]"
                        }`}
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="pt-0.5">
                    <input
                      type="text"
                      value={note}
                      onChange={(event) => handleUpdateNote(item.id, event.target.value)}
                      placeholder="Catatan menu (e.g. less ice, pedas sedang)..."
                      className="h-8 w-full rounded-lg border border-dashed border-[#ccd9d2] bg-[#f8faf9] px-2.5 text-[11px] text-[#243d32] placeholder:text-[#889a91] outline-hidden focus:border-solid focus:border-[#167052] focus:bg-white focus:ring-1 focus:ring-[#167052]/20 transition-all"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2.5 border-t border-[#dfe6e2] bg-[#f8faf9] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#5c6c64]">Diskon Cepat</span>
          <div className="grid grid-cols-4 gap-1 flex-1 max-w-[220px]">
            {[0, 5000, 10000, 15000].map((discount) => (
              <button
                key={discount}
                type="button"
                onClick={() => setDiscountNominal(discount)}
                className={`h-8 rounded-xl border px-1 text-[11px] font-extrabold font-mono transition-all ${
                  discountNominal === discount
                    ? (isMochiPos ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "border-[#1f4437] bg-[#1f4437] text-white")
                    : "border-[#d3ddd8] bg-white text-[#65736c] hover:border-[#167052]/40"
                }`}
              >
                {discount === 0 ? "0" : `${discount / 1000}k`}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-1 text-xs tabular-nums font-mono border-t border-[#e8efe9] pt-2">
          <div className="flex justify-between text-[#68766f]"><dt>Subtotal</dt><dd>{formatRupiah(cartTotals.subtotal)}</dd></div>
          {cartTotals.discount > 0 && <div className="flex justify-between text-[#b34539] font-bold"><dt>Diskon</dt><dd>-{formatRupiah(cartTotals.discount)}</dd></div>}
          {cartTotals.serviceCharge > 0 && <div className="flex justify-between text-[#68766f]"><dt>Service</dt><dd>{formatRupiah(cartTotals.serviceCharge)}</dd></div>}
          {cartTotals.tax > 0 && <div className="flex justify-between text-[#68766f]"><dt>Pajak</dt><dd>{formatRupiah(cartTotals.tax)}</dd></div>}
          {serviceType === "delivery" && kirimOngkir > 0 && <div className="flex justify-between text-[#68766f]"><dt>Ongkir</dt><dd>{formatRupiah(kirimOngkir)}</dd></div>}
        </dl>

        <div className="flex items-baseline justify-between border-t border-[#d6dfda] pt-2">
          <span className="text-xs sm:text-sm font-black text-[#243a31]">Total Tagihan</span>
          <strong className={`text-xl sm:text-2xl font-black tabular-nums font-mono ${isMochiPos ? "text-[#0b3d2e]" : "text-[#167052]"}`}>
            {formatRupiah(checkoutTotal)}
          </strong>
        </div>

        <button
          type="button"
          disabled={cartList.length === 0}
          onClick={handleOpenPayment}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 shadow-md ${
            isMochiPos
              ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-emerald-950/10"
              : "bg-[#167052] hover:bg-[#115c43] text-white"
          }`}
        >
          <CreditCard size={17} aria-hidden="true" />
          <span>Lanjut Pembayaran ({cartList.reduce((sum, line) => sum + line.qty, 0)})</span>
        </button>
      </div>
    </section>
  );

  return (
    <div className={`${themeClassName} flex h-[100dvh] min-h-[640px] flex-col overflow-hidden ${isMochiPos ? "bg-[#f0f5f2]" : "bg-[#edf3f0]"} font-sans text-[#21352d]`}>
      <header className={`z-30 shrink-0 border-b ${isMochiPos ? "bg-[#0b3d2e] border-emerald-800/60 text-white shadow-sm" : "bg-white border-[#d8e1dc]"}`}>
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={userRole === "owner" ? "/app" : "/app/staff"}
              aria-label="Kembali"
              title="Kembali"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isMochiPos ? "border-white/15 bg-white/10 text-white hover:bg-white/20" : "border-[#ccd7d1] text-[#29473b] hover:bg-[#eef5f1]"
              }`}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${isMochiPos ? "bg-[#c8f53a] text-[#073829]" : "bg-[#1d5d47] text-white"}`}>
              {isMochiPos ? <Coffee size={20} aria-hidden="true" /> : <Receipt size={20} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`truncate text-sm font-black sm:text-base tracking-tight ${isMochiPos ? "text-white" : ""}`}>
                  {business?.name || "Mochi Cafe n Resto"}
                </h1>
                {isMochiPos ? (
                  <span className="hidden rounded-full bg-[#c8f53a] px-2.5 py-0.5 text-[9.5px] font-black text-[#073829] sm:inline">
                    Menu &amp; Pesan
                  </span>
                ) : (
                  <span className={`hidden rounded-lg px-2.5 py-1 text-[9.5px] font-black sm:inline ${
                    activeShift ? "bg-[#e4f4ed] text-[#176047]" : "bg-[#fff0ed] text-[#aa4035]"
                  }`}>
                    {activeShift ? "Shift aktif" : "Shift belum dibuka"}
                  </span>
                )}
              </div>
              <div className={`truncate text-[10.5px] sm:text-xs flex items-center gap-1.5 ${isMochiPos ? "text-emerald-200/90 font-medium" : "text-[#75837c]"}`}>
                <span>{isMochiPos ? "Pesan langsung ·" : ""}</span>
                {staffList.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = staffList.findIndex((s) => s.id === selectedStaffId);
                      const next = staffList[(idx + 1) % staffList.length];
                      if (next) setSelectedStaffId(next.id);
                    }}
                    className={`inline-flex items-center gap-1 font-bold underline decoration-dotted transition-colors ${
                      isMochiPos ? "text-[#c8f53a] hover:text-white" : "text-[#1d5d47] hover:underline"
                    }`}
                    title="Klik untuk ganti staf kasir yang bertugas"
                  >
                    <Users size={11} />
                    <span>{staffList.find((staff) => staff.id === selectedStaffId)?.name || "Staf Toko"} ⇄</span>
                  </button>
                ) : (
                  <span>{staffList.find((staff) => staff.id === selectedStaffId)?.name || "Kasir"}</span>
                )}
                {!isMochiPos && activeShift && `, modal ${formatRupiah(Number(activeShift.opening_cash))}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            {currentQrOrders.length > 0 && (
              <button
                type="button"
                aria-label={`${currentQrOrders.length} pesanan masuk`}
                title="Pesanan masuk"
                onClick={() => setShowQueue(true)}
                className={`relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border ${
                  isMochiPos ? "border-amber-400/40 bg-amber-50 text-[#a15a18]" : "border-[#e0b46d] bg-[#fff7e8] text-[#a15a18]"
                }`}
              >
                <Utensils size={18} aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ea580c] px-1 text-[9px] font-extrabold text-white">
                  {currentQrOrders.length}
                </span>
              </button>
            )}
            <button
              type="button"
              aria-label="Pengaturan Bel & Suara Kasir"
              title={soundEnabled ? "Bel Pesanan Aktif (Klik untuk atur/tes)" : "Bel Pesanan Mati"}
              onClick={() => setShowBellModal(true)}
              className={`relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-colors ${
                soundEnabled
                  ? isMochiPos
                    ? "border-[#c8f53a] bg-[#c8f53a] text-[#073829] shadow-xs"
                    : "border-[#16a34a] bg-[#dcfce7] text-[#15803d]"
                  : isMochiPos
                    ? "border-white/20 bg-white/10 text-white/50 hover:bg-white/20"
                    : "border-[#ccd7d1] text-[#75837c] hover:bg-[#eef5f1]"
              }`}
            >
              {soundEnabled ? <Bell size={17} className="animate-pulse" /> : <VolumeX size={17} />}
              {soundEnabled && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16a34a] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16a34a]"></span>
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Scan QR Member"
              title={attachedCustomer ? `Member: ${attachedCustomer.name}` : "Scan QR Member"}
              onClick={() => setShowMemberScannerModal(true)}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-colors relative ${
                attachedCustomer
                  ? "border-[#c8f53a] bg-[#c8f53a] text-[#073829] font-black shadow-xs"
                  : isMochiPos
                    ? "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
                    : "border-[#ccd7d1] text-[#29473b] hover:bg-[#eef5f1]"
              }`}
            >
              <Camera size={17} aria-hidden="true" />
              {attachedCustomer && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#16a34a] border border-white text-[8px] text-white font-black">
                  ✓
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Cetak QR Meja"
              title="Cetak QR Meja"
              onClick={() => setShowTableQrModal(true)}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-colors ${
                isMochiPos
                  ? "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
                  : "border-[#ccd7d1] text-[#29473b] hover:bg-[#eef5f1]"
              }`}
            >
              <QrCode size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={activeShift ? "Tutup shift" : "Buka shift"}
              title={activeShift ? "Shift aktif" : "Kelola shift"}
              onClick={() => setShowShiftModal(true)}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-colors ${
                isMochiPos
                  ? (activeShift
                      ? "border-emerald-500/40 bg-emerald-950/40 text-[#c8f53a]"
                      : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20")
                  : (activeShift
                      ? "border-[#bdd0c6] bg-[#e8f4ee] text-[#176047]"
                      : "border-[#e7c0bb] bg-[#fff0ed] text-[#a83d33]")
              }`}
            >
              <Clock size={17} aria-hidden="true" />
            </button>
            {isInstallable && !isInstalled && (
              <button
                type="button"
                aria-label="Install POS"
                title="Install POS di tablet / HP"
                onClick={triggerInstall}
                className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-all ${
                  isMochiPos
                    ? "bg-[#c8f53a] text-[#073829] border-[#c8f53a] shadow-xs"
                    : "bg-[#1d5d47] text-white border-[#1d5d47] shadow-xs"
                }`}
              >
                <MonitorSmartphone size={17} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={triggerInstall}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-xs ${
                  isMochiPos
                    ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57]"
                    : "bg-[#1d5d47] text-white hover:bg-[#154635]"
                }`}
                title="Pasang aplikasi POS di tablet kasir"
              >
                <MonitorSmartphone size={15} />
                <span>Install POS</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBellModal(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                soundEnabled
                  ? isMochiPos
                    ? "bg-[#c8f53a] text-[#073829] shadow-xs hover:bg-[#d9ff57]"
                    : "bg-[#dcfce7] text-[#15803d] border border-[#86efac]"
                  : isMochiPos
                    ? "border border-white/20 bg-white/10 text-white/70 hover:bg-white/20"
                    : "border border-[#ccd7d1] text-[#75837c] hover:bg-[#eef5f1]"
              }`}
              title="Atur Bel & Suara Pesanan Masuk"
            >
              <Bell size={15} className={soundEnabled ? "animate-pulse" : ""} />
              <span>{soundEnabled ? "Bel Pesanan: Aktif" : "Bel Pesanan: Mati"}</span>
              {soundEnabled && <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-ping" />}
            </button>
            {currentQrOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowQueue(true)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  isMochiPos
                    ? "bg-amber-400 text-[#073829] shadow-xs hover:bg-amber-300"
                    : "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                }`}
              >
                <Utensils size={15} />
                <span>{currentQrOrders.length} Pesanan Meja</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* FLOATING INCOMING ORDER BANNER */}
      {incomingToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg animate-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-2xl border ${
            isMochiPos
              ? "bg-[#0b3d2e] text-white border-[#c8f53a]"
              : "bg-[#232331] text-white border-amber-400"
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#073829] font-black">
                <Bell size={18} className="animate-bounce" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black truncate text-[#c8f53a]">
                  🔔 Pesanan Baru Masuk! Meja {incomingToast.tableNo}
                </p>
                <p className="text-[11px] font-mono text-emerald-100 truncate">
                  #{incomingToast.orderNo} · {formatRupiah(incomingToast.total)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowQueue(true);
                  setIncomingToast(null);
                }}
                className="rounded-xl bg-[#c8f53a] text-[#073829] px-3 py-1.5 font-mono text-xs font-black shadow-xs hover:bg-[#d9ff57] transition-all"
              >
                Buka Antrean
              </button>
              <button
                type="button"
                onClick={() => setIncomingToast(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="solusi" className="grid min-h-0 flex-1 lg:grid-cols-[68px_minmax(0,1fr)_390px] xl:grid-cols-[72px_minmax(0,1fr)_430px] 2xl:grid-cols-[76px_minmax(0,1fr)_460px]">
        <nav aria-label="Navigasi kasir" className={`hidden min-h-0 flex-col items-center gap-2 border-r px-1.5 py-3 lg:flex transition-colors ${isMochiPos ? "bg-[#07281e] border-emerald-900/60 text-emerald-100" : "bg-white border-[#d8e1dc]"}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform ${isMochiPos ? "bg-[#c8f53a] text-[#073829] shadow-sm" : "bg-[#1d5d47] text-white"}`} title="Kasir">
            <LayoutGrid size={20} aria-hidden="true" />
          </div>
          {userRole === "owner" && (
            <Link href="/app/pos/menu" aria-label="Kelola menu" title="Kelola menu" className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isMochiPos ? "text-emerald-300/80 hover:bg-white/10 hover:text-white" : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"}`}>
              <UtensilsCrossed size={20} aria-hidden="true" />
            </Link>
          )}
          <Link href="/app/pos/station" aria-label="Kasir tetap" title="Kasir tetap" className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isMochiPos ? "text-emerald-300/80 hover:bg-white/10 hover:text-white" : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"}`}>
            <MonitorSmartphone size={20} aria-hidden="true" />
          </Link>
          <Link href="/app/pos/kitchen" aria-label="Dapur" title="Dapur" className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isMochiPos ? "text-emerald-300/80 hover:bg-white/10 hover:text-white" : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"}`}>
            <ChefHat size={20} aria-hidden="true" />
          </Link>
          {userRole === "owner" && (
            <Link href="/app/pos/owner" aria-label="Dashboard owner" title="Dashboard owner" className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isMochiPos ? "text-emerald-300/80 hover:bg-white/10 hover:text-white" : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"}`}>
              <TrendingUp size={20} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowTableQrModal(true)}
            aria-label="Cetak QR Meja"
            title="Cetak QR Meja"
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              isMochiPos
                ? "text-emerald-300/80 hover:bg-white/10 hover:text-white"
                : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"
            }`}
          >
            <QrCode size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowMemberScannerModal(true)}
            aria-label="Scan QR Member"
            title={attachedCustomer ? `Member: ${attachedCustomer.name}` : "Scan QR Member"}
            className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              attachedCustomer
                ? "bg-[#c8f53a] text-[#073829] shadow-xs"
                : isMochiPos
                  ? "text-emerald-300/80 hover:bg-white/10 hover:text-white"
                  : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"
            }`}
          >
            <Camera size={20} aria-hidden="true" />
            {attachedCustomer && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#16a34a] border border-white text-[8px] text-white font-black">
                ✓
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowBellModal(true)}
            aria-label="Pengaturan Bel & Suara Kasir"
            title={soundEnabled ? "Bel Pesanan Aktif (Klik untuk atur/tes)" : "Bel Pesanan Mati"}
            className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              soundEnabled
                ? isMochiPos
                  ? "bg-[#c8f53a] text-[#073829] shadow-xs"
                  : "bg-[#dcfce7] text-[#15803d]"
                : isMochiPos
                  ? "text-emerald-300/80 hover:bg-white/10 hover:text-white"
                  : "text-[#66766e] hover:bg-[#edf4f0] hover:text-[#1d5d47]"
            }`}
          >
            {soundEnabled ? <Bell size={20} className="animate-pulse" /> : <VolumeX size={20} />}
            {soundEnabled && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16a34a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#16a34a]"></span>
              </span>
            )}
          </button>
          {currentQrOrders.length > 0 && (
            <button type="button" onClick={() => setShowQueue(true)} aria-label={`${currentQrOrders.length} pesanan masuk`} title="Pesanan masuk" className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4df] text-[#a15a18]">
              <Utensils size={19} aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ea580c] px-1 text-[9px] font-extrabold text-white">{currentQrOrders.length}</span>
            </button>
          )}
          <button type="button" onClick={() => setShowShiftModal(true)} aria-label={activeShift ? "Tutup shift" : "Buka shift"} title={activeShift ? "Tutup shift" : "Buka shift"} className={`mt-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
            activeShift
              ? (isMochiPos ? "border-[#c8f53a]/50 bg-[#0b3d2e] text-[#c8f53a]" : "border-[#b8cec2] bg-[#e5f3ec] text-[#176047]")
              : "border-[#e3b5af] bg-[#fff0ed] text-[#a83d33]"
          }`}>
            <Clock size={19} aria-hidden="true" />
          </button>
        </nav>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[#d8e1dc]">
          <div className={`shrink-0 border-b p-2.5 sm:p-4 ${isMochiPos ? "bg-white border-[#dbe4df]" : "bg-[#f7faf8] border-[#dbe4df]"}`}>
            <div className="relative">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-[#718078] sm:h-[18px] sm:w-[18px]" />
              <input
                type="search"
                value={menuSearchQuery}
                onChange={(event) => setMenuSearchQuery(event.target.value)}
                placeholder="Cari nama menu"
                aria-label="Cari nama menu"
                className={`min-h-10 sm:min-h-12 w-full rounded-xl border bg-white pl-9 sm:pl-11 pr-9 sm:pr-11 text-xs sm:text-sm outline-none transition-colors placeholder:text-[#98a29d] ${isMochiPos ? "border-[#ccd9d3] focus:border-[#167052] focus:ring-2 focus:ring-[#167052]/20" : "border-[#cfdad4] focus:border-[#167052]"}`}
              />
              {menuSearchQuery && (
                <button type="button" aria-label="Hapus pencarian" onClick={() => setMenuSearchQuery("")} className="absolute right-0 top-1/2 flex h-10 sm:h-11 w-10 sm:w-11 -translate-y-1/2 items-center justify-center text-[#68766f]">
                  <X size={16} aria-hidden="true" className="sm:h-[18px] sm:w-[18px]" />
                </button>
              )}
            </div>

            <div className="mt-2 flex overflow-x-auto gap-1.5 pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left transition-all ${
                  activeCategory === "all"
                    ? (isMochiPos ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "border-[#167052] bg-[#e1f2ea] text-[#15533e]")
                    : (isMochiPos ? "border-[#d8e3de] bg-white text-[#20372e] hover:border-[#167052]/40" : "border-[#d5ded9] bg-white text-[#526159]")
                }`}
              >
                <LayoutGrid size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                <span className="text-xs font-extrabold whitespace-nowrap">Semua</span>
                <span className={`text-[10px] font-mono rounded-full px-1.5 py-0.5 ${activeCategory === "all" && isMochiPos ? "bg-[#c8f53a]/25 text-[#c8f53a]" : "bg-slate-100 text-[#7c8982]"}`}>
                  {menuItems.length}
                </span>
              </button>
              {categories.map((category) => {
                const CategoryIcon = getPosCategoryIcon(category.name);
                const itemCount = menuItems.filter((item) => item.category_id === category.id).length;
                const isSelected = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? (isMochiPos ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-xs" : "border-[#167052] bg-[#e1f2ea] text-[#15533e]")
                        : (isMochiPos ? "border-[#d8e3de] bg-white text-[#20372e] hover:border-[#167052]/40" : "border-[#d5ded9] bg-white text-[#526159]")
                    }`}
                  >
                    <CategoryIcon size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    <span className="text-xs font-extrabold whitespace-nowrap">{category.name}</span>
                    <span className={`text-[10px] font-mono rounded-full px-1.5 py-0.5 ${isSelected && isMochiPos ? "bg-[#c8f53a]/25 text-[#c8f53a]" : "bg-slate-100 text-[#7c8982]"}`}>
                      {itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end justify-between px-3 pb-2 pt-2 sm:px-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#78867f]">
                {isMochiPos ? "Katalog Menu" : "Katalog Kasir"}
              </p>
              <h2 className="text-base sm:text-lg font-black text-[#1e3b30]">
                {activeCategory === "all" ? "Daftar Menu Kasir" : categories.find((category) => category.id === activeCategory)?.name || "Menu"}
              </h2>
            </div>
            <span className="text-xs font-bold font-mono text-[#728078] bg-[#edf8f3] px-2.5 py-0.5 rounded-lg border border-emerald-900/10">
              {filteredMenu.length} menu tersedia
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-4 lg:pb-4">
            {filteredMenu.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredMenu.map((item) => {
                  const inCart = cart[item.id];
                  const categoryName = categories.find((category) => category.id === item.category_id)?.name ?? "Menu";
                  const CategoryIcon = getPosCategoryIcon(categoryName);
                  const hasPhoto = item.photo_url && item.photo_url !== PLACEHOLDER_MENU;
                  return (
                    <article
                      key={item.id}
                      onClick={() => {
                        if (item.is_available) {
                          handleAddToCart(item);
                        }
                      }}
                      className={`group relative flex min-w-0 flex-col justify-between rounded-2xl border bg-white p-2.5 sm:p-3 transition-all cursor-pointer select-none active:scale-[0.98] hover:shadow-md hover:border-[#167052]/60 ${
                        inCart
                          ? (isMochiPos ? "border-2 border-[#167052] ring-2 ring-[#167052]/15 shadow-sm bg-[#f7fcf9]" : "border-[#167052] shadow-[0_4px_14px_rgba(22,112,82,0.1)]")
                          : (isMochiPos ? "border-[#d8e3de]" : "border-[#d8e1dc]")
                      } ${!item.is_available ? "opacity-55 cursor-not-allowed" : ""}`}
                    >
                      <div className="space-y-2">
                        <div className="relative aspect-[16/11] sm:aspect-[4/3] max-h-36 sm:max-h-40 w-full overflow-hidden rounded-xl bg-[#e8f2ed] text-[#34745d] flex items-center justify-center">
                          {hasPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photo_url ?? undefined}
                              alt={item.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <CategoryIcon size={26} strokeWidth={1.6} aria-hidden="true" />
                          )}
                          {inCart && (
                            <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0b3d2e] px-2 font-mono text-[11px] font-black text-[#c8f53a] shadow-md ring-2 ring-white animate-in zoom-in-75">
                              {inCart.qty}x
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-xs sm:text-sm font-extrabold leading-snug text-[#20372e] group-hover:text-[#167052] transition-colors">
                            {item.name}
                          </h3>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#718078]">
                            {categoryName}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-[#f0f4f2] pt-2">
                        <strong
                          className={`text-xs sm:text-sm font-black tabular-nums font-mono ${
                            isMochiPos ? "text-[#0b3d2e]" : "text-[#9b5332]"
                          }`}
                        >
                          {formatRupiah(Number(item.price))}
                        </strong>

                        {item.is_available ? (
                          inCart ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Kurangi ${item.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQty(item.id, -1);
                                }}
                                className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border transition-colors active:scale-95 ${
                                  isMochiPos
                                    ? "border-[#ccd9d3] bg-[#edf8f3] text-[#167052] hover:bg-[#e0f1e8]"
                                    : "border-[#c5d4cd] text-[#315d4b]"
                                }`}
                              >
                                <Minus size={12} aria-hidden="true" />
                              </button>
                              <span className="w-5 text-center text-xs font-black tabular-nums font-mono">
                                {inCart.qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(item);
                                }}
                                className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-white transition-colors active:scale-95 ${
                                  isMochiPos ? "bg-[#0b3d2e] hover:bg-[#124d3b]" : "bg-[#167052]"
                                }`}
                              >
                                <Plus size={12} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Tambah ${item.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(item);
                              }}
                              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 shadow-xs ${
                                isMochiPos
                                  ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] font-black"
                                  : "bg-[#0aae6f] hover:bg-[#079760] text-white"
                              }`}
                            >
                              <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                          )
                        ) : (
                          <span className="flex items-center rounded-lg bg-[#fff0ed] px-1.5 py-0.5 text-[9.5px] font-bold text-[#a44237]">
                            Habis
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#d6dfda] bg-white px-6 text-center">
                <Search size={27} strokeWidth={1.6} className="text-[#82968d]" aria-hidden="true" />
                <p className="mt-3 text-sm font-extrabold text-[#294239]">Menu tidak ditemukan</p>
                <p className="mt-1 text-xs text-[#7b8882]">Coba kata pencarian atau kategori lain.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-hidden lg:block">{renderInvoice(false)}</aside>
      </main>

      {cartList.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d1ddd7] bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(25,67,52,0.12)] lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className={`mx-auto flex min-h-12 w-full max-w-md items-center justify-between px-4 transition-all active:scale-[0.99] ${
              isMochiPos
                ? "rounded-2xl bg-[#0b3d2e] text-white shadow-xl border border-emerald-700/50 hover:bg-[#124d3b]"
                : "rounded-lg bg-[#167052] text-white"
            }`}
          >
            <span className="flex items-center gap-2.5 text-left">
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isMochiPos ? "bg-[#c8f53a] text-[#073829]" : "bg-white/20 text-white"}`}>
                <ShoppingCart size={17} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-extrabold">Lihat Pesanan</span>
                <span className={`block text-[10px] ${isMochiPos ? "text-emerald-200 font-mono" : "text-white/75"}`}>
                  {cartList.reduce((sum, line) => sum + line.qty, 0)} item dipilih
                </span>
              </span>
            </span>
            <span className={`text-sm font-black tabular-nums font-mono ${isMochiPos ? "text-[#c8f53a]" : "text-white"}`}>
              {formatRupiah(checkoutTotal)}
            </span>
          </button>
        </div>
      )}

      {showMobileCart && cartList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#12271f]/45 lg:hidden" role="dialog" aria-modal="true" aria-label="Rincian pesanan kasir">
          <button type="button" aria-label="Tutup rincian pesanan" onClick={() => setShowMobileCart(false)} className="absolute inset-0 cursor-default" />
          <div className="relative h-[90dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-[0_-16px_40px_rgba(17,42,33,0.2)]">
            <div className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-[#cbd6d0]" />
            {renderInvoice(true)}
          </div>
        </div>
      )}

      {/* MODAL: PAYMENT MODAL & CASH CALCULATOR */}
      {showPaymentModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs ${
          isMochiPos ? "bg-[#07281e]/60" : "bg-[#232331]/60"
        }`}>
          <div className={`w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 space-y-4 animate-in zoom-in-95 font-mono text-xs max-h-[95vh] overflow-y-auto ${
            isMochiPos ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
          }`}>
            
            <div className={`flex items-center justify-between border-b pb-3 ${
              isMochiPos ? "border-[#e0ebe5]" : "border-[#dedee8]"
            }`}>
              <h3 className={`font-extrabold text-base font-sans ${
                isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"
              }`}>
                Pembayaran Kasir
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className={`font-bold p-1 transition-colors ${
                  isMochiPos ? "text-[#7b8882] hover:text-[#0b3d2e]" : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-4 font-sans text-xs">
              
              {/* Tipe layanan: Dine-In / Takeaway / Delivery */}
              <div className="space-y-1 font-mono">
                <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Tipe Layanan:</label>
                <div className="grid grid-cols-3 gap-2">
                  {SERVICE_TYPES.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setServiceType(st.key)}
                      title={st.hint}
                      className={`p-2 rounded-xl border font-bold text-center text-[11px] transition-all ${
                        serviceType === st.key
                          ? (isMochiPos ? "bg-[#0b3d2e] text-[#c8f53a] border-[#0b3d2e] shadow-xs" : "bg-[#232331] text-[#d9ff57] border-[#232331]")
                          : (isMochiPos ? "bg-white text-[#526159] border-[#d8e3de] hover:bg-[#edf8f3]" : "bg-white text-[#7b7b8e] border-[#dedee8]")
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staf Kasir yang Melayani (Fleksibel: Siapapun Bisa Jadi Kasir) */}
              {staffList.length > 0 && (
                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <label className={`block font-bold flex items-center gap-1.5 ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                      <Users size={12} />
                      <span>Kasir / Staf yang Melayani:</span>
                    </label>
                    <span className="text-[10px] text-[#718078]">Pilih nama staf</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {staffList.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStaffId(st.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                          selectedStaffId === st.id
                            ? isMochiPos
                              ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                              : "border-[#232331] bg-[#232331] text-white shadow-ink-xs"
                            : isMochiPos
                              ? "border-[#ccd9d3] bg-white text-[#2d473e] hover:bg-[#edf8f3]"
                              : "border-[#ccd7d1] bg-white text-[#526159] hover:bg-[#f2f5f3]"
                        }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {serviceType === "delivery" && (
                <div className={`space-y-2 rounded-2xl border p-3 font-mono ${
                  isMochiPos ? "border-[#d8e3de] bg-[#f8faf9]" : "border-[#dedee8] bg-[#fcfcfe]"
                }`}>
                  <p className={`font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Data pengantaran</p>
                  <input
                    type="text" required value={kirimNama}
                    onChange={(e) => setKirimNama(e.target.value)}
                    placeholder="Nama penerima"
                    className={`w-full rounded-xl border p-2 text-xs ${isMochiPos ? "border-[#ccd9d3] focus:border-[#167052]" : "border-[#c9c9d4]"}`}
                  />
                  <input
                    type="tel" required value={kirimHp}
                    onChange={(e) => setKirimHp(e.target.value)}
                    placeholder="Nomor WhatsApp"
                    className={`w-full rounded-xl border p-2 text-xs ${isMochiPos ? "border-[#ccd9d3] focus:border-[#167052]" : "border-[#c9c9d4]"}`}
                  />
                  <textarea
                    required value={kirimAlamat} rows={2}
                    onChange={(e) => setKirimAlamat(e.target.value)}
                    placeholder="Alamat lengkap"
                    className={`w-full rounded-xl border p-2 text-xs ${isMochiPos ? "border-[#ccd9d3] focus:border-[#167052]" : "border-[#c9c9d4]"}`}
                  />
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Ongkir (Rp)</label>
                    <input
                      type="number" min={0} step={1000} value={kirimOngkir}
                      onChange={(e) => setKirimOngkir(Number(e.target.value))}
                      className={`w-full rounded-xl border p-2 text-xs font-bold ${isMochiPos ? "border-[#ccd9d3] text-[#0b3d2e]" : "border-[#c9c9d4]"}`}
                    />
                  </div>
                  <input
                    type="text" value={kirimCatatan}
                    onChange={(e) => setKirimCatatan(e.target.value)}
                    placeholder="Catatan pengiriman (opsional)"
                    className={`w-full rounded-xl border p-2 text-xs ${isMochiPos ? "border-[#ccd9d3]" : "border-[#c9c9d4]"}`}
                  />
                </div>
              )}

              {serviceType === "dine_in" && (
                <div className="space-y-1 font-mono">
                  <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Nomor Meja:</label>
                  <input
                    type="text"
                    value={selectedTableNo}
                    onChange={(e) => setSelectedTableNo(e.target.value)}
                    placeholder="Contoh: 04"
                    className={`w-full rounded-xl border p-2 text-xs font-bold ${
                      isMochiPos
                        ? "border-[#ccd9d3] text-[#0b3d2e] focus:border-[#167052] focus:ring-1 focus:ring-[#167052]/20"
                        : "border-[#232331] text-[#232331]"
                    }`}
                  />
                </div>
              )}

              {/* Loyalty Customer Attacher */}
              <div className={`space-y-1 font-mono border-t pt-3 ${isMochiPos ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                <div className="flex justify-between items-center">
                  <label className={`font-bold ${isMochiPos ? "text-[#167052]" : "text-[#7958d8]"}`}>Member KAEL Loyalty (Opsional):</label>
                  {attachedCustomer && (
                    <button
                      type="button"
                      onClick={() => setAttachedCustomer(null)}
                      className="text-[10px] text-[#ef4444] font-bold hover:underline"
                    >
                      Lepas Member
                    </button>
                  )}
                </div>

                {attachedCustomer ? (
                  <div className="rounded-xl border border-[#16a34a] bg-[#dcfce7] p-2.5 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#232331] block truncate">{attachedCustomer.name}</span>
                        <span className="rounded bg-[#bbf7d0] px-1 py-0.2 text-[9px] font-black text-[#166534]">MEMBER</span>
                      </div>
                      <span className="text-[10.5px] text-[#7b7b8e] font-mono">{attachedCustomer.phone_masked}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs text-[#16a34a]">
                        {!loyaltyProgram
                          ? "Member Terpasang ✓"
                          : loyaltyProgram.tiers_is_active
                            ? "Poin Masuk Otomatis ✓"
                            : loyaltyProgram.mode === "stamp"
                              ? `+${loyaltyProgram.stamp_per_visit} Stamp Masuk ✓`
                              : `+${calculateEarnedPoints(cartTotals.total, loyaltyProgram.earn_rate)} Pts Masuk ✓`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMemberScannerModal(true)}
                        title="Ganti member"
                        className="rounded-lg border border-emerald-300 bg-white p-1 text-emerald-800 hover:bg-emerald-50"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-[#7b7b8e]" size={14} />
                        <input
                          type="text"
                          value={loyaltySearchQuery}
                          onChange={(e) => setLoyaltySearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickSearchOrScan(loyaltySearchQuery);
                            }
                          }}
                          placeholder="Ketik WA, nama, atau tembak scanner..."
                          className={`w-full rounded-xl border pl-8 pr-3 py-1.5 text-xs font-bold ${
                            isMochiPos
                              ? "border-[#ccd9d3] text-[#0b3d2e] focus:border-[#167052]"
                              : "border-[#dedee8] text-[#232331]"
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMemberScannerModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black shrink-0 transition-all active:scale-95 ${
                          isMochiPos
                            ? "bg-[#0b3d2e] text-[#c8f53a] border-[#0b3d2e] hover:bg-[#124634]"
                            : "bg-[#232331] text-white border-[#232331]"
                        }`}
                      >
                        <Camera size={13} />
                        <span>Scan QR</span>
                      </button>
                    </div>

                    {loyaltySearchResults.length > 0 && (
                      <div className={`mt-1 rounded-xl border bg-white p-1 space-y-1 max-h-32 overflow-y-auto ${
                        isMochiPos ? "border-[#167052]" : "border-[#7958d8]"
                      }`}>
                        {loyaltySearchResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setAttachedCustomer(c);
                              setLoyaltySearchQuery("");
                            }}
                            className={`w-full flex justify-between items-center p-1.5 rounded-lg text-left text-[11px] transition-colors ${
                              isMochiPos ? "hover:bg-[#edf8f3]" : "hover:bg-[#f0edff]"
                            }`}
                          >
                            <span className="font-bold text-[#232331]">{c.name} ({c.phone_masked})</span>
                            <span className="font-bold text-[#15803d]">{c.balance} Pts</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {!formMemberBaru ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormMemberBaru(true);
                          setMemberBaruNama("");
                          setMemberBaruTelp(loyaltySearchQuery.replace(/\D/g, ""));
                          setGalatMemberBaru(null);
                        }}
                        className={`mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-1.5 text-[11px] font-bold transition-colors ${
                          isMochiPos
                            ? "border-[#167052] text-[#167052] hover:bg-[#edf8f3]"
                            : "border-[#7958d8] text-[#7958d8] hover:bg-[#faf9ff]"
                        }`}
                      >
                        <UserPlus size={12} /> Daftarkan member baru
                      </button>
                    ) : (
                      <div className={`mt-1.5 space-y-1.5 rounded-xl border p-2 ${
                        isMochiPos ? "border-[#167052] bg-[#f4faf7]" : "border-[#7958d8] bg-[#faf9ff]"
                      }`}>
                        <input
                          type="text"
                          value={memberBaruNama}
                          onChange={(e) => setMemberBaruNama(e.target.value)}
                          placeholder="Nama pelanggan"
                          className="w-full rounded-lg border border-[#dedee8] px-2 py-1.5 text-[11px] font-bold"
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={memberBaruTelp}
                          onChange={(e) => setMemberBaruTelp(e.target.value)}
                          placeholder="Nomor WhatsApp"
                          className="w-full rounded-lg border border-[#dedee8] px-2 py-1.5 font-mono text-[11px] font-bold"
                        />
                        {galatMemberBaru && (
                          <p className="text-[10px] font-bold text-[#c2410c]">{galatMemberBaru}</p>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormMemberBaru(false)}
                            className="flex-1 rounded-lg border border-[#dedee8] bg-white py-1.5 text-[11px] font-bold text-[#5c5c70]"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={simpanMemberBaru}
                            onClick={async () => {
                              setGalatMemberBaru(null);
                              setSimpanMemberBaru(true);
                              const res = await registerCustomerByStaffAction({
                                name: memberBaruNama,
                                phone: memberBaruTelp,
                              });
                              setSimpanMemberBaru(false);
                              if (!res.ok) {
                                setGalatMemberBaru(res.error);
                                return;
                              }
                              setAttachedCustomer(res.data.customer);
                              setFormMemberBaru(false);
                              setLoyaltySearchQuery("");
                            }}
                            className={`flex-1 rounded-lg py-1.5 text-[11px] font-black disabled:opacity-60 transition-all ${
                              isMochiPos
                                ? "bg-[#c8f53a] text-[#073829] shadow-xs"
                                : "border border-[#232331] bg-[#d9ff57] text-[#232331]"
                            }`}
                          >
                            {simpanMemberBaru ? "..." : "Daftar & pakai"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className={`space-y-1 font-mono border-t pt-3 ${isMochiPos ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Metode Pembayaran:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "💵 Tunai (Cash)" },
                    { id: "qris", label: "📱 QRIS" },
                    { id: "transfer", label: "🏦 Transfer" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border font-bold text-center text-xs transition-all ${
                        paymentMethod === m.id
                          ? (isMochiPos ? "bg-[#0b3d2e] text-[#c8f53a] border-[#0b3d2e] shadow-xs" : "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs")
                          : (isMochiPos ? "bg-white text-[#526159] border-[#d8e3de] hover:bg-[#edf8f3]" : "bg-white text-[#7b7b8e] border-[#dedee8]")
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Input & Change Calculator */}
              {paymentMethod === "cash" && (
                <div className={`rounded-2xl border p-3 space-y-2 font-mono text-xs ${
                  isMochiPos ? "border-[#d8e3de] bg-[#f8faf9]" : "border-[#dedee8] bg-[#fcfcfe]"
                }`}>
                  <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Uang Tunai Diterima (Rp):</label>
                  <input
                    type="number"
                    min={checkoutTotal}
                    step={5000}
                    value={cashGivenInput}
                    onChange={(e) => setCashGivenInput(Number(e.target.value))}
                    className={`w-full rounded-xl border-2 p-2.5 text-base font-black ${
                      isMochiPos ? "border-[#0b3d2e] text-[#0b3d2e]" : "border-[#232331] text-[#232331]"
                    }`}
                  />

                  {/* Quick Cash Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[checkoutTotal, 50000, 100000, 150000, 200000].filter((v, i, a) => a.indexOf(v) === i && v >= checkoutTotal).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashGivenInput(amt)}
                        className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition-colors ${
                          isMochiPos
                            ? "border-[#d8e3de] bg-white text-[#526159] hover:border-[#0b3d2e] hover:bg-[#edf8f3]"
                            : "border-[#dedee8] bg-white text-[#7b7b8e] hover:border-[#232331]"
                        }`}
                      >
                        {amt === checkoutTotal ? "Uang Pas" : formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Display */}
                  <div className={`flex justify-between items-center pt-2 border-t ${
                    isMochiPos ? "border-[#e0ebe5]" : "border-[#dedee8]"
                  }`}>
                    <span className="font-bold text-[#7b7b8e]">KEMBALIAN:</span>
                    <span className={`text-base font-black font-mono ${
                      isMochiPos ? "text-[#0b3d2e]" : "text-[#16a34a]"
                    }`}>
                      {formatRupiah(cashChangeCalc.cashChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* QRIS: QR bernominal, atau pemasangan kalau belum terpasang */}
              {paymentMethod === "qris" && (
                <QrisPayment
                  business={business}
                  amount={checkoutTotal}
                  isOwner={userRole === "owner"}
                />
              )}

              {/* Submit Payment */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black disabled:opacity-50 transition-all ${
                    isMochiPos
                      ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-md active:scale-[0.99]"
                      : "btn-tactile border-2 border-[#232331] bg-[#16a34a] text-white shadow-ink-md"
                  }`}
                >
                  <Check size={16} />
                  <span>
                    {isPending
                      ? "Memproses..."
                      : paymentMethod === "qris" || paymentMethod === "transfer"
                        ? "Uang Sudah Masuk · Selesaikan Transaksi ✓"
                        : "Terima Tunai · Selesaikan Transaksi ✓"}
                  </span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {showQueue && (
        <OrderQueue
          orders={currentQrOrders}
          onClose={() => setShowQueue(false)}
          isMochi={isMochiPos}
          onPrintKitchenTicket={handlePrintKitchenTicketFromQueue}
          onPrintThreePly={handlePrintThreePlyBluetooth}
          autoPrintThreePly={autoPrintThreePly}
          onToggleAutoPrintThreePly={handleToggleAutoPrintThreePly}
        />
      )}

      {/* MODAL: POST-PAYMENT SUCCESS & RECEIPT ACTIONS */}
      {completedOrder && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs ${
          isMochiPos ? "bg-[#07281e]/60" : "bg-[#232331]/60"
        }`}>
          <div className={`w-full max-w-sm rounded-3xl bg-white p-6 text-center space-y-4 animate-in zoom-in-95 font-mono text-xs ${
            isMochiPos ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
          }`}>
            
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
              isMochiPos
                ? "bg-[#edf8f3] text-[#167052] border border-[#a3d9be]"
                : "bg-[#dcfce7] text-[#16a34a] border-2 border-[#16a34a]"
            }`}>
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <span className={`text-[10.5px] font-bold block uppercase ${
                isMochiPos ? "text-[#167052]" : "text-[#7958d8]"
              }`}>TRANSAKSI SUKSES</span>
              <h3 className={`text-2xl font-black ${
                isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"
              }`}>
                #{completedOrder.orderNo}
              </h3>
              <p className={`text-base font-extrabold ${
                isMochiPos ? "text-[#0b3d2e]" : "text-[#16a34a]"
              }`}>
                Total: {formatRupiah(completedOrder.total)}
              </p>
              {completedOrder.paymentMethod === "cash" && (
                <p className="text-xs text-[#7b7b8e]">
                  Kembalian: {formatRupiah(completedOrder.change)}
                </p>
              )}
            </div>

            {/* Receipt Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handlePrintThreePlyBluetooth()}
                disabled={printerState === "printing"}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black disabled:opacity-60 transition-all ${
                  isMochiPos
                    ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-md ring-2 ring-[#c8f53a]/50"
                    : "btn-tactile border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-md"
                }`}
              >
                <Printer size={15} />
                <span>Cetak 3 Rangkap (Dapur + Kasir + Meja) 🖨️</span>
              </button>

              <label className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer text-[11px] font-bold transition-colors ${
                isMochiPos
                  ? "bg-[#edf8f3] border-[#d8e3de] text-[#0b3d2e]"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}>
                <span>Cetak otomatis 3 rangkap tiap pesanan</span>
                <input
                  type="checkbox"
                  checked={autoPrintThreePly}
                  onChange={(e) => handleToggleAutoPrintThreePly(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0b3d2e]"
                />
              </label>

              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handlePrintBluetoothThermal}
                  disabled={printerState === "printing"}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold disabled:opacity-60 transition-all ${
                    isMochiPos
                      ? "bg-[#0b3d2e] hover:bg-[#124d3b] text-white border border-[#0b3d2e] shadow-xs"
                      : "btn-tactile border-2 border-[#232331] bg-[#232331] text-white shadow-ink-xs"
                  }`}
                  title="Cetak struk belanja pelanggan saja"
                >
                  <Printer size={13} />
                  <span>Struk Pelanggan</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintKitchenTicketBluetooth}
                  disabled={printerState === "printing"}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold disabled:opacity-60 transition-all ${
                    isMochiPos
                      ? "border border-emerald-800/30 bg-white text-[#0b3d2e] hover:bg-[#edf8f3]"
                      : "border border-[#232331] bg-white text-[#232331]"
                  }`}
                  title="Cetak tiket dapur barista saja"
                >
                  <ChefHat size={13} />
                  <span>Tiket Dapur</span>
                </button>
              </div>
              {completedOrder.paymentMethod === "cash" && (
                <p className={`rounded-lg border px-3 py-2 text-left text-[10px] font-bold ${
                  isMochiPos
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-[#d97706] bg-[#fff7e5] text-[#9a4f0a]"
                }`}>
                  Laci terbuka lewat kabel RJ11 pada printer setelah struk berhasil dikirim.
                </p>
              )}
              {printerState === "connected" && <p className="text-[10px] font-bold text-[#15803d]">Printer terhubung dan aktivitas cetak tercatat.</p>}

              <Link
                href={`/receipt/${completedOrder.orderId}`}
                target="_blank"
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                  isMochiPos
                    ? "border border-[#ccd9d3] bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e0f1e8]"
                    : "btn-tactile border border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                }`}
              >
                <Share2 size={14} />
                <span>Kirim Struk Digital WhatsApp</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setCompletedOrder(null)}
              className={`w-full py-2 text-xs font-bold pt-1 transition-colors ${
                isMochiPos ? "text-[#526159] hover:text-[#0b3d2e]" : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              + Transaksi Baru
            </button>

          </div>
        </div>
      )}

      {/* MODAL: SHIFT MANAGEMENT */}
      {showShiftModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs ${
          isMochiPos ? "bg-[#07281e]/60" : "bg-[#232331]/60"
        }`}>
          <div className={`w-full max-w-md rounded-3xl bg-white p-6 space-y-4 animate-in zoom-in-95 font-mono text-xs ${
            isMochiPos ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
          }`}>
            
            <div className={`flex items-center justify-between border-b pb-3 ${
              isMochiPos ? "border-[#e0ebe5]" : "border-[#dedee8]"
            }`}>
              <h3 className={`font-extrabold text-base font-sans ${
                isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"
              }`}>
                {activeShift ? "Tutup Shift Kasir" : "Buka Shift Kasir Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className={`font-bold p-1 transition-colors ${
                  isMochiPos ? "text-[#7b8882] hover:text-[#0b3d2e]" : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                ✕
              </button>
            </div>

            {activeShift ? (
              <form onSubmit={handleCloseShift} className="space-y-3 font-sans">
                <div className={`rounded-xl p-3 space-y-1 font-mono text-xs ${
                  isMochiPos ? "bg-[#edf8f3] border border-[#ccd9d3]" : "bg-[#f0edff]"
                }`}>
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">Waktu Buka:</span>
                    <span>{formatBusinessDateTime(activeShift.opened_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">Modal Awal:</span>
                    <span className="font-bold">{formatRupiah(Number(activeShift.opening_cash))}</span>
                  </div>
                </div>

                <div className="space-y-1 font-mono">
                  <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                    Hitung Uang Fisik di Laci Kasir (Rp):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={5000}
                    value={shiftClosingCashInput}
                    onChange={(e) => setShiftClosingCashInput(Number(e.target.value))}
                    className={`w-full rounded-xl border-2 p-2.5 text-base font-black ${
                      isMochiPos ? "border-[#0b3d2e] text-[#0b3d2e]" : "border-[#232331] text-[#232331]"
                    }`}
                    autoFocus
                  />
                  <span className="text-[10px] text-[#7b7b8e] block">
                    Sistem otomatis mencocokkan dengan rekaman penjualan kasir.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className={`rounded-xl px-5 py-2 font-black text-white disabled:opacity-50 transition-all ${
                      isMochiPos
                        ? "bg-rose-600 hover:bg-rose-700 shadow-xs"
                        : "btn-tactile bg-[#ef4444] shadow-ink-xs"
                    }`}
                  >
                    Tutup Shift &amp; Rekonsiliasi ✓
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOpenShift} className="space-y-3 font-sans">
                <div className="space-y-1 font-mono">
                  <label className={`block font-bold ${isMochiPos ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                    Modal Awal Uang Kembalian (Rp):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={10000}
                    value={shiftOpeningCashInput}
                    onChange={(e) => setShiftOpeningCashInput(Number(e.target.value))}
                    className={`w-full rounded-xl border-2 p-2.5 text-base font-black ${
                      isMochiPos ? "border-[#0b3d2e] text-[#0b3d2e]" : "border-[#232331] text-[#232331]"
                    }`}
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className={`rounded-xl px-5 py-2 font-black disabled:opacity-50 transition-all ${
                      isMochiPos
                        ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-xs"
                        : "btn-tactile bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                    }`}
                  >
                    Buka Shift Sekarang ✓
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      <TableQrModal
        isOpen={showTableQrModal}
        onClose={() => setShowTableQrModal(false)}
        storeCode={business?.store_code || "MOCHIKAFE"}
        storeName={business?.name || "Mochi Cafe n Resto"}
        isMochi={isMochiPos}
      />

      <PosMemberScannerModal
        isOpen={showMemberScannerModal}
        onClose={() => setShowMemberScannerModal(false)}
        onSelectCustomer={(cust) => setAttachedCustomer(cust)}
        isMochiPos={isMochiPos}
      />

      <PosBellSettingsModal
        isOpen={showBellModal}
        onClose={() => setShowBellModal(false)}
        isMochi={isMochiPos}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        voiceEnabled={voiceEnabled}
        onToggleVoice={handleToggleVoice}
        printerBuzzerEnabled={printerBuzzerEnabled}
        onTogglePrinterBuzzer={handleTogglePrinterBuzzer}
        staffWhatsapp={staffWhatsapp}
        onSaveStaffWhatsapp={handleSaveStaffWhatsapp}
      />

    </div>
  );
}

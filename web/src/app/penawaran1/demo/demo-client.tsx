"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Megaphone,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Star,
  Users,
  WalletCards,
} from "lucide-react";

type Tab =
  | "ringkas"
  | "kasir"
  | "uang"
  | "kantong"
  | "stok"
  | "harga"
  | "promosi"
  | "member"
  | "review";
type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
};
type PaymentMethod = "Tunai" | "QRIS" | "Transfer";
type Receipt = {
  id: string;
  subtotal: number;
  items: Array<{ name: string; qty: number; price: number }>;
  member: string;
  earned: number;
  payment: PaymentMethod;
  createdAt: string;
};
type DemoData = {
  shop: string;
  stock: Record<string, number>;
  sales: number;
  points: number;
  expenses: Array<{ name: string; amount: number }>;
  pockets: Record<string, string>;
  calc: Record<string, string>;
  promo: Record<string, string>;
  lastReceipt: Receipt | null;
  reviewTapCount: number;
};
const products: Product[] = [
  {
    id: "pashmina",
    name: "Pashmina Ceruty",
    price: 49_000,
    cost: 25_000,
    stock: 24,
  },
  {
    id: "segiempat",
    name: "Hijab Segi Empat",
    price: 39_000,
    cost: 18_000,
    stock: 31,
  },
  { id: "inner", name: "Inner Ninja", price: 22_000, cost: 9_000, stock: 18 },
  { id: "bros", name: "Bros Premium", price: 18_000, cost: 6_000, stock: 40 },
];
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const number = (value: string) => Number(value.replace(/\D/g, "") || 0);
const storageKey = "kael-penawaran1-demo-v2";
const initialData = (): DemoData => ({
  shop: "Toko Hijab Saya",
  stock: Object.fromEntries(products.map((item) => [item.id, item.stock])),
  sales: 0,
  points: 8,
  expenses: [
    { name: "Ongkir supplier", amount: 35_000 },
    { name: "Packing", amount: 12_000 },
    { name: "Iklan", amount: 25_000 },
  ],
  pockets: {
    stok: "45",
    operasional: "20",
    promosi: "10",
    owner: "15",
    cadangan: "10",
  },
  calc: {
    cost: "25000",
    packaging: "1500",
    fee: "2500",
    price: "49000",
    qty: "5",
  },
  promo: { cost: "100000", sales: "350000" },
  lastReceipt: null,
  reviewTapCount: 24,
});

export default function DemoClient() {
  const [data, setData] = useState<DemoData>(initialData);
  const [tab, setTab] = useState<Tab>("ringkas");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [member, setMember] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("QRIS");
  const [notice, setNotice] = useState("");
  const [expense, setExpense] = useState({ name: "", amount: "" });
  const [restock, setRestock] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setData({ ...initialData(), ...JSON.parse(saved) });
    } catch {
      /* A broken browser storage entry should not block the demo. */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, hydrated]);

  const {
    shop,
    stock,
    sales,
    points,
    expenses,
    pockets,
    calc,
    promo,
    lastReceipt,
    reviewTapCount,
  } = data;
  const updateData = (next: Partial<DemoData>) =>
    setData((current) => ({ ...current, ...next }));
  const setPockets = (pockets: Record<string, string>) =>
    updateData({ pockets });
  const setCalc = (calc: Record<string, string>) => updateData({ calc });
  const setPromo = (promo: Record<string, string>) => updateData({ promo });

  const items = products.filter((item) => cart[item.id]);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * cart[item.id],
    0,
  );
  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const revenue = 182_000 + sales;
  const gross = Math.round(revenue * 0.42);
  const net = gross - expensesTotal;
  const stockValue = products.reduce(
    (sum, item) => sum + item.cost * (stock[item.id] || 0),
    0,
  );
  const hpp = number(calc.cost) + number(calc.packaging) + number(calc.fee);
  const unitProfit = number(calc.price) - hpp;
  const dayProfit = unitProfit * number(calc.qty);
  const pocketTotal = Object.values(pockets).reduce(
    (sum, value) => sum + number(value),
    0,
  );
  const promoProfit =
    Math.round(number(promo.sales) * 0.42) - number(promo.cost);

  const setQty = (id: string, delta: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(stock[id] || 0, (current[id] || 0) + delta)),
    }));
  const pay = () => {
    if (!subtotal)
      return setNotice("Pilih minimal satu produk sebelum membayar.");
    if (items.some((item) => (cart[item.id] || 0) > (stock[item.id] || 0)))
      return setNotice(
        "Stok tidak cukup. Kurangi jumlah produk terlebih dahulu.",
      );
    const earned = member.trim() ? Math.floor(subtotal / 10_000) : 0;
    const receipt: Receipt = {
      id: `DM-${String(Date.now()).slice(-6)}`,
      subtotal,
      items: items.map((item) => ({
        name: item.name,
        qty: cart[item.id],
        price: item.price,
      })),
      member: member.trim(),
      earned,
      payment,
      createdAt: new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    };
    updateData({
      sales: sales + subtotal,
      stock: Object.fromEntries(
        products.map((item) => [
          item.id,
          (stock[item.id] || 0) - (cart[item.id] || 0),
        ]),
      ),
      points: points + earned,
      lastReceipt: receipt,
    });
    setCart({});
    setNotice(
      `Pembayaran ${payment} berhasil. Stok, kas, dan poin member sudah diperbarui.`,
    );
  };
  const addExpense = () => {
    if (!expense.name.trim() || !number(expense.amount))
      return setNotice("Isi nama biaya dan nominalnya dulu.");
    updateData({
      expenses: [
        ...expenses,
        { name: expense.name.trim(), amount: number(expense.amount) },
      ],
    });
    setExpense({ name: "", amount: "" });
    setNotice("Biaya dicatat. Ringkasan uang dan untung ikut berubah.");
  };
  const addStock = (id: string) => {
    const qty = number(restock[id] || "");
    if (!qty) return setNotice("Masukkan jumlah stok yang ingin ditambah.");
    updateData({ stock: { ...stock, [id]: (stock[id] || 0) + qty } });
    setRestock((current) => ({ ...current, [id]: "" }));
    setNotice("Stok masuk sudah dicatat. Nilai stok ikut bertambah.");
  };
  const redeem = () => {
    if (points < 10)
      return setNotice(
        `Poin ${member || "member"} belum cukup. Butuh ${10 - points} poin lagi untuk reward contoh.`,
      );
    updateData({ points: points - 10 });
    setNotice("Reward potongan Rp10.000 berhasil ditukar pada demo ini.");
  };
  const submitFeedback = () => {
    if (!rating) return setNotice("Pilih rating pengalaman dulu.");
    if (rating <= 3 && !feedback.trim())
      return setNotice(
        "Tulis sedikit masukan agar tim usaha bisa menindaklanjuti.",
      );
    setNotice(
      rating <= 3
        ? "Masukan sudah diterima untuk ditindaklanjuti tim usaha."
        : "Terima kasih. Pelanggan tetap bebas membagikan pengalaman mereka di Google.",
    );
    setFeedback("");
  };
  const simulateReviewTap = () => {
    updateData({ reviewTapCount: reviewTapCount + 1 });
    setNotice(
      "Tap kartu tercatat. Lanjutkan dengan memilih rating untuk mencoba alur feedback.",
    );
  };
  const resetDemo = () => {
    setData(initialData());
    setCart({});
    setMember("");
    setPayment("QRIS");
    setRestock({});
    setRating(0);
    setFeedback("");
    window.localStorage.removeItem(storageKey);
    setNotice("Demo dikembalikan ke data awal.");
  };

  return (
    <main className="kael-demo min-h-screen bg-[#f7f6fc] pb-20 text-[#232331] sm:pb-24">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/penawaran1"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#232331]"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold text-[#7958d8]">
              DEMO INTERAKTIF KAEL
            </p>
            <input
              value={shop}
              onChange={(e) => updateData({ shop: e.target.value })}
              aria-label="Nama usaha demo"
              className="w-full truncate bg-transparent text-base font-black outline-none"
            />
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[#232331] bg-white"
            title="Ulangi demo dari awal"
            aria-label="Ulangi demo dari awal"
          >
            <RotateCcw size={15} />
          </button>
          <span className="rounded-lg border border-[#b45309] bg-[#fff7ed] px-2 py-1 font-mono text-[10px] font-bold text-[#9a3412]">
            SIMULASI
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <section className="demo-hero rounded-2xl border-2 border-[#232331] bg-[#232331] p-5 text-white shadow-ink-md">
          <p className="font-mono text-[10px] font-bold text-[#d9ff57]">
            COBA SENDIRI
          </p>
          <h1 className="mt-1 text-2xl font-black">
            Operasional lengkap untuk {shop}.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Mulai dari penjualan, kas, pembagian uang, stok, harga, promosi,
            member, sampai kartu review. Semua angka contoh hanya hidup di
            halaman ini.
          </p>
        </section>
        <nav
          className="demo-nav mt-4 flex gap-2 overflow-x-auto pb-1"
          aria-label="Layanan demo"
        >
          {(
            [
              { key: "ringkas", label: "Ringkas", icon: BarChart3 },
              { key: "kasir", label: "Kasir", icon: ShoppingBag },
              { key: "uang", label: "Uang", icon: WalletCards },
              { key: "kantong", label: "Kantong", icon: WalletCards },
              { key: "stok", label: "Stok", icon: PackageSearch },
              { key: "harga", label: "Harga", icon: Calculator },
              { key: "promosi", label: "Promosi", icon: Megaphone },
              { key: "member", label: "Member", icon: Users },
              { key: "review", label: "Review", icon: Star },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex min-h-16 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-[#232331] px-2 text-xs font-black ${tab === item.key ? "bg-[#d9ff57]" : "bg-white"}`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-[#15803d] bg-[#dcfce7] p-3 text-sm font-bold text-[#166534]"
          >
            {notice}
          </div>
        )}

        {tab === "ringkas" && (
          <section className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Penjualan hari ini"
                value={money(revenue)}
                hint="dari POS dan order"
              />
              <Metric
                label="Untung setelah biaya"
                value={money(net)}
                hint={net >= 0 ? "masih aman" : "perlu diperbaiki"}
                good={net >= 0}
              />
              <Metric
                label="Nilai stok tersisa"
                value={money(stockValue)}
                hint="modal masih berbentuk barang"
              />
              <Metric
                label="Biaya tercatat"
                value={money(expensesTotal)}
                hint="hari ini"
              />
            </div>
            <section className="rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
              <h2 className="text-lg font-black">
                Apa yang perlu diperhatikan hari ini
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Tip
                  title="Kas belum tentu untung"
                  text={`Dari ${money(revenue)} penjualan, biaya ${money(expensesTotal)} harus ikut dihitung.`}
                />
                <Tip
                  title="Modal ada di stok"
                  text={`Masih ada ${money(stockValue)} modal yang belum berubah menjadi uang tunai.`}
                />
                <Tip
                  title="Langkah berikutnya"
                  text="Coba buat transaksi di Kasir, lalu lihat stok dan kas ikut bergerak."
                />
              </div>
            </section>
          </section>
        )}

        {tab === "kasir" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <Panel title="KAEL POS · pilih produk">
              <p className="mb-3 text-sm text-[#66667a]">
                Ketuk produk untuk menambahkannya ke keranjang.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setQty(item.id, 1)}
                    disabled={!stock[item.id]}
                    className="rounded-xl border-2 border-[#232331] bg-[#f7f6fc] p-4 text-left disabled:opacity-50"
                  >
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#7958d8]">
                      {money(item.price)}
                    </p>
                    <p
                      className={`mt-2 text-xs font-bold ${(stock[item.id] || 0) < 5 ? "text-[#b91c1c]" : "text-[#66667a]"}`}
                    >
                      Stok tersisa: {stock[item.id] || 0}
                    </p>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Keranjang dan pembayaran">
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-[#dedee8] pb-2"
                  >
                    <span>
                      <b className="text-sm">{item.name}</b>
                      <small className="block text-xs text-[#66667a]">
                        {money(item.price)}
                      </small>
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQty(item.id, -1)}
                        className="icon"
                        aria-label={`Kurangi ${item.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <b className="w-5 text-center">{cart[item.id]}</b>
                      <button
                        type="button"
                        onClick={() => setQty(item.id, 1)}
                        className="icon"
                        aria-label={`Tambah ${item.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    </span>
                  </div>
                ))}
                {!items.length && (
                  <Empty text="Pilih produk untuk mulai transaksi." />
                )}
              </div>
              <label className="mt-4 block text-xs font-bold">
                Nama atau nomor member
                <input
                  value={member}
                  onChange={(e) => setMember(e.target.value)}
                  placeholder="Opsional, contoh: Dinda"
                  className="field"
                />
              </label>
              <fieldset className="mt-3">
                <legend className="text-xs font-bold">Cara bayar</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["Tunai", "QRIS", "Transfer"] as PaymentMethod[]).map(
                    (method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPayment(method)}
                        className={`min-h-10 rounded-lg border-2 border-[#232331] text-xs font-black ${payment === method ? "bg-[#d9ff57]" : "bg-white"}`}
                      >
                        {method}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
              <div className="mt-4 border-t-2 border-[#232331] pt-3">
                <p className="flex justify-between font-black">
                  <span>Total</span>
                  <span>{money(subtotal)}</span>
                </p>
                <button
                  type="button"
                  onClick={pay}
                  disabled={!subtotal}
                  className="primary w-full"
                >
                  <ReceiptText size={17} />
                  Bayar dengan {payment}
                </button>
              </div>
              {lastReceipt && (
                <div className="mt-4 rounded-xl border border-[#7958d8] bg-[#f0edff] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <b>Struk terakhir {lastReceipt.id}</b>
                    <span className="text-xs">{lastReceipt.createdAt}</span>
                  </div>
                  <p className="mt-1">
                    {lastReceipt.items
                      .map((item) => `${item.qty}x ${item.name}`)
                      .join(", ")}
                  </p>
                  <p className="mt-2 font-black">
                    {money(lastReceipt.subtotal)} · {lastReceipt.payment}
                  </p>
                  {lastReceipt.member && (
                    <p className="mt-1 text-xs">
                      {lastReceipt.earned} poin masuk ke {lastReceipt.member}
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </section>
        )}

        {tab === "uang" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Panel title="Kas dan arus uang hari ini">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="Uang masuk"
                  value={money(revenue)}
                  hint="penjualan"
                />
                <Metric
                  label="Uang keluar"
                  value={money(expensesTotal)}
                  hint="biaya tercatat"
                />
                <Metric
                  label="Sisa kas contoh"
                  value={money(revenue - expensesTotal)}
                  hint="belum termasuk stok"
                  good
                />
                <Metric
                  label="Laba kotor"
                  value={money(gross)}
                  hint="sebelum biaya"
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#66667a]">
                Uang berkurang tidak selalu berarti rugi. Bisa berubah jadi
                stok, keluar untuk biaya, atau masih berupa tagihan yang belum
                masuk.
              </p>
            </Panel>
            <Panel title="Catat uang keluar">
              <div className="space-y-2">
                {expenses.map((item) => (
                  <div
                    key={`${item.name}-${item.amount}`}
                    className="flex justify-between rounded-xl border border-[#dedee8] p-3 text-sm"
                  >
                    <span>{item.name}</span>
                    <b className="text-[#b91c1c]">-{money(item.amount)}</b>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <input
                  value={expense.name}
                  onChange={(e) =>
                    setExpense({ ...expense, name: e.target.value })
                  }
                  placeholder="Nama biaya"
                  className="field"
                />
                <input
                  value={expense.amount}
                  onChange={(e) =>
                    setExpense({
                      ...expense,
                      amount: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="Nominal"
                  inputMode="numeric"
                  className="field"
                />
                <button
                  type="button"
                  onClick={addExpense}
                  className="primary mt-1"
                >
                  Catat
                </button>
              </div>
            </Panel>
          </section>
        )}

        {tab === "kantong" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Panel title="Pembagian uang bisnis">
              <p className="text-sm text-[#66667a]">
                Bagi uang penjualan sebelum dipakai agar modal stok dan biaya
                penting tidak ikut habis.
              </p>
              <div className="mt-4 space-y-2">
                {Object.entries(pockets).map(([key, value]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#dedee8] p-3 text-sm font-bold"
                  >
                    <span>
                      {
                        (
                          {
                            stok: "Belanja stok",
                            operasional: "Biaya operasional",
                            promosi: "Promosi",
                            owner: "Jatah pemilik",
                            cadangan: "Dana cadangan",
                          } as Record<string, string>
                        )[key]
                      }
                    </span>
                    <span className="flex items-center gap-2">
                      <input
                        value={value}
                        onChange={(e) =>
                          setPockets({
                            ...pockets,
                            [key]: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        inputMode="numeric"
                        className="w-14 rounded-lg border border-[#232331] p-2 text-right"
                      />
                      %
                    </span>
                  </label>
                ))}
              </div>
              <p
                className={`mt-3 text-sm font-bold ${pocketTotal === 100 ? "text-[#166534]" : "text-[#b91c1c]"}`}
              >
                Total pembagian: {pocketTotal}%{" "}
                {pocketTotal === 100 ? "· siap dipakai" : "· harus tepat 100%"}
              </p>
            </Panel>
            <Panel title="Nominal yang perlu diamankan">
              {Object.entries(pockets).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between border-b border-[#dedee8] py-3 text-sm"
                >
                  <span>
                    {
                      (
                        {
                          stok: "Belanja stok",
                          operasional: "Operasional",
                          promosi: "Promosi",
                          owner: "Jatah pemilik",
                          cadangan: "Cadangan",
                        } as Record<string, string>
                      )[key]
                    }
                  </span>
                  <b>
                    {money(
                      Math.round(
                        ((revenue - expensesTotal) * number(value)) / 100,
                      ),
                    )}
                  </b>
                </div>
              ))}
              <p className="mt-4 rounded-xl bg-[#f0edff] p-3 text-xs leading-5">
                Nominal ini mengikuti uang tersisa pada demo. Ubah penjualan
                atau biaya untuk melihat pembagian ikut menyesuaikan.
              </p>
            </Panel>
          </section>
        )}

        {tab === "stok" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <Panel title="Stok hijab dan modal tertahan">
              <p className="mb-3 text-sm text-[#66667a]">
                Tambah stok masuk untuk mencoba proses kulak. Data langsung
                tersimpan di sesi demo ini.
              </p>
              <div className="space-y-2">
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#dedee8] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{item.name}</b>
                        <small className="mt-1 block text-xs text-[#66667a]">
                          Modal {money(item.cost)} per barang
                        </small>
                      </span>
                      <span
                        className={`rounded-lg px-2 py-1 text-sm font-black ${(stock[item.id] || 0) < 5 ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#dcfce7] text-[#166534]"}`}
                      >
                        {stock[item.id] || 0} stok
                      </span>
                      <b>{money((stock[item.id] || 0) * item.cost)}</b>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={restock[item.id] || ""}
                        onChange={(e) =>
                          setRestock((current) => ({
                            ...current,
                            [item.id]: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        inputMode="numeric"
                        placeholder="Jumlah masuk"
                        className="field !mt-0"
                      />
                      <button
                        type="button"
                        onClick={() => addStock(item.id)}
                        className="secondary shrink-0"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Keputusan stok">
              <Metric
                label="Nilai stok tersisa"
                value={money(stockValue)}
                hint="uang yang masih berupa barang"
              />
              <div className="mt-4 space-y-2">
                <Tip
                  title="Stok menipis"
                  text={
                    products.some((item) => (stock[item.id] || 0) < 5)
                      ? "Ada produk di bawah 5. Pertimbangkan kulak ulang."
                      : "Belum ada stok kritis."
                  }
                />
                <Tip
                  title="Alur tersambung"
                  text="Pembayaran di Kasir mengurangi stok. Tambah stok di sini untuk mencatat barang yang datang."
                />
              </div>
            </Panel>
          </section>
        )}

        {tab === "harga" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_.85fr]">
            <Panel title="Kalkulator harga jual">
              <p className="text-sm text-[#66667a]">
                Masukkan semua biaya yang melekat pada satu barang, bukan hanya
                harga beli.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "cost", label: "Harga beli" },
                    { key: "packaging", label: "Kemasan" },
                    { key: "fee", label: "Fee marketplace" },
                    { key: "price", label: "Harga jual" },
                    { key: "qty", label: "Target laku/hari" },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="text-xs font-bold">
                    {field.label}
                    <input
                      value={calc[field.key]}
                      onChange={(e) =>
                        setCalc({
                          ...calc,
                          [field.key]: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      inputMode="numeric"
                      className="field"
                    />
                  </label>
                ))}
              </div>
            </Panel>
            <div className="space-y-3">
              <Metric
                label="Modal per barang"
                value={money(hpp)}
                hint="barang + kemasan + fee"
              />
              <Metric
                label="Untung per barang"
                value={money(unitProfit)}
                hint={
                  unitProfit >= 0 ? "harga masih aman" : "harga di bawah modal"
                }
                good={unitProfit >= 0}
              />
              <Metric
                label="Perkiraan untung per hari"
                value={money(dayProfit)}
                hint={`${number(calc.qty)} barang terjual`}
                good
              />
              <Metric
                label="Perkiraan untung 30 hari"
                value={money(dayProfit * 30)}
                hint="sebelum biaya tetap"
                good
              />
            </div>
          </section>
        )}

        {tab === "promosi" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Panel title="Cek hasil promosi">
              <p className="text-sm text-[#66667a]">
                Iklan ramai belum tentu untung. Bandingkan biaya iklan dengan
                penjualan yang benar-benar datang darinya.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">
                  Biaya iklan
                  <input
                    value={promo.cost}
                    onChange={(e) =>
                      setPromo({
                        ...promo,
                        cost: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    inputMode="numeric"
                    className="field"
                  />
                </label>
                <label className="text-xs font-bold">
                  Penjualan dari iklan
                  <input
                    value={promo.sales}
                    onChange={(e) =>
                      setPromo({
                        ...promo,
                        sales: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    inputMode="numeric"
                    className="field"
                  />
                </label>
              </div>
            </Panel>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="ROAS"
                value={`${(number(promo.sales) / Math.max(1, number(promo.cost))).toFixed(1)}x`}
                hint="penjualan : iklan"
                good
              />
              <Metric
                label="Untung setelah iklan"
                value={money(promoProfit)}
                hint="estimasi margin 42%"
                good={promoProfit >= 0}
              />
              <Metric
                label="Keputusan"
                value={promoProfit >= 0 ? "Lanjut uji" : "Perbaiki iklan"}
                hint={
                  promoProfit >= 0 ? "tetap cek stok" : "cek harga atau target"
                }
              />
            </div>
          </section>
        )}

        {tab === "member" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="KAEL Loyalty">
              <h2 className="text-lg font-black">
                Pelanggan punya alasan untuk kembali
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#66667a]">
                Contoh aturan: setiap belanja Rp10.000 mendapat 1 poin. Nama
                member yang diisi di Kasir akan tampil pada kartu ini.
              </p>
              <button
                type="button"
                onClick={() => setTab("kasir")}
                className="primary"
              >
                Buat transaksi member <ChevronRight size={16} />
              </button>
            </Panel>
            <Panel title="Kartu member digital">
              <div className="flex justify-between">
                <span>
                  <p className="font-mono text-[10px] font-bold text-[#7958d8]">
                    MEMBER
                  </p>
                  <h2 className="text-lg font-black">
                    {member || lastReceipt?.member || "Dinda"}
                  </h2>
                </span>
                <CreditCard size={30} />
              </div>
              <p className="mt-8 text-4xl font-black text-[#7958d8]">
                {points} <span className="text-base text-[#232331]">poin</span>
              </p>
              <p className="mt-2 text-sm text-[#66667a]">
                Tukar 10 poin untuk reward potongan Rp10.000.
              </p>
              <button type="button" onClick={redeem} className="secondary mt-4">
                Tukar reward contoh
              </button>
            </Panel>
          </section>
        )}

        {tab === "review" && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Panel title="KAEL Review NFC">
              <h2 className="text-lg font-black">Coba alur kartu review</h2>
              <p className="mt-2 text-sm leading-6 text-[#66667a]">
                Pilih rating seperti pelanggan. Bila ada keluhan, masukan
                dikumpulkan lebih dulu. Akses Google tetap tersedia untuk semua
                rating.
              </p>
              <button
                type="button"
                onClick={simulateReviewTap}
                className="secondary mt-4"
              >
                <Star size={15} /> Simulasikan tap kartu
              </button>
              <fieldset className="mt-4 flex gap-1">
                <legend className="sr-only">Pilih rating</legend>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setRating(value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#232331] ${rating >= value ? "bg-[#d9ff57]" : "bg-white"}`}
                    aria-label={`${value} bintang`}
                  >
                    <Star
                      size={18}
                      fill={rating >= value ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </fieldset>
              {rating > 0 && (
                <>
                  <p className="mt-3 text-sm font-bold">
                    {rating <= 3
                      ? "Ada yang belum nyaman? Ceritakan ke kami."
                      : "Terima kasih. Ceritakan pengalaman Anda dengan kata-kata sendiri."}
                  </p>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={
                      rating <= 3
                        ? "Contoh: pesanan saya datang terlalu lama"
                        : "Contoh: pelayanan yang paling berkesan"
                    }
                    className="field min-h-24 resize-y"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={submitFeedback}
                      className="primary"
                    >
                      Kirim masukan
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary mt-4"
                    >
                      Buka Google Maps <ExternalLink size={14} />
                    </a>
                  </div>
                </>
              )}
            </Panel>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Tap minggu ini"
                value={String(reviewTapCount)}
                hint="interaksi kartu"
              />
              <Metric
                label="Rating Google"
                value="4,8 / 5"
                hint="contoh snapshot"
                good
              />
              <Metric label="Ulasan baru" value="+6" hint="periode ini" good />
            </div>
          </section>
        )}

        <section className="mt-5 rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black">
                Demo ini sudah mendekati alur bisnis asli.
              </p>
              <p className="mt-1 text-sm text-[#66667a]">
                Kami bisa personalisasi nama, logo, produk, harga, serta alur
                usaha mereka sebelum sesi demo.
              </p>
            </div>
            <Link
              href="/penawaran1#audit"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#232331] bg-[#7958d8] px-4 text-sm font-black text-white"
            >
              Lanjut konsultasi <ChevronRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="demo-panel rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
      <p className="font-mono text-[10px] font-bold text-[#7958d8]">
        KAEL DEMO
      </p>
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Metric({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  good?: boolean;
}) {
  return (
    <div
      className={`demo-metric rounded-2xl border-2 border-[#232331] p-4 shadow-ink-xs ${good ? "bg-[#dcfce7]" : "bg-white"}`}
    >
      <p className="font-mono text-[10px] font-bold text-[#7958d8]">{label}</p>
      <p className={`mt-2 text-xl font-black ${good ? "text-[#166534]" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-[#66667a]">{hint}</p>
    </div>
  );
}
function Tip({ title, text }: { title: string; text: string }) {
  return (
    <div className="demo-tip rounded-xl border border-[#dedee8] bg-[#f7f6fc] p-3">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#66667a]">{text}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-[#f7f6fc] p-4 text-sm text-[#66667a]">{text}</p>
  );
}

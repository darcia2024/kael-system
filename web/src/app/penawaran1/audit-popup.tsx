"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, X } from "lucide-react";

const whatsappNumber = "6281311506025";

const auditQuestions = [
  {
    question: "Sekarang pencatatan uang masuk dan keluar pakai apa?",
    helper: "Contoh: buku, notes HP, Excel, aplikasi kasir, atau belum dicatat.",
    placeholder: "Contoh: masih pakai notes HP, kadang dicatat, atau belum dicatat...",
  },
  {
    question: "Uang bisnis dan uang pribadi sudah dipisah atau masih campur?",
    helper: "Ini penting supaya uang untuk beli stok tidak kepakai untuk kebutuhan lain.",
    placeholder: "Contoh: masih satu rekening, sudah beda rekening, atau sebagian masih campur...",
  },
  {
    question: "Ada catatan stok hijab per model dan warna?",
    helper: "Setiap warna dan model bisa punya tingkat laku yang berbeda.",
    placeholder: "Contoh: dicatat manual, cuma diingat, atau belum ada catatan stok...",
  },
  {
    question: "Kalau modal terasa berkurang, biasanya uangnya keluar untuk apa?",
    helper: "Bisa untuk beli stok, biaya harian, promosi, atau ada uang yang belum dibayar customer.",
    placeholder: "Tulis pengeluaran yang paling sering terasa besar...",
  },
  {
    question: "Saat menentukan harga jual, biaya apa saja yang sudah dihitung?",
    helper: "Selain harga beli hijab, biasanya ada ongkir, plastik atau box, admin marketplace, diskon, dan iklan.",
    placeholder: "Contoh: baru hitung harga beli, sudah hitung ongkir, belum hitung biaya marketplace...",
  },
  {
    question: "Jualannya paling banyak lewat mana?",
    helper: "Cara jualan menentukan sistem pencatatan yang paling cocok.",
    placeholder: "Contoh: WhatsApp, Shopee, Tokopedia, Instagram, offline, reseller, atau campuran...",
  },
  {
    question: "Ada transaksi yang sudah laku tapi belum dibayar?",
    helper: "Ini untuk melihat apakah penjualan terlihat banyak, tapi uangnya belum benar-benar masuk.",
    placeholder: "Contoh: ada COD, reseller bayar belakangan, atau semua langsung lunas...",
  },
  {
    question: "Pernah cek untung setelah diskon atau iklan?",
    helper: "Kadang produk ramai terjual, tapi untungnya habis karena diskon atau biaya iklan.",
    placeholder: "Tulis pengalaman kakak soal diskon, iklan, endorse, atau promo...",
  },
];

function buildWhatsAppLink(answers: string[]) {
  const lines = [
    "Halo KAEL, saya mau audit ringan untuk bisnis hijab saya.",
    "",
    "Ini jawaban awal saya:",
    ...auditQuestions.flatMap((item, index) => [
      "",
      `${index + 1}. ${item.question}`,
      answers[index]?.trim() || "Belum dijawab",
    ]),
  ];

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

type AuditPopupProps = {
  variant?: "hero" | "compact" | "section";
};

export function AuditPopup({ variant = "hero" }: AuditPopupProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => auditQuestions.map(() => ""));
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const current = auditQuestions[step];
  const isLast = step === auditQuestions.length - 1;
  const answeredCount = answers.filter((answer) => answer.trim().length > 0).length;
  const progress = Math.round(((step + 1) / auditQuestions.length) * 100);

  const whatsappHref = useMemo(() => buildWhatsAppLink(answers), [answers]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => textareaRef.current?.focus(), 50);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function updateAnswer(value: string) {
    setAnswers((prev) => prev.map((answer, index) => (index === step ? value : answer)));
  }

  function openAudit() {
    setOpen(true);
    setStep(0);
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        onClick={openAudit}
        className="btn-tactile inline-flex min-h-10 items-center gap-1.5 rounded-[9px] bg-[#d9ff57] px-3 text-[11px] font-extrabold text-[#232331] sm:min-h-11 sm:gap-2 sm:rounded-[10px] sm:px-4 sm:text-xs"
      >
        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
        <span className="hidden sm:inline">Isi Audit</span>
        <span className="sm:hidden">Audit</span>
      </button>
    ) : variant === "section" ? (
      <button
        type="button"
        onClick={openAudit}
        className="btn-tactile mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#d9ff57] px-4 text-xs font-extrabold text-[#232331] sm:mt-6 sm:min-h-[52px] sm:rounded-[12px] sm:px-6 sm:text-sm"
      >
        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
        Isi pertanyaan audit
      </button>
    ) : (
      <button
        type="button"
        onClick={openAudit}
        className="btn-tactile inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#232331] px-4 text-xs font-extrabold text-white sm:min-h-[52px] sm:rounded-[12px] sm:px-6 sm:text-sm"
      >
        <MessageCircle className="h-3.5 w-3.5 text-[#d9ff57] sm:h-4 sm:w-4" strokeWidth={2.5} />
        Mulai jawab audit
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#232331]/50 px-2 py-2 sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-modal="true"
            role="dialog"
            aria-labelledby="audit-title"
            className="max-h-[calc(100dvh-16px)] w-full max-w-[720px] overflow-y-auto rounded-[14px] border-[1.5px] border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-lg sm:max-h-[calc(100dvh-48px)] sm:rounded-[18px] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#dedee8] pb-3 sm:gap-4 sm:pb-4">
              <div>
                <p className="font-mono text-[9px] font-bold text-[#7958d8] sm:text-[10px]">CEK KONDISI BISNIS</p>
                <h2 id="audit-title" className="mt-1 text-base font-extrabold tracking-tight text-[#232331] sm:text-2xl">
                  Jawab pelan-pelan. Nanti jawabannya langsung rapi ke WhatsApp.
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup audit"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-[#232331] bg-white text-[#232331] shadow-ink-xs sm:h-11 sm:w-11 sm:rounded-[10px]"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="mt-3 sm:mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-extrabold text-[#232331] sm:text-xs">
                  Pertanyaan {step + 1} dari {auditQuestions.length}
                </p>
                <p className="rounded-[8px] border border-[#dedee8] bg-white px-2.5 py-1 text-[11px] font-bold text-[#4c4c5f] sm:px-3 sm:py-1.5 sm:text-xs">
                {answeredCount} sudah dijawab
                </p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-[8px] border-[1.5px] border-[#232331] bg-white sm:mt-3 sm:h-3">
                <div className="h-full bg-[#d9ff57]" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-3 rounded-[13px] border-[1.5px] border-[#232331] bg-[#f0edff] p-3 sm:mt-6 sm:rounded-[16px] sm:p-5">
              <h3 className="text-base font-extrabold leading-tight text-[#232331] sm:text-xl">{current.question}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#4c4c5f] sm:mt-2 sm:text-sm">{current.helper}</p>
              <textarea
                ref={textareaRef}
                value={answers[step]}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder={current.placeholder}
                rows={4}
                className="mt-3 w-full resize-y rounded-[10px] border-[1.5px] border-[#232331] bg-white p-3 text-xs font-semibold leading-relaxed text-[#232331] shadow-ink-xs outline-none placeholder:text-[#7b7b8e] focus:ring-2 focus:ring-[#7958d8] sm:mt-4 sm:rounded-[12px] sm:p-4 sm:text-sm"
              />
            </div>

            <div className="mt-3 grid gap-2.5 sm:mt-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-[#232331] bg-white px-3 text-[11px] font-extrabold text-[#232331] shadow-ink-xs disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-11 sm:rounded-[10px] sm:px-4 sm:text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                Sebelumnya
              </button>

              <p className="text-center text-[11px] font-bold leading-relaxed text-[#7b7b8e] sm:text-xs">
                Jawaban singkat tidak apa-apa. Yang penting KAEL tahu kondisi awalnya.
              </p>

              {isLast ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="btn-tactile inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-[#d9ff57] px-3 text-[11px] font-extrabold text-[#232331] sm:min-h-11 sm:rounded-[10px] sm:px-4 sm:text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                  Kirim ke WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.min(auditQuestions.length - 1, value + 1))}
                  className="btn-tactile inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-[#d9ff57] px-3 text-[11px] font-extrabold text-[#232331] sm:min-h-11 sm:rounded-[10px] sm:px-4 sm:text-xs"
                >
                  Lanjut
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

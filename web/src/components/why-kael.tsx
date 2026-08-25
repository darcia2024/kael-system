import { Layers, ShieldCheck, Sliders, TrendingUp, Zap } from "lucide-react";

import { Container, Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

const values = [
  {
    icon: Layers,
    title: "Modular Sesuai Kebutuhan",
    desc: "Ambil dan aktifkan modul yang relevan hari ini tanpa dipaksa membayar paket besar.",
  },
  {
    icon: Sliders,
    title: "Fleksibel Mengikuti Alur",
    desc: "Sistem menyesuaikan alur kerja unik operasional bisnis Anda, bukan sebaliknya.",
  },
  {
    icon: Zap,
    title: "Praktis Tanpa Ribet",
    desc: "Fokus menyelesaikan titik hambatan terbesar: review, kasir, pesanan, dan keuangan.",
  },
  {
    icon: ShieldCheck,
    title: "Tanpa Biaya Server Mahal",
    desc: "Semua sistem sudah siap pakai dan terkelola rapi tanpa perlu tim teknis khusus.",
  },
  {
    icon: TrendingUp,
    title: "Tumbuh Bersama Bisnis",
    desc: "Siap di-upgrade kapan pun cabang bertambah atau omzet usaha Anda berkembang.",
  },
];

export function WhyKael() {
  return (
    <Section className="border-b border-[#dce7e1] py-16 sm:py-24">
      <Container>
        <div className="max-w-[620px]">
          <Reveal>
            <p className="text-xs uppercase tracking-widest text-[#6d7e79]">
              Prinsip & Nilai Dasar
            </p>
            <h2 className="mt-3 text-2xl font-light tracking-[-0.04em] text-[#18352f] sm:text-4xl">
              Teknologi Harus Membantu, Bukan Menambah Beban.
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mt-4 text-sm font-normal leading-relaxed text-[#6d7e79] sm:text-base">
              Prinsip KAEL dibangun dari pengalaman nyata pemilik UMKM yang
              sering terjebak aplikasi enterprise rumit, mahal, dan tidak efisien.
            </p>
          </Reveal>
        </div>

        {/* 5 Value Pillar Cards */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {values.map((v, i) => {
            const Icon = v.icon;
            return (
              <Reveal key={v.title} delay={i * 0.04} className={i === 4 ? "sm:col-span-2 lg:col-span-1" : ""}>
                <div className="flex h-full flex-col justify-between rounded-[24px] border border-[#dce7e1] bg-white p-7 shadow-xs transition-all duration-200 hover:border-[#b8dfcf] hover:shadow-md">
                  <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#dff3e9] text-[#17795d]">
                      <Icon size={19} strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-6 text-base font-normal tracking-tight text-[#18352f]">
                      {v.title}
                    </h3>
                    <p className="mt-2 text-xs font-light leading-relaxed text-[#6d7e79]">
                      {v.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

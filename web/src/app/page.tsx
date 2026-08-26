import { Faq } from "@/components/faq";
import { FloatingCta } from "@/components/floating-cta";
import { Footer } from "@/components/footer";
import { ForBusiness } from "@/components/for-business";
import { Hero } from "@/components/hero";
import { MarqueeStrip } from "@/components/marquee-strip";
import { Nav } from "@/components/nav";
import { Packages } from "@/components/packages";
import { Problems } from "@/components/problems";
import { ProductSelector } from "@/components/product-selector";
import { RoiCalculator } from "@/components/roi-calculator";
import { ServiceMockups } from "@/components/service-mockups";
import { WhoWeAre } from "@/components/who-we-are";
import { faqs } from "@/lib/faq-data";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* 1. Hero: ChatJudge 3D Art Stage & Bold Typography */}
        <Hero />

        {/* 2. ChatJudge Proof Strip */}
        <MarqueeStrip />

        {/* 3. Live Interactive UI/UX Mockup Playground */}
        <ServiceMockups />

        {/* 4. Cara Kerja: ChatJudge Method Cards */}
        <WhoWeAre />

        {/* 5. Katalog Modul Tempur */}
        <ProductSelector />

        {/* 5. growth calculator: Interactive UMKM ROI & review simulator */}
        <RoiCalculator />

        {/* 6. Solusi per Jenis Usaha (Sectors) */}
        <ForBusiness />

        {/* 7. 4 Tantangan UMKM vs Solusi KAEL */}
        <Problems />

        {/* 8. Pilihan Paket Solusi Transparan */}
        <Packages />

        {/* 9. FAQ & Bantuan */}
        <Faq />
      </main>

      <Footer />
      <FloatingCta />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}

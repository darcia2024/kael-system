import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { Wordmark } from "@/components/wordmark";
import { cta } from "@/lib/site";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center bg-gradient-to-b from-blue-50/30 to-bg">
      <Container>
        <div className="max-w-[48ch]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-fg sm:text-4xl">
            Halaman tidak ditemukan
          </h1>
          <p className="mt-4 text-base leading-relaxed text-fg-muted sm:text-lg">
            Mungkin tautannya salah atau halaman sudah dipindahkan. Silakan
            kembali ke beranda untuk melihat ekosistem solusi KAEL.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <ButtonLink href="/" size="lg">
              Kembali ke Beranda
            </ButtonLink>
            <ButtonLink
              href={cta.consult.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
            >
              {cta.consult.label}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </main>
  );
}

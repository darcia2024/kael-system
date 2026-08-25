"use client";

import { useEffect } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { Wordmark } from "@/components/wordmark";
import { cta } from "@/lib/site";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center bg-gradient-to-b from-blue-50/30 to-bg">
      <Container>
        <div className="max-w-[48ch]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-fg sm:text-4xl">
            Ada kendala teknis
          </h1>
          <p className="mt-4 text-base leading-relaxed text-fg-muted sm:text-lg">
            Halaman mengalami kendala saat dimuat. Coba muat ulang sebentar lagi,
            atau hubungi kami langsung lewat WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-13 items-center justify-center rounded-xl bg-accent px-7 text-[15px] font-normal text-accent-fg shadow-sm shadow-accent/25 transition-all duration-200 hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
            >
              Muat Ulang
            </button>
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

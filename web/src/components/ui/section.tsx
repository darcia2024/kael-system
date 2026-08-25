import type { ReactNode } from "react";

/** Page container. One max width for the whole site. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

/** Vertical rhythm wrapper. VISUAL_DENSITY 4 -> py-20 / py-28. */
export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-20 sm:py-28 ${className}`}>
      {children}
    </section>
  );
}

/**
 * Minimalist category label above a headline (no badge, no emoticon).
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-3 text-xs font-normal uppercase tracking-[0.16em] text-[#6d7e79] ${className}`}
    >
      {children}
    </p>
  );
}

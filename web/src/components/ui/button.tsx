import type { AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "invert" | "invert-outline";

/**
 * No display utility here on purpose. Tailwind sorts utilities by its own
 * order, not by the order they appear in the class attribute, so a hardcoded
 * `inline-flex` would silently beat a `hidden` passed in via className. The
 * display utility comes from the `display` prop instead, so there is only ever
 * one unconditional display class on the element.
 */
const base =
  "items-center justify-center gap-2.5 whitespace-nowrap rounded-[15px] font-normal " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 " +
  "ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]";

/**
 * Contrast is checked per variant against the surface it is allowed to sit on.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-[#17795d] text-white hover:bg-[#12654e] shadow-[0_10px_22px_#17795d38]",
  outline:
    "border border-[#dce7e1] bg-white text-[#18352f] hover:bg-[#f7f6f1] hover:border-[#b8dfcf] shadow-2xs",
  invert:
    "bg-white text-[#18352f] hover:bg-[#f7f6f1] shadow-[0_10px_22px_#18352f1f]",
  "invert-outline":
    "border border-white/40 text-white hover:bg-white/10 hover:border-white/70",
};

const sizes = {
  md: "h-11 px-5 text-sm",
  lg: "min-h-[52px] px-7 text-[15px]",
} as const;

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  /** Display utilities, e.g. "hidden sm:inline-flex" for a breakpoint-gated CTA. */
  display?: string;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  display = "inline-flex",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={`${display} ${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Typographic wordmark matching the GoReview brand mark style: KAEL•
 */
export function Wordmark({
  descriptor,
  className = "",
}: {
  descriptor?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex items-baseline">
        <span className="text-2xl font-medium tracking-[-0.04em] leading-none text-[#2b2d42]">
          KAEL<span className="text-[#ef233c] ml-0.5">•</span>
        </span>
        {descriptor ? (
          <span className="ml-2 text-xs font-light tracking-wide leading-none text-[#8d99ae]">
            {descriptor}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const roundUpTo500 = (value: number) => (value <= 0 ? 0 : Math.ceil(value / 500) * 500);

export type BusinessCalculatorMode = "kuliner" | "retail" | "jasa";

export interface BusinessCalculatorInput {
  mode: BusinessCalculatorMode;
  direct_cost: number;
  supporting_cost: number;
  operational_cost: number;
  selling_price: number;
  discount_pct: number;
  payment_fee_pct: number;
  channel_fee_pct: number;
  tax_reserve_pct: number;
  target_margin_pct: number;
  monthly_fixed_cost: number;
  monthly_profit_target: number;
}

export interface BusinessCalculatorResult {
  cost_per_sale: number;
  discount_amount: number;
  payment_fee_amount: number;
  channel_fee_amount: number;
  tax_reserve_amount: number;
  total_deductions: number;
  profit_per_sale: number;
  margin_pct: number;
  markup_pct: number;
  recommended_price: number;
  target_unreachable: boolean;
  break_even_units: number | null;
  target_units: number | null;
  target_revenue: number | null;
}

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const percent = (value: number) => Math.min(100, nonNegative(value)) / 100;

/**
 * Kalkulator harga universal untuk kuliner, retail, dan jasa.
 *
 * Semua persentase dibebankan terhadap harga jual sebelum diskon. Ini membuat
 * estimasi konservatif untuk fee kanal yang biasanya dihitung dari nilai order.
 * Bila provider menghitung dari nilai setelah diskon, owner dapat memasukkan
 * persentase efektif yang terlihat di laporan provider.
 */
export function calculateBusinessPrice(input: BusinessCalculatorInput): BusinessCalculatorResult {
  const directCost = nonNegative(input.direct_cost);
  const supportingCost = nonNegative(input.supporting_cost);
  const operationalCost = nonNegative(input.operational_cost);
  const sellingPrice = nonNegative(input.selling_price);
  const discountRate = percent(input.discount_pct);
  const paymentFeeRate = percent(input.payment_fee_pct);
  const channelFeeRate = percent(input.channel_fee_pct);
  const taxReserveRate = percent(input.tax_reserve_pct);
  const targetMarginRate = percent(input.target_margin_pct);

  const costPerSale = directCost + supportingCost + operationalCost;
  const discountAmount = sellingPrice * discountRate;
  const paymentFeeAmount = sellingPrice * paymentFeeRate;
  const channelFeeAmount = sellingPrice * channelFeeRate;
  const taxReserveAmount = sellingPrice * taxReserveRate;
  const totalDeductions = discountAmount + paymentFeeAmount + channelFeeAmount + taxReserveAmount;
  const profitPerSale = sellingPrice - costPerSale - totalDeductions;
  const marginPct = sellingPrice > 0 ? (profitPerSale / sellingPrice) * 100 : 0;
  const markupPct = costPerSale > 0 ? (profitPerSale / costPerSale) * 100 : 0;

  const priceFactor = 1 - discountRate - paymentFeeRate - channelFeeRate - taxReserveRate - targetMarginRate;
  const targetUnreachable = priceFactor <= 0;
  const recommendedPrice = targetUnreachable ? 0 : roundUpTo500(costPerSale / priceFactor);

  const fixedCost = nonNegative(input.monthly_fixed_cost);
  const profitTarget = nonNegative(input.monthly_profit_target);
  const breakEvenUnits = profitPerSale > 0 ? Math.ceil(fixedCost / profitPerSale) : null;
  const targetUnits = profitPerSale > 0 ? Math.ceil((fixedCost + profitTarget) / profitPerSale) : null;

  return {
    cost_per_sale: costPerSale,
    discount_amount: discountAmount,
    payment_fee_amount: paymentFeeAmount,
    channel_fee_amount: channelFeeAmount,
    tax_reserve_amount: taxReserveAmount,
    total_deductions: totalDeductions,
    profit_per_sale: profitPerSale,
    margin_pct: marginPct,
    markup_pct: markupPct,
    recommended_price: recommendedPrice,
    target_unreachable: targetUnreachable,
    break_even_units: breakEvenUnits,
    target_units: targetUnits,
    target_revenue: targetUnits === null ? null : targetUnits * sellingPrice,
  };
}

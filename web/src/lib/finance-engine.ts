/**
 * KAEL System · KAEL Finance & HPP Calculation Engine (02 · KAEL Finance Bagian 5)
 * 
 * Mesin perhitungan murni HPP, Margin, Markup, dan Rekomendasi Harga Jual.
 * 
 * Formula:
 * - biaya_bahan   = SUM( (pack_price / pack_size) * qty ) untuk tiap bahan
 * - biaya_kemasan = SUM( cost ) per unit jadi (DI LUAR pembagian output_qty)
 * - total_modal   = biaya_bahan + operational_cost
 * - hpp_per_unit  = (total_modal / output_qty) + biaya_kemasan
 * - profit_unit   = selling_price - hpp_per_unit
 * - margin_pct    = (profit_unit / selling_price) * 100
 * - markup_pct    = (profit_unit / hpp_per_unit) * 100
 * - harga_rekomendasi = Math.ceil( (hpp_per_unit / (1 - target_margin/100)) / 500 ) * 500
 *
 * Dua keadaan yang TIDAK boleh disembunyikan, karena keduanya membuat angka
 * yang keluar terlihat lebih bagus dari kenyataannya:
 *
 *   1. Bahan yang tidak dikenali -> dicatat di `unknown_ingredient_ids`.
 *      Modal jadi terlalu murah, margin terlihat lebih besar, saran harga
 *      terlalu rendah. Pemilik warung memasang harga di bawah biaya.
 *   2. Target margin >= 100% -> `target_margin_unreachable`. Tidak ada harga
 *      yang memenuhinya; modalnya harus nol rupiah.
 */

export interface IngredientItem {
  id: string;
  name: string;
  pack_price: number; // Rupiah bulat
  pack_size: number;  // Isi per pack dalam base_unit
  base_unit: "gr" | "ml" | "pcs";
}

export interface RecipeIngredientItem {
  ingredient_id: string;
  qty: number; // dalam base_unit bahan
}

export interface RecipePackagingItem {
  id?: string;
  name: string;
  cost: number; // Rupiah per unit jadi
}

export interface RecipeCalculationInput {
  type: "olahan" | "kulakan";
  output_qty: number;         // Berapa porsi yang dihasilkan dari 1x batch masak
  operational_cost: number;   // Listrik/gas/tenaga per batch masak
  selling_price: number;      // Harga jual per porsi
  target_margin_pct?: number; // Target margin % (misal 60%)
  ingredients: RecipeIngredientItem[];
  packaging: RecipePackagingItem[];
}

export interface IngredientCostDetail {
  ingredientId: string;
  name: string;
  qty: number;
  base_unit: string;
  unitCost: number;       // Harga per 1 gr/ml/pcs
  subtotalCost: number;   // unitCost * qty
}

export interface RecipeHppResult {
  biaya_bahan: number;
  biaya_kemasan: number;
  operational_cost: number;
  total_modal_batch: number;
  hpp_per_unit: number;
  selling_price: number;
  profit_per_unit: number;
  margin_pct: number;
  markup_pct: number;
  target_margin_pct: number;
  is_under_target: boolean;
  /** 0 kalau targetnya mustahil (≥100%). Lihat `target_margin_unreachable`. */
  recommended_price_target_margin: number;
  /**
   * Target margin 100% berarti menjual dengan modal nol rupiah. Dulu keadaan
   * ini diam-diam mengembalikan modal apa adanya sebagai "saran harga", jadi
   * layar menyarankan jual di harga modal — untung nol — tanpa keterangan.
   * Sekarang keadaannya dinyatakan, dan yang memanggil wajib menanganinya.
   */
  target_margin_unreachable: boolean;
  ingredient_breakdown: IngredientCostDetail[];
  /**
   * Bahan yang ada di resep tapi tidak bisa dikenali (belum ada di master, atau
   * isi packnya nol sehingga harga satuannya tidak bisa dihitung).
   *
   * Kosong berarti seluruh biaya bahan sudah terhitung. Kalau tidak kosong,
   * `biaya_bahan` dan semua angka turunannya BELUM lengkap — modal terlihat
   * lebih murah dari yang sebenarnya, dan itu arah kesalahan yang paling
   * berbahaya untuk kalkulator harga jual. Yang memanggil wajib menampilkan
   * ini, bukan menyembunyikannya.
   */
  unknown_ingredient_ids: string[];
}

/**
 * Bulatkan ke atas ke kelipatan Rp 500 terdekat
 */
export function roundUpTo500(value: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value / 500) * 500;
}

/**
 * Hitung HPP, Profit, Margin, dan Markup lengkap untuk satu resep
 */
export function calculateRecipeHpp(
  input: RecipeCalculationInput,
  ingredientsMasterMap: Map<string, IngredientItem>
): RecipeHppResult {
  const outputQty = Math.max(1, input.output_qty || 1);
  const operationalCost = Math.max(0, input.operational_cost || 0);
  const sellingPrice = Math.max(0, input.selling_price || 0);
  const targetMarginPct = input.target_margin_pct !== undefined ? input.target_margin_pct : 60;

  let totalBiayaBahan = 0;
  const breakdown: IngredientCostDetail[] = [];
  const unknownIngredientIds: string[] = [];

  // 1. Hitung biaya bahan baku batch
  for (const item of input.ingredients) {
    const ing = ingredientsMasterMap.get(item.ingredient_id);
    // Bahan yang tidak dikenali TIDAK dihitung nol diam-diam. Dia dicatat,
    // supaya layar bisa bilang "modal di bawah ini belum lengkap".
    if (!ing || ing.pack_size <= 0) {
      unknownIngredientIds.push(item.ingredient_id);
      continue;
    }

    const unitCost = ing.pack_price / ing.pack_size;
    const subtotal = unitCost * item.qty;
    totalBiayaBahan += subtotal;

    breakdown.push({
      ingredientId: ing.id,
      name: ing.name,
      qty: item.qty,
      base_unit: ing.base_unit,
      unitCost,
      subtotalCost: subtotal,
    });
  }

  // 2. Hitung biaya kemasan per unit jadi (DI LUAR pembagian output_qty)
  let totalBiayaKemasan = 0;
  for (const pack of input.packaging) {
    totalBiayaKemasan += Math.max(0, pack.cost || 0);
  }

  // 3. Total modal per batch dan HPP per unit jadi
  const totalModalBatch = totalBiayaBahan + operationalCost;
  const hppPerUnit = (totalModalBatch / outputQty) + totalBiayaKemasan;

  // 4. Profit, Margin %, Markup %
  const profitPerUnit = sellingPrice - hppPerUnit;
  const marginPct = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
  const markupPct = hppPerUnit > 0 ? (profitPerUnit / hppPerUnit) * 100 : 0;

  /**
   * 5. Rekomendasi harga jual dari target margin (dibulatkan ke Rp 500).
   *
   * Target ≥100% berarti modalnya harus nol rupiah — tidak mungkin, dan
   * jawabannya bukan sebuah angka. Dulu keadaan ini mengembalikan modal apa
   * adanya, sehingga layar menyarankan menjual di harga modal (untung nol)
   * seolah itu saran yang sah.
   */
  const marginFactor = 1 - (targetMarginPct / 100);
  const targetMarginUnreachable = marginFactor <= 0;
  const recommendedPrice = targetMarginUnreachable
    ? 0
    : roundUpTo500(hppPerUnit / marginFactor);

  const isUnderTarget = targetMarginPct > 0 && marginPct < targetMarginPct && sellingPrice > 0;

  return {
    biaya_bahan: totalBiayaBahan,
    biaya_kemasan: totalBiayaKemasan,
    operational_cost: operationalCost,
    total_modal_batch: totalModalBatch,
    hpp_per_unit: hppPerUnit,
    selling_price: sellingPrice,
    profit_per_unit: profitPerUnit,
    margin_pct: marginPct,
    markup_pct: markupPct,
    target_margin_pct: targetMarginPct,
    is_under_target: isUnderTarget,
    recommended_price_target_margin: recommendedPrice,
    target_margin_unreachable: targetMarginUnreachable,
    ingredient_breakdown: breakdown,
    unknown_ingredient_ids: unknownIngredientIds,
  };
}

/**
 * Hitung rekomendasi harga jual berdasarkan target laba nominal per porsi
 */
export function calculatePriceFromTargetProfit(hppPerUnit: number, targetProfitRupiah: number): number {
  const rawPrice = hppPerUnit + targetProfitRupiah;
  return roundUpTo500(rawPrice);
}

/**
 * Format angka persentase rapi (misal: 67.5% atau 33.3%)
 */
export function formatMarginPercent(pct: number): string {
  if (isNaN(pct)) return "0%";
  return `${pct.toFixed(1)}%`;
}

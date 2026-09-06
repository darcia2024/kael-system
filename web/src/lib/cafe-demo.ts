import type { TransactionSql } from 'postgres';
import { randomUUID } from 'node:crypto';
import { generateCardCode } from './card-code';
import { site } from './site';

export type CafeDemoSetup = {
  logoUrl: string; brandColor: string; staffPinHash: string;
  menus: { name: string; price: number; cost: number }[];
};

export async function seedCafeDemo(tx: TransactionSql, businessId: string, setup: CafeDemoSetup) {
  await tx`UPDATE businesses SET is_demo = TRUE, demo_expires_at = CURRENT_DATE + 30,
    logo_url = ${setup.logoUrl || null}, brand_color = ${setup.brandColor} WHERE id = ${businessId}`;
  await tx`INSERT INTO users ${tx({business_id: businessId, role: 'staff', name: 'Kasir Demo', pin_hash: setup.staffPinHash, permissions: ['pos','loyalty','review'], is_active: true})}`;
  await tx`INSERT INTO loyalty_programs ${tx({business_id: businessId, mode: 'point', earn_rate: 10000, stamp_per_visit: 1})}`;
  await tx`INSERT INTO rewards ${tx({business_id: businessId, name: 'Minuman gratis (demo)', point_cost: 10, market_value: 25000, stock: 100, is_active: true})}`;
  const categoryId = randomUUID();
  await tx`INSERT INTO categories ${tx({id: categoryId, business_id: businessId, name: 'Menu Kafe', sort_order: 0})}`;
  for (const [index, menu] of setup.menus.entries()) {
    const recipeId = randomUUID(); const ingredientId = randomUUID();
    await tx`INSERT INTO ingredients ${tx({id: ingredientId, business_id: businessId, name: 'Bahan contoh ' + menu.name, pack_price: menu.cost, pack_size: 1, base_unit: 'pcs'})}`;
    await tx`INSERT INTO recipes ${tx({id: recipeId, business_id: businessId, name: menu.name, type: 'olahan', category: 'Demo - estimasi', output_qty: 1, operational_cost: 0, selling_price: menu.price, target_margin_pct: 60})}`;
    await tx`INSERT INTO recipe_ingredients ${tx({recipe_id: recipeId, ingredient_id: ingredientId, qty: 1})}`;
    await tx`INSERT INTO menu_items ${tx({business_id: businessId, category_id: categoryId, recipe_id: recipeId, name: menu.name, price: menu.price, is_available: true, sort_order: index})}`;
  }
  await ensureDemoTouchCard(tx, businessId);
}

export async function ensureDemoTouchCard(tx: TransactionSql, businessId: string) {
  const [business] = await tx`SELECT name, store_code FROM businesses WHERE id = ${businessId} AND is_demo = TRUE FOR UPDATE`;
  if (!business) throw new Error('Tenant demo tidak ditemukan');
  const existing = await tx`SELECT id FROM cards WHERE business_id = ${businessId} AND label = 'Smart Touch Demo'`;
  if (existing.length) return;
  const cardId = randomUUID();
  await tx`INSERT INTO cards ${tx({id: cardId, business_id: businessId, card_code: generateCardCode(), type: 'link', status: 'active', label: 'Smart Touch Demo'})}`;
  await tx`INSERT INTO smart_touch_profiles ${tx({card_id: cardId, business_id: businessId, title: business.name, subtitle: 'Demo - data dan harga contoh'})}`;
  for (const button of [
    {action_key:'menu',label:'Pesan dari meja 1',target_url:`${site.url}/order/${business.store_code}/1`},
    {action_key:'member',label:'Daftar member',target_url:`${site.url}/loyalty/register?toko=${business.store_code}`},
  ]) await tx`INSERT INTO smart_touch_buttons ${tx({card_id:cardId,business_id:businessId,...button,is_enabled:true})}`;
}

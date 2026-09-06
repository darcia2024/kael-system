'use server';
import { revalidatePath } from 'next/cache';
import { requireKaelAdmin, hashPin } from './auth';
import { db } from './db';

export async function createCafeDemoAction(input: {
  name: string; storeCode: string; email: string; password: string; pin: string;
  logoUrl: string; brandColor: string; phone: string; address: string;
  menus: {name: string; price: number; cost: number}[];
}) {
  await requireKaelAdmin();
  if (!input.name.trim() || input.name.length > 80) return {error: 'Isi nama kafe, maksimal 80 karakter.'};
  if (!/^[A-Z0-9]{3,10}$/.test(input.storeCode)) return {error: 'Kode toko harus 3-10 huruf besar atau angka.'};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.password.length < 10 || !/^\d{6}$/.test(input.pin)) return {error: 'Isi email, password minimal 10 karakter, dan PIN 6 digit.'};
  if (!/^#[0-9a-f]{6}$/i.test(input.brandColor)) return {error: 'Pilih warna kafe.'};
  if (input.logoUrl) {
    try { if (new URL(input.logoUrl).protocol !== 'https:' || input.logoUrl.length > 500) return {error: 'Logo harus URL HTTPS, maksimal 500 karakter.'}; }
    catch { return {error: 'URL logo tidak valid.'}; }
  }
  if (!input.menus.length || input.menus.length > 20 || input.menus.some(menu => !menu.name.trim() || menu.name.length > 80 || !Number.isSafeInteger(menu.price) || menu.price <= 0 || !Number.isSafeInteger(menu.cost) || menu.cost < 0)) return {error: 'Isi nama, harga positif dan biaya bahan untuk setiap menu.'};
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
  const result = await db.createBusinessWithOwner({
    name: input.name, businessType: 'kuliner', category: 'Kafe - Demo', timezone: 'Asia/Jakarta',
    phone: input.phone, address: input.address, storeCode: input.storeCode,
    ownerName: 'Owner Demo', ownerEmail: input.email, ownerPassword: input.password,
    modules: ['pos','finance','loyalty','review'].map(module => ({module, expiresAt})),
    cafeDemo: {...input, staffPinHash: hashPin(input.pin)},
  });
  if (!result.success) return {error: result.error};
  revalidatePath('/admin/control'); revalidatePath('/admin/businesses');
  return {storeCode: input.storeCode};
}

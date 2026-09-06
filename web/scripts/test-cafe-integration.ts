import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { sql } from '../src/lib/postgres';
import { hashPin } from '../src/lib/auth';

// Writes only to the dedicated demo tenant. Retains simulated orders for demonstrations.
async function main() {
  let business = await db.getBusinessByStoreCode('KAELCAFE');
  if (!business) {
    const result = await db.createBusinessWithOwner({name:'KAEL Cafe Demo',businessType:'kuliner',category:'Kafe - Demo',phone:'',address:'Data simulasi',timezone:'Asia/Jakarta',storeCode:'KAELCAFE',ownerName:'Owner Demo',ownerEmail:'owner@kaelcafe.invalid',ownerPassword:'KaelCafeDemo!2026',modules:['pos','finance','review','loyalty'].map(module=>({module,expiresAt:'2026-10-06'})),cafeDemo:{logoUrl:'',brandColor:'#26705a',staffPinHash:hashPin('246810'),menus:[{name:'Kopi Susu',price:25000,cost:8000},{name:'Americano',price:20000,cost:5000},{name:'Croissant',price:28000,cost:11000}]}});
    assert(result.success); business = result.business;
  }
  assert(business.is_demo && business.name === 'KAEL Cafe Demo', 'Refuse to write outside the designated demo');
  const businessId = business.id;
  const users = await db.getUsers(businessId); const owner = users.find(user=>user.role==='owner')!;
  const menus = await db.getMenuItems(businessId); const menu = menus[0];
  const customerId = randomUUID();
  await sql`INSERT INTO customers ${sql({id:customerId,business_id:businessId,name:'Pelanggan simulasi',phone:'DEMO-'+randomUUID(),token:randomUUID(),marketing_opt_in:false})}`;
  const inventoryId = randomUUID(); const missingId = randomUUID();
  for (const [id,stock,name] of [[inventoryId,10,'Bahan tersedia'],[missingId,0,'Bahan kurang']] as const) {
    await sql`INSERT INTO inventory_items ${sql({id,business_id:businessId,name,stock_qty:stock,unit:'pcs',average_cost:1000})}`;
    await sql`INSERT INTO inventory_recipe_items ${sql({business_id:businessId,recipe_id:menu.recipe_id,inventory_item_id:id,qty_per_output:1})}`;
  }
  const before = await db.getPosOwnerDashboard(businessId);
  let shift=await db.getActiveShift(businessId);
  if(!shift){const opened=await db.openShift(businessId,owner.id,100000,'Simulasi integrasi'); assert(opened.success);shift=opened.shift;}
  await sql`UPDATE inventory_items SET stock_qty = 10 WHERE business_id = ${businessId} AND name = 'Bahan kurang' AND id <> ${missingId}`;
  const {order}=await db.createOrder(businessId,{channel:'cashier',service_type:'dine_in',payment_method:'cash',cash_given:50000,created_by:owner.id,shift_id:shift.id,customer_id:customerId},[{menu_item_id:menu.id,name:menu.name,price:25000,qty:1}]);
  await db.syncPaidOrder(order.id,businessId,owner.id);
  await db.syncPaidOrder(order.id,businessId,owner.id);
  assert.equal(await db.getCustomerPointBalance(customerId),2,'Retry must not double points');
  let [stock]=await sql`SELECT stock_qty FROM inventory_items WHERE id=${inventoryId}`;
  assert.equal(Number(stock.stock_qty),9,'Retry must not double consumption');
  assert((await db.getPendingOrderSync(businessId)).some(item=>item.id===order.id));
  await sql`UPDATE inventory_items SET stock_qty=10 WHERE id=${missingId}`;
  await db.syncPaidOrder(order.id,businessId,owner.id);
  [stock]=await sql`SELECT stock_qty FROM inventory_items WHERE id=${missingId}`;
  assert.equal(Number(stock.stock_qty),9,'Restock must allow missing ingredient retry');
  assert(!(await db.getPendingOrderSync(businessId)).some(item=>item.id===order.id));
  const after=await db.getPosOwnerDashboard(businessId);
  assert.equal(after.today.revenue-before.today.revenue,25000);
  assert.equal(after.today.paidOrders-before.today.paidOrders,1);
  const firstRefund=await db.refundOrder(order.id,businessId,10000,'Simulasi refund pertama',owner.id);assert(firstRefund.success);
  const secondRefund=await db.refundOrder(order.id,businessId,15000,'Simulasi refund penuh',owner.id);assert(secondRefund.success);
  assert.equal(await db.getCustomerPointBalance(customerId),0,'Full refund reverses purchase points');
  assert.equal((await db.getPosOwnerDashboard(businessId)).today.revenue,before.today.revenue);
  const [cash]=await sql`SELECT COALESCE((SELECT SUM(total) FROM orders WHERE shift_id=${shift.id} AND payment_method='cash' AND status='paid'),0)-COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN orders o ON o.id=r.order_id WHERE r.shift_id=${shift.id} AND o.payment_method='cash'),0) AS net`;
  const closing=Number(shift.opening_cash)+Number(cash.net);
  const closed=await db.closeShift(shift.id,businessId,closing,'Simulasi selesai');
  assert.equal(Number(closed?.expected_cash),closing,'Multiple refunds must not multiply gross cash sales');
  console.log('PASS demo provisioning, live dashboard query, payment, idempotent points/stock, shortage recovery, partial/full refund, shift reconciliation');
}
try {await main();} finally {await sql.end({timeout:5});}

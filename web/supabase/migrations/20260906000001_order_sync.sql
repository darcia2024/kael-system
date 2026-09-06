ALTER TABLE orders ADD COLUMN loyalty_applied_at timestamptz;
ALTER TABLE orders ADD COLUMN inventory_applied_at timestamptz;
ALTER TABLE orders ADD COLUMN sync_error text;
ALTER TABLE point_ledger ADD COLUMN order_id uuid REFERENCES orders(id);
CREATE UNIQUE INDEX point_purchase_order ON point_ledger(order_id) WHERE reason = 'purchase' AND order_id IS NOT NULL;
-- Existing payments predate reliable order references. Do not grant their points again.
UPDATE orders SET loyalty_applied_at = now(), inventory_applied_at = now() WHERE payment_status = 'paid';

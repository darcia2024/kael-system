export type PointExpiryLedgerRow = {
  customer_id: string;
  name: string | null;
  delta: number;
  created_at: string;
};

export type PointExpiryCandidate = {
  customer_id: string;
  name: string | null;
  points: number;
  expires_at: string;
};

type PointLot = { remaining: number; expiresAt: Date };

function addMonthsClamped(date: Date, months: number) {
  const target = new Date(date);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** Mengalokasikan pengurangan poin ke perolehan terlama lebih dulu (FIFO). */
export function getPointExpiryCandidates(
  rows: PointExpiryLedgerRow[],
  expiryMonths: number,
  until: Date,
): PointExpiryCandidate[] {
  const byCustomer = new Map<string, PointExpiryLedgerRow[]>();
  for (const row of rows) {
    const customerRows = byCustomer.get(row.customer_id) ?? [];
    customerRows.push(row);
    byCustomer.set(row.customer_id, customerRows);
  }

  const result: PointExpiryCandidate[] = [];
  for (const [customerId, ledger] of byCustomer) {
    const lots: PointLot[] = [];
    for (const row of ledger.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (row.delta > 0) {
        lots.push({ remaining: row.delta, expiresAt: addMonthsClamped(new Date(row.created_at), expiryMonths) });
        continue;
      }
      let debit = Math.abs(row.delta);
      for (const lot of lots) {
        const used = Math.min(lot.remaining, debit);
        lot.remaining -= used;
        debit -= used;
        if (!debit) break;
      }
    }

    const expiring = lots.filter((lot) => lot.remaining > 0 && lot.expiresAt <= until);
    const points = expiring.reduce((total, lot) => total + lot.remaining, 0);
    if (points) {
      result.push({
        customer_id: customerId,
        name: ledger[0]?.name ?? null,
        points,
        expires_at: expiring.reduce((earliest, lot) => lot.expiresAt < earliest ? lot.expiresAt : earliest, expiring[0].expiresAt).toISOString(),
      });
    }
  }
  return result.sort((a, b) => a.expires_at.localeCompare(b.expires_at));
}

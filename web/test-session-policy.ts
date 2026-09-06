import { isCurrentSession } from "./src/lib/session-policy";

let failures = 0;

function expect(label: string, value: boolean) {
  if (value) {
    console.log(`PASS ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}`);
}

const claim = { userId: "staff-1", businessId: "business-a", role: "staff" as const };

expect("sesi staf aktif pada tenant yang sama diterima", isCurrentSession(claim, { ...claim, isActive: true }));
expect("staf nonaktif ditolak", !isCurrentSession(claim, { ...claim, isActive: false }));
expect("staf yang pindah tenant ditolak", !isCurrentSession(claim, { ...claim, businessId: "business-b", isActive: true }));
expect("peran yang berubah ditolak", !isCurrentSession(claim, { ...claim, role: "owner", isActive: true }));
expect("akun yang hilang ditolak", !isCurrentSession(claim, null));

if (failures) process.exit(1);

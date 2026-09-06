import "server-only";

import { cache } from "react";

import { sql } from "./postgres";
import type { StaffPermission, User } from "./types";
import type { CurrentUserIdentity } from "./session-policy";

export interface ActiveSessionUser extends CurrentUserIdentity {
  id: string;
  name: string;
  permissions: StaffPermission[];
}

/**
 * Cookie sesi menyimpan identitas saat login, bukan sumber kebenaran permanen.
 * Query ini membuat penonaktifan staf dan perubahan izin berlaku di request
 * berikutnya tanpa menunggu masa cookie berakhir.
 */
export const getActiveSessionUser = cache(async (userId: string): Promise<ActiveSessionUser | null> => {
  const rows = await sql`
    SELECT id, business_id, role, name, permissions
    FROM users
    WHERE id = ${userId} AND is_active = TRUE
    LIMIT 1
  `;
  const user = rows[0] as {
    id: string;
    business_id: string | null;
    role: User["role"];
    name: string;
    permissions: StaffPermission[] | null;
  } | undefined;
  if (!user) return null;

  return {
    id: user.id,
    userId: user.id,
    businessId: user.business_id,
    role: user.role,
    isActive: true,
    name: user.name,
    permissions: user.permissions ?? [],
  };
});

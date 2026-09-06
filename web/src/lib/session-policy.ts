import type { User } from "./types";

export interface SessionClaim {
  userId: string;
  businessId: string | null;
  role: User["role"];
}

export interface CurrentUserIdentity extends SessionClaim {
  isActive: boolean;
}

/** Cookie lama hanya sah bila identitas tenant dan perannya masih sama. */
export function isCurrentSession(claim: SessionClaim, user: CurrentUserIdentity | null): boolean {
  return Boolean(
    user && user.isActive && user.userId === claim.userId &&
    user.businessId === claim.businessId && user.role === claim.role,
  );
}

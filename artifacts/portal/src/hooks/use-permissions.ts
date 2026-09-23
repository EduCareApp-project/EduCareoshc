import { useAuth } from "@/contexts/auth";

export const EDUCATOR_ROLES = ["educator", "coordinator"];

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isEducatorRole = EDUCATOR_ROLES.includes(role);
  const isOnboarding = role === "onboarding";
  const isRestrictedRole = isEducatorRole || isOnboarding;

  const isAdmin = role === "admin" || role === "admin_support";
  const isAdminOrEL = isAdmin || role === "educational_leader";

  return {
    isEducatorRole,
    isOnboarding,
    isFullAccess: !isRestrictedRole,
    isAdmin,
    isAdminOrEL,
    canDelete: !isRestrictedRole,
    canEditPost: !isRestrictedRole,
    canEditAfterSubmit: !isRestrictedRole,
    canViewSettings: !isRestrictedRole,
    canViewAllReports: !isRestrictedRole,
    canViewLeadershipDash: !isRestrictedRole,
    canManageQualifications: !isRestrictedRole,
    canManageStaff: !isRestrictedRole,
    ownId: user?.id ?? null,
    ownSiteId: user?.siteId ?? null,
    isOwnEntry: (authorId?: number | null) =>
      user?.id != null && authorId === user.id,
  };
}

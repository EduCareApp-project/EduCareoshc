import { useAuth } from "@/contexts/auth";

export const EDUCATOR_ROLES = ["educator", "coordinator"];

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isEducatorRole = EDUCATOR_ROLES.includes(role);

  const isAdmin = role === "admin";
  const isAdminOrEL = role === "admin" || role === "educational_leader";

  return {
    isEducatorRole,
    isFullAccess: !isEducatorRole,
    isAdmin,
    isAdminOrEL,
    canDelete: !isEducatorRole,
    canEditPost: !isEducatorRole,
    canEditAfterSubmit: !isEducatorRole,
    canViewSettings: !isEducatorRole,
    canViewAllReports: !isEducatorRole,
    canViewLeadershipDash: !isEducatorRole,
    canManageQualifications: !isEducatorRole,
    canManageStaff: !isEducatorRole,
    ownId: user?.id ?? null,
    ownSiteId: user?.siteId ?? null,
    isOwnEntry: (authorId?: number | null) =>
      user?.id != null && authorId === user.id,
  };
}

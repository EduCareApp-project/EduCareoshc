import { useGetFeatureSettings } from "@workspace/api-client-react";

export const SYSTEM_ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "admin_support", label: "Admin Support" },
  { value: "educational_leader", label: "Educational Leader" },
  { value: "coordinator", label: "Coordinator" },
  { value: "educator", label: "Educator" },
];

export function useStaffRoles() {
  const { data: settings } = useGetFeatureSettings();
  const customRoles: { value: string; label: string }[] = (settings?.staffCustomRoles ?? []).map(
    (r) => ({ value: r, label: r })
  );
  return [...SYSTEM_ROLES, ...customRoles];
}

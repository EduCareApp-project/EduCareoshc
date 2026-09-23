import { useListStaff } from "@workspace/api-client-react";

export function useActiveStaff() {
  const { data, ...rest } = useListStaff();
  return { data: data?.filter((s) => s.status === "active" && s.role !== "onboarding"), ...rest };
}

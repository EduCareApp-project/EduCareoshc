import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardPreferencesQueryKey,
  useGetDashboardPreferences,
  useUpdateDashboardPreferences,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

export function useDashboardPreferences() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { toast } = useToast();
  const queryKey = [...getGetDashboardPreferencesQueryKey(), user?.type, user?.id];
  const query = useGetDashboardPreferences({
    query: { queryKey, enabled: user?.type === "staff", staleTime: 0, refetchOnWindowFocus: false },
  });
  const mutation = useUpdateDashboardPreferences();
  const collapsed = query.data?.recentObservationsCollapsed ?? false;

  async function toggle() {
    if (!query.data || mutation.isPending) return;
    // Capture the account-specific key before awaiting so a late response never
    // updates the preferences of someone else who signs in.
    const accountKey = queryKey;
    try {
      const saved = await mutation.mutateAsync({ data: { recentObservationsCollapsed: !collapsed } });
      client.setQueryData(accountKey, saved);
    } catch {
      toast({ title: "Could not save your preference", description: "Your previous open/closed setting has been kept. Please try again.", variant: "destructive" });
    }
  }
  return {
    collapsed,
    loading: query.isPending,
    error: query.isError,
    saving: mutation.isPending,
    retry: () => query.refetch(),
    toggle,
  };
}

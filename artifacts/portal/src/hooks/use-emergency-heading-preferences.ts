import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetEmergencyRecordHeadingPreferencesQueryKey,
  useGetEmergencyRecordHeadingPreferences,
  useUpdateEmergencyRecordHeadingPreferences,
  type EmergencyRecordHeadings,
} from "@workspace/api-client-react";

export function useEmergencyHeadingPreferences(preferenceKey?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...getGetEmergencyRecordHeadingPreferencesQueryKey(), preferenceKey];
  const preferences = useGetEmergencyRecordHeadingPreferences({
    query: { queryKey, enabled: !!preferenceKey, staleTime: 0, refetchOnWindowFocus: false },
  });
  const { mutateAsync } = useUpdateEmergencyRecordHeadingPreferences();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const account = useRef(preferenceKey);
  const failedHeadings = useRef<EmergencyRecordHeadings>({});
  if (account.current !== preferenceKey) failedHeadings.current = {};
  account.current = preferenceKey;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const saveHeadings = useCallback((headings: EmergencyRecordHeadings): Promise<unknown> => {
    // Keep rapid toggles in click order, including after a failed save.
    const operation = queue.current.catch(() => undefined).then(async () => {
      if (!mounted.current || !preferenceKey || account.current !== preferenceKey) return;
      try {
        const saved = await mutateAsync({ data: { ...failedHeadings.current, ...headings } });
        if (account.current === preferenceKey) failedHeadings.current = {};
        queryClient.setQueryData([...getGetEmergencyRecordHeadingPreferencesQueryKey(), preferenceKey], saved);
        return saved;
      } catch (error) {
        if (account.current === preferenceKey) failedHeadings.current = { ...failedHeadings.current, ...headings };
        throw error;
      }
    });
    queue.current = operation;
    return operation;
  }, [mutateAsync, preferenceKey, queryClient]);

  return {
    accountHeadings: preferences.data?.collapsedHeadings,
    preferencesLoading: !!preferenceKey && (preferences.isPending || preferences.isFetching),
    preferencesError: preferences.isError,
    saveHeadings,
  };
}

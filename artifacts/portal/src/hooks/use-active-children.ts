import { useMemo } from "react";
import { useListChildren, getListChildrenQueryKey } from "@workspace/api-client-react";
import { onlyActiveChildren } from "@/lib/active-children";

/** Preserve the complete Children-directory cache; narrow only learning views. */
export function useActiveChildren() {
  const query = useListChildren({
    query: { queryKey: getListChildrenQueryKey(), staleTime: 0, refetchOnMount: "always", refetchInterval: 60_000 },
  });
  const data = useMemo(() => query.data ? onlyActiveChildren(query.data) : undefined, [query.data]);
  return { ...query, data };
}

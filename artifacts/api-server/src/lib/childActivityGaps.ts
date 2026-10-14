type Child = {
  id: number;
  firstName: string;
  lastName: string;
  status: string;
  enrollmentDate: string;
};

type Activity = { childId: number; createdAt: Date };

export function activityCutoffs(now: Date) {
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setUTCDate(1);
  threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);
  const lastDayOfMonth = new Date(Date.UTC(threeMonthsAgo.getUTCFullYear(), threeMonthsAgo.getUTCMonth() + 1, 0)).getUTCDate();
  threeMonthsAgo.setUTCDate(Math.min(now.getUTCDate(), lastDayOfMonth));
  return { last30Days, threeMonthsAgo };
}

export function findChildActivityGaps(children: Child[], activities: Activity[], now = new Date()) {
  const { last30Days, threeMonthsAgo } = activityCutoffs(now);
  const latest = new Map<number, Date>();
  for (const { childId, createdAt } of activities) {
    if (createdAt > now) continue;
    if (!latest.has(childId) || createdAt > latest.get(childId)!) latest.set(childId, createdAt);
  }

  return children
    .filter((child) => child.status === "active" && (!latest.has(child.id) || latest.get(child.id)! < last30Days))
    .map((child) => ({
      childId: child.id,
      childName: `${child.firstName} ${child.lastName}`,
      noActivityForThreeMonths:
        (latest.get(child.id) ?? new Date(`${child.enrollmentDate}T00:00:00Z`)) <= threeMonthsAgo,
    }));
}

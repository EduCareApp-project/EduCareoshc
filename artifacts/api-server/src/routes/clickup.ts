import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLICKUP_LIST_ID = "901612753466";
const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

function getToken(): string {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN is not set");
  return token;
}

function resolveDropdown(cf: any): string | null {
  if (cf.value === null || cf.value === undefined) return null;
  return cf.type_config?.options?.[cf.value]?.name ?? null;
}

function resolveLabels(cf: any): string[] {
  if (!Array.isArray(cf.value)) return [];
  const optMap: Record<string, string> = Object.fromEntries(
    (cf.type_config?.options ?? []).map((o: any) => [o.id, o.label])
  );
  return cf.value.map((id: string) => optMap[id]).filter(Boolean);
}

function fieldByName(fields: any[], name: string): any | undefined {
  return fields.find((f: any) => f.name === name);
}

function extractDate(taskName: string, dateCreatedMs: string): string {
  const match = taskName.match(/#(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return new Date(parseInt(dateCreatedMs)).toISOString().slice(0, 10);
}

router.get("/clickup/service-reports", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (!user || user.type !== "staff" || user.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  try {
    const token = getToken();
    const url = `${CLICKUP_API_BASE}/list/${CLICKUP_LIST_ID}/task?archived=false&include_closed=true&page=0&order_by=created&reverse=true`;
    const response = await fetch(url, {
      headers: { Authorization: token },
    });
    if (!response.ok) {
      res.status(502).json({ error: "ClickUp API error", status: response.status });
      return;
    }
    const data = await response.json() as any;
    const tasks: any[] = data.tasks ?? [];

    const reports = tasks.map((task: any) => {
      const fields: any[] = task.custom_fields ?? [];
      const cf = (name: string) => fieldByName(fields, name);

      return {
        id: task.id as string,
        date: extractDate(task.name, task.date_created),
        status: task.status?.status as string,
        service: resolveDropdown(cf("Service")),
        staffOnTime: resolveDropdown(cf("Did Staff arrive on time and sign in?")),
        staffUniform: resolveDropdown(cf("Were staff in correct uniform?")),
        plannedProgram: resolveDropdown(cf("Was there a planned program?")),
        childrenEngaged: resolveDropdown(cf("Were children engaged appropriately?")),
        enoughResources: resolveDropdown(cf("Were enough resources/activities on offer?")),
        phonesCorrect: resolveDropdown(cf("Phone and digital device operational and used correctly?")),
        concerns: (cf("Concerns or Questions Raised")?.value as string | null) ?? null,
        leisureReview: (cf("Provide a summary of the Leisure and Play Diary Review")?.value as string | null) ?? null,
        goals: (cf("Provide a summary of short term and long term goals")?.value as string | null) ?? null,
        programCompliance: (cf("PROGRAM COMPLIANCE")?.value as string | null) ?? null,
        prescribedInfoSighted: resolveLabels(cf("prescribed Information Sighted") ?? {}),
        clickupUrl: `https://app.clickup.com/t/${task.id}`,
      };
    });

    res.json(reports);
  } catch (err: any) {
    req.log.error({ err }, "ClickUp route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

const TZ = "Australia/Melbourne";

/**
 * Returns a Date whose year/month/day/hour/minute/second values match the
 * current local time in Melbourne. Passing this to date-fns format() functions
 * gives Melbourne-correct output regardless of where the browser is running.
 */
export function melbourneDate(): Date {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const hour = p.hour === "24" ? "00" : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}`);
}

/** Returns the current date in Melbourne as a "yyyy-MM-dd" string, suitable for <input type="date"> */
export function melbourneDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Returns the current date-time in Melbourne as "yyyy-MM-ddTHH:mm", suitable for <input type="datetime-local"> */
export function melbourneDateTimeStr(): string {
  const date = melbourneDateStr();
  const time = new Date().toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}T${time}`;
}

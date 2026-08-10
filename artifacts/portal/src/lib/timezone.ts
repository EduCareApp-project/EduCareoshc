import { format } from "date-fns";

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

/**
 * Converts a datetime-local string that represents Melbourne time into
 * a proper UTC ISO string, safe to send to the server.
 *
 * Example: "2026-05-25T23:04" (11 pm Melbourne AEST) → "2026-05-25T13:04:00.000Z"
 */
export function melbourneLocalToUTCISO(localDT: string): string {
  // Treat the string as if it were UTC to get a numeric reference point
  const utcGuess = new Date(localDT + "Z");
  // Ask Intl what Melbourne's clock reads at that UTC instant
  const melbStr = utcGuess.toLocaleString("sv", { timeZone: TZ }); // "YYYY-MM-DD HH:MM:SS"
  // Parse that Melbourne reading back as UTC to measure the offset
  const melbAsUTC = new Date(melbStr.replace(" ", "T") + "Z").getTime();
  // offset = how many ms Melbourne is ahead of UTC at this moment
  const offsetMs = melbAsUTC - utcGuess.getTime();
  // Subtract the offset from our UTC guess to get the true UTC instant
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

/**
 * Converts any Date or UTC ISO string to a "fake" local Date whose
 * year/month/day/hour/minute match Melbourne time. Pass the result to
 * date-fns format() to get Melbourne-correct display everywhere.
 */
export function toMelbourneDate(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const hour = p.hour === "24" ? "00" : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}`);
}

/**
 * Formats a UTC timestamp (Date or ISO string) using Melbourne local time.
 * Use this everywhere instead of format(new Date(utcStr), ...) to guarantee
 * Melbourne-correct display regardless of where the browser is running.
 */
export function fmtMelb(input: Date | string, formatStr: string): string {
  return format(toMelbourneDate(input), formatStr);
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

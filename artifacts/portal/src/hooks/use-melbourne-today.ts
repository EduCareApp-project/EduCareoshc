import { useEffect, useState } from "react";
import { melbourneToday, millisecondsUntilMelbourneTomorrow } from "@/components/kidsoft-utils";

/** Refresh the calendar day at local midnight and when returning to a sleeping tab. */
export function useMelbourneToday() {
  const [today, setToday] = useState(melbourneToday);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setToday(melbourneToday());
      timer = setTimeout(update, millisecondsUntilMelbourneTomorrow() + 20);
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return today;
}

"use client";

/**
 * Displays the current shift countdown or progress label.
 * The display uses the shared South African shift times rather than the browser's timezone.
 */

import { useEffect, useState } from "react";
import { formatShiftCountdown } from "@/business/shared/dates/attendance";

function durationUntil(timestamp: string, now: number) {
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - now) / 60_000));
}

/** Shows a volunteer whether their booked shift is upcoming, active, or over. */
export default function LiveShiftSchedule({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (now < new Date(startsAt).getTime()) return <span>Starts in {formatShiftCountdown(durationUntil(startsAt, now))}</span>;
  if (now <= new Date(endsAt).getTime()) return <span>Shift ends in {formatShiftCountdown(durationUntil(endsAt, now))}</span>;
  return <span>Shift ended</span>;
}

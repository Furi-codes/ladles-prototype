"use client";

import { useEffect, useState } from "react";
import { formatWorkedTime, getAttendanceMinutes } from "@/lib/attendance-utils";
import type { AttendanceRecord } from "@/lib/types";

/** Keeps an in-progress clock-in duration current without changing database data. */
export default function LiveAttendanceTime({ attendance, prefix = "Clocked in" }: { attendance: AttendanceRecord; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = Boolean(attendance.clocked_in_at && !attendance.clocked_out_at);

  useEffect(() => {
    if (!isLive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [isLive]);

  const minutes = getAttendanceMinutes(attendance, now);
  return <span>{isLive ? `${prefix} for ${formatWorkedTime(minutes)}` : formatWorkedTime(minutes)}</span>;
}

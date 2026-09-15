"use client";

import { useEffect, useState } from "react";
import { formatWorkedTime, getAttendanceMinutes } from "@/lib/attendance-utils";
import type { AttendanceRecord } from "@/lib/types";

/** Displays worked time and a countdown without ever allowing a timer to exceed a shift end. */
export default function LiveAttendanceTime({ attendance, endsAt, prefix = "Clocked in" }: { attendance: AttendanceRecord; endsAt?: string; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = Boolean(attendance.clocked_in_at && !attendance.clocked_out_at);

  useEffect(() => {
    if (!isLive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [isLive]);

  const minutes = getAttendanceMinutes(attendance, now, endsAt);
  const remainingMinutes = endsAt ? Math.ceil((new Date(endsAt).getTime() - now) / 60_000) : null;
  const shiftNote = remainingMinutes === null ? "" : remainingMinutes > 0 ? ` · ${formatWorkedTime(remainingMinutes)} left` : " · shift ended — clock out";
  return <span>{isLive ? `${prefix} for ${formatWorkedTime(minutes)}${shiftNote}` : formatWorkedTime(minutes)}</span>;
}

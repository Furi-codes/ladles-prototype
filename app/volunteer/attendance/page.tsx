"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recordEventAttendance, recordEventAttendanceCode } from "@/lib/actions/volunteer";
import { formatWorkedTime } from "@/lib/attendance-utils";
import styles from "../volunteer.module.css";
import entryStyles from "./attendance.module.css";
import AttendanceScanner from "../components/AttendanceScanner";
import { useVolunteerData } from "../components/VolunteerProvider";

export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshData } = useVolunteerData();
  const [checkpoint, setCheckpoint] = useState(searchParams.get("checkpoint"));
  const [mode, setMode] = useState<"qr" | "code">("qr");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  async function record() {
    if (saving.current || (mode === "qr" && !checkpoint)) return;
    saving.current = true;
    setIsSaving(true);
    setMessage(null);
    try {
      const { data, error } = mode === "code"
        ? await recordEventAttendanceCode(code)
        : await recordEventAttendance(checkpoint!);
      if (error || !data) {
        setMessage({ text: error?.message ?? "Attendance could not be confirmed. Please try again.", success: false });
        return;
      }
      setMessage({ text: data.clocked_out_at ? `Clock-out recorded. Your recorded time is ${formatWorkedTime(data.worked_minutes)}.` : "Clock-in recorded successfully.", success: true });
      // A refresh failure must not imply that a saved record failed.
      try { await refreshData(); } catch { /* Refresh the dashboard separately. */ }
    } catch {
      setMessage({ text: "Could not connect. Check your connection and try again.", success: false });
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return <section className={`${styles.card} ${styles.attendanceCard}`}>
    <div className={styles.cardHeader}><div><h1 className={styles.cardTitle}>Event attendance</h1><p className={styles.cardHint}>Scan a QR code or enter the organiser’s clock-in or clock-out code.</p></div><button type="button" className={styles.secondaryButton} onClick={() => router.push("/volunteer")}>Back to dashboard</button></div>
    <div className={styles.attendanceBody}>
      {!message?.success && <>
        <div className={entryStyles.methods} aria-label="Attendance method">
          {(["qr", "code"] as const).map(method => <button type="button" key={method} aria-pressed={mode === method} disabled={isSaving} className={mode === method ? styles.primaryButton : styles.secondaryButton} onClick={() => { setMode(method); setMessage(null); }}>{method === "qr" ? "Scan QR" : "Enter code"}</button>)}
        </div>
        {mode === "qr" && !checkpoint && <AttendanceScanner onScan={setCheckpoint} />}
        {mode === "qr" && checkpoint && <><p className={styles.signedInAs}>Attendance QR ready. Confirm only when you are at the event.</p><div className={styles.modalActions}><button type="button" disabled={isSaving} className={styles.secondaryButton} onClick={() => { setCheckpoint(null); setMessage(null); router.replace("/volunteer/attendance"); }}>Scan another code</button><button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => void record()}>{isSaving ? "Recording..." : "Confirm attendance"}</button></div></>}
        {mode === "code" && <form className={entryStyles.form} onSubmit={event => { event.preventDefault(); void record(); }}>
          <label htmlFor="attendance-entry-code">Attendance code</label>
          <input id="attendance-entry-code" className={entryStyles.input} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="ABCDE-12345" maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} required disabled={isSaving} aria-describedby="attendance-code-help" />
          <p id="attendance-code-help" className={styles.cardHint}>Enter the 10-character code shown at your event. Clock-in and clock-out have different codes. Your booking and attendance time still need to be valid.</p>
          <button className={styles.primaryButton} disabled={isSaving || !code.trim()}>{isSaving ? "Recording..." : "Confirm attendance"}</button>
        </form>}
      </>}
      {message && <div role={message.success ? "status" : "alert"} className={message.success ? styles.messageSuccess : styles.messageError}>{message.text}</div>}
      {message?.success && <div className={styles.modalActions}><button type="button" className={styles.primaryButton} onClick={() => router.push("/volunteer")}>Back to dashboard</button></div>}
    </div>
  </section>;
}

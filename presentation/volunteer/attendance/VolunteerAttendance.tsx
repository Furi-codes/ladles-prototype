"use client";

/**
 * Lets a volunteer check in or out using a QR link or typed code.
 * Both entry methods call database attendance checks and then reload the volunteer's recorded
 * result.
 */

import { useRef, useState } from "react";
import { userFacingError } from '@/business/shared/errors/user-facing';
import { useRouter, useSearchParams } from "next/navigation";
import { recordEventAttendance, recordEventAttendanceCode } from "@/business/volunteer/services/volunteer";
import { formatWorkedTime } from "@/business/shared/dates/attendance";
import styles from "@/presentation/styles/volunteer.module.css";
import entryStyles from "@/presentation/volunteer/attendance/attendance.module.css";
import AttendanceScanner from "@/presentation/volunteer/attendance/AttendanceScanner";
import { useVolunteerData } from "@/presentation/volunteer/shell/VolunteerProvider";

/** Shares saved attendance with other pages by refreshing VolunteerProvider after the write succeeds. */
export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshData } = useVolunteerData();
  const [checkpoint, setCheckpoint] = useState(searchParams.get("checkpoint"));
  const [mode, setMode] = useState<"qr" | "code">("qr");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // A ref changes immediately, so two rapid clicks are blocked before React renders isSaving again.
  const saving = useRef(false);

  /** Calls the selected attendance RPC, shows its saved clock-in/out result and always releases the save guard. */
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
        setMessage({ text: userFacingError(error, "Attendance could not be confirmed. Please try again.") || "Attendance could not be confirmed. Please try again.", success: false });
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

  return <><div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Attendance</h1><p className={styles.pageDescription}>Scan a QR code or enter the organiser’s clock-in or clock-out code.</p></div></div>
    <section className={`${styles.card} ${styles.attendanceCard}`}>
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
  </section></>;
}

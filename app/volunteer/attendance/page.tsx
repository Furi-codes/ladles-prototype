"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recordEventAttendance } from "@/lib/actions/volunteer";
import styles from "../volunteer.module.css";
import AttendanceScanner from "../components/AttendanceScanner";

export default function AttendancePage() {
  const router = useRouter(); const searchParams = useSearchParams();
  const [checkpoint, setCheckpoint] = useState(searchParams.get("checkpoint"));
  const [message, setMessage] = useState<string | null>(null); const [isSaving, setIsSaving] = useState(false);
  const record = useCallback(async () => { if (!checkpoint) return; setIsSaving(true); const { data, error } = await recordEventAttendance(checkpoint); setIsSaving(false); if (error) { setMessage(error.message); return; } setMessage(data?.clocked_out_at ? `Clock-out recorded. ${data.worked_minutes ?? 0} minutes have been recorded.` : "Clock-in recorded successfully."); }, [checkpoint]);
  return <section className={`${styles.card} ${styles.attendanceCard}`}><div className={styles.cardHeader}><div><h1 className={styles.cardTitle}>Event attendance</h1><p className={styles.cardHint}>Scan or confirm an event attendance QR code.</p></div><button type="button" className={styles.secondaryButton} onClick={() => router.push("/volunteer")}>Back to dashboard</button></div><div className={styles.attendanceBody}>{!checkpoint && <AttendanceScanner onScan={setCheckpoint} />}{checkpoint && !message && <><p className={styles.signedInAs}>Attendance QR ready. Confirm only when you are at the event.</p><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => { setCheckpoint(null); router.replace("/volunteer/attendance"); }}>Scan another code</button><button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => void record()}>{isSaving ? "Recording..." : "Confirm attendance"}</button></div></>}{message && <><div className={message.includes("successfully") || message.includes("recorded.") ? styles.messageSuccess : styles.messageError}>{message}</div><div className={styles.modalActions}><button type="button" className={styles.primaryButton} onClick={() => router.push("/volunteer")}>Back to dashboard</button></div></>}</div></section>;
}

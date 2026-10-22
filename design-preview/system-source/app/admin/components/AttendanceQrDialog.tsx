"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { rotateAttendanceEntryCode } from "@/lib/actions/admin";
import type { AttendanceCheckpoint, Event } from "@/lib/types";
import styles from "../admin.module.css";
import codeStyles from "./attendance-codes.module.css";

const actions = ["clock_in", "clock_out"] as const;
const displayCode = (code?: string) => code ? `${code.slice(0, 5)}-${code.slice(5)}` : "Unavailable";

export default function AttendanceQrDialog({ event, checkpoints, onClose, onRefresh }: {
  event: Event; checkpoints: AttendanceCheckpoint[]; onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const eventCheckpoints = useMemo(() => checkpoints.filter(checkpoint => checkpoint.event_id === event.id && checkpoint.is_active), [checkpoints, event.id]);

  useEffect(() => {
    let cancelled = false;
    async function generateCodes() {
      try {
        const origin = window.location.origin;
        const entries = await Promise.all(eventCheckpoints.map(async checkpoint => [checkpoint.action, await QRCode.toDataURL(`${origin}/volunteer/attendance?checkpoint=${checkpoint.id}`, { width: 640, margin: 1, errorCorrectionLevel: "M" })] as const));
        if (!cancelled) setCodes(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setNotice("QR images could not be generated. Please reopen this window.");
      }
    }
    void generateCodes();
    return () => { cancelled = true; };
  }, [eventCheckpoints]);

  function entryCode(action: AttendanceCheckpoint["action"]) {
    const checkpoint = eventCheckpoints.find(item => item.action === action);
    return checkpoint ? replacements[checkpoint.id] ?? checkpoint.entry_code : undefined;
  }

  async function replaceCode(checkpoint: AttendanceCheckpoint) {
    if (busy || !window.confirm("Replace this attendance code? The old typed code on printed sheets will stop working. The QR code will still work.")) return;
    setBusy(true);
    setNotice(null);
    try {
      const { data, error } = await rotateAttendanceEntryCode(checkpoint.id);
      if (error || typeof data !== "string") { setNotice(error?.message ?? "The code could not be replaced."); return; }
      setReplacements(previous => ({ ...previous, [checkpoint.id]: data }));
      setNotice("Code replaced. Reprint any sheets that show the old typed code.");
      try { await onRefresh(); } catch { setNotice("Code replaced. Refresh the events page before reopening this window."); }
    } catch { setNotice("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(displayCode(code)); setNotice("Attendance code copied."); }
    catch { setNotice("Copy was blocked. You can select and copy the displayed code instead."); }
  }

  function printQrSheet() {
    if (!codes.clock_in || !codes.clock_out) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) { setNotice("Allow pop-ups to print the attendance sheets."); return; }
    const escapeHtml = (value: string) => value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
    const details = `${escapeHtml(event.title)}<br>${escapeHtml(event.date)} &middot; ${escapeHtml(event.location)}`;
    const page = (action: AttendanceCheckpoint["action"]) => `<section class="page"><h1>${action === "clock_in" ? "Clock in" : "Clock out"}</h1><p class="details">${details}</p><img src="${codes[action]}" alt="Attendance QR code"><p>Scan this QR in the volunteer portal, or choose Enter code:</p><p class="entry">${escapeHtml(displayCode(entryCode(action)))}</p><p>Only confirm when you are at the event. A valid booking is required.</p></section>`;
    printWindow.document.write(`<!doctype html><html><head><title>Attendance codes - ${escapeHtml(event.title)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#17202a}.page{min-height:268mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:12mm;break-after:page}.page:last-child{break-after:auto}h1{margin:0;font-size:28px}.details{margin:8px 0 18px;font-size:16px;font-weight:700;line-height:1.5}img{width:130mm;height:130mm;object-fit:contain;margin:8mm 0}p{max-width:460px;font-size:14px;line-height:1.5}.entry{font:700 30px monospace;letter-spacing:4px;margin:6px 0 12px}</style></head><body>${actions.map(page).join("")}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    // Wait for QR images so they are present in print preview.
    void Promise.all(Array.from(printWindow.document.images).map(img => img.decode().catch(() => undefined))).then(() => printWindow.print());
  }

  return <div className={styles.dialogBackdrop} role="presentation"><section className={`${styles.dialog} ${styles.qrPrintSheet}`} role="dialog" aria-modal="true" aria-labelledby="attendance-qr-title">
    <h2 id="attendance-qr-title" className={styles.dialogTitle}>Attendance QR codes &amp; entry codes</h2>
    <p className={styles.dialogText}><strong>{event.title}</strong><br />{event.date} · {event.location}</p>
    <div className={styles.qrGrid}>{actions.map(action => {
      const checkpoint = eventCheckpoints.find(item => item.action === action);
      const code = entryCode(action);
      return <article className={styles.qrCard} key={action}>
        <h3>{action === "clock_in" ? "Clock in" : "Clock out"}</h3>
        {checkpoint ? <>{codes[action] ? <Image src={codes[action]} alt={`${action === "clock_in" ? "Clock-in" : "Clock-out"} QR code for ${event.title}`} width={520} height={520} unoptimized /> : <p>Generating QR code...</p>}
          <p>Cannot scan? Choose <strong>Enter code</strong> in the volunteer attendance screen.</p>
          <div className={codeStyles.code}>{displayCode(code)}</div>
          <div className={codeStyles.actions}><button type="button" className={styles.secondaryButton} disabled={!code || busy} onClick={() => code && void copyCode(code)}>Copy code</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void replaceCode(checkpoint)}>Replace code</button></div>
        </> : <p>No active attendance checkpoint is available.</p>}
      </article>;
    })}</div>
    {notice && <p role="status" className={styles.dialogText}>{notice}</p>}
    <div className={styles.formActions}><button type="button" disabled={busy} className={styles.secondaryButton} onClick={onClose}>Close</button><button type="button" className={styles.primaryButton} disabled={busy || !codes.clock_in || !codes.clock_out || !entryCode("clock_in") || !entryCode("clock_out")} onClick={printQrSheet}>Print attendance sheets</button></div>
  </section></div>;
}

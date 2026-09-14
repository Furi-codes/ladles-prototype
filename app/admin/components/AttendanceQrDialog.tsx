"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { AttendanceCheckpoint, Event } from "@/lib/types";
import styles from "../admin.module.css";

export default function AttendanceQrDialog({ event, checkpoints, onClose }: { event: Event; checkpoints: AttendanceCheckpoint[]; onClose: () => void }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const eventCheckpoints = useMemo(() => checkpoints.filter((checkpoint) => checkpoint.event_id === event.id), [checkpoints, event.id]);

  useEffect(() => {
    async function generateCodes() {
      const origin = window.location.origin;
      const entries = await Promise.all(eventCheckpoints.map(async (checkpoint) => [checkpoint.action, await QRCode.toDataURL(`${origin}/volunteer/attendance?checkpoint=${checkpoint.id}`, { width: 640, margin: 1, errorCorrectionLevel: "M" })] as const));
      setCodes(Object.fromEntries(entries));
    }
    void generateCodes();
  }, [eventCheckpoints]);

  function printQrSheet() {
    if (!codes.clock_in || !codes.clock_out) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
    const details = `${escapeHtml(event.title)}<br>${escapeHtml(event.date)} · ${escapeHtml(event.location)}`;
    const page = (label: string, code: string) => `<section class="page"><h1>${label}</h1><p class="details">${details}</p><img src="${code}" alt="${label} QR code"><p>Volunteers: scan this code using the Ladles of Love volunteer portal.</p></section>`;

    printWindow.document.write(`<!doctype html><html><head><title>Attendance QR codes — ${escapeHtml(event.title)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#17202a}.page{min-height:273mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:18mm 12mm;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}h1{margin:0;font-size:28px}.details{margin:8px 0 18px;font-size:16px;font-weight:700;line-height:1.5}img{width:150mm;height:150mm;object-fit:contain;margin:12mm 0}p:last-child{max-width:460px;margin:0;color:#40505e;font-size:14px;line-height:1.5}</style></head><body>${page("Clock in", codes.clock_in)}${page("Clock out", codes.clock_out)}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  return <div className={styles.dialogBackdrop} role="presentation"><section className={`${styles.dialog} ${styles.qrPrintSheet}`} role="dialog" aria-modal="true" aria-labelledby="attendance-qr-title"><h2 id="attendance-qr-title" className={styles.dialogTitle}>Attendance QR codes</h2><p className={styles.dialogText}><strong>{event.title}</strong><br />{event.date} · {event.location}</p><div className={styles.qrGrid}>{(["clock_in", "clock_out"] as const).map((action) => <article className={styles.qrCard} key={action}><h3>{action === "clock_in" ? "Clock in" : "Clock out"}</h3><p className={styles.qrEventDetails}>{event.title}<br />{event.date} · {event.location}</p>{codes[action] ? <Image src={codes[action]} alt={`${action === "clock_in" ? "Clock-in" : "Clock-out"} QR code for ${event.title}`} width={520} height={520} unoptimized /> : <p>Generating QR code...</p>}<p>Volunteers: scan this code using the Ladles of Love volunteer portal.</p></article>)}</div><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Close</button><button type="button" className={styles.primaryButton} disabled={!codes.clock_in || !codes.clock_out} onClick={printQrSheet}>Print QR sheet</button></div></section></div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import styles from "../volunteer.module.css";

export default function AttendanceScanner({ onScan }: { onScan: (checkpoint: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    async function start() {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, scanError, scannerControls) => {
          controlsRef.current = scannerControls;
          if (result && !stoppedRef.current) {
            stoppedRef.current = true;
            scannerControls.stop();
            try {
              const url = new URL(result.getText());
              const checkpoint = url.searchParams.get("checkpoint");
              if (!url.pathname.endsWith("/volunteer/attendance") || !checkpoint) throw new Error();
              onScan(checkpoint);
            } catch { setError("This is not a valid Ladles of Love attendance QR code."); }
          }
          if (scanError && scanError.name !== "NotFoundException") setError("The camera could not read this QR code.");
        });
        controlsRef.current = controls;
      } catch { setError("Camera access was not available. Allow camera access and try again."); }
    }
    void start();
    return () => { stoppedRef.current = true; controlsRef.current?.stop(); };
  }, [onScan]);

  return <div className={styles.scanner}><video ref={videoRef} className={styles.scannerVideo} muted playsInline /><p className={styles.cardHint}>Point your camera at the event clock-in or clock-out QR code.</p>{error && <div className={styles.messageError}>{error}</div>}</div>;
}

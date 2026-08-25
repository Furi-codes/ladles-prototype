"use client";
import React from "react";

export default function ToastContainer({ toasts }: { toasts: { id: number; type: string; message: string }[] }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
      <style jsx>{`
        .toast-container { position: fixed; top: 80px; right: 20px; z-index: 1200; display: flex; flex-direction: column; gap: 8px; }
        .toast { padding: 10px 14px; border-radius: 8px; color: #fff; font-weight: 600; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
        .toast-success { background: #16a34a; }
        .toast-error { background: #ef4444; }
        .toast-info { background: #3b82f6; }
      `}</style>
    </div>
  );
}

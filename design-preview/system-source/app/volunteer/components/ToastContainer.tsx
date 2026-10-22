import styles from "../volunteer.module.css";

export default function ToastContainer({ toasts }: { toasts: { id: number; type: "success" | "error" | "info"; message: string }[] }) {
  return <div className={styles.toastContainer} aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : toast.type === "error" ? styles.toastError : styles.toastInfo}`}>{toast.message}</div>)}</div>;
}

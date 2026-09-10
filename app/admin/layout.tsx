import { AdminProvider } from "./components/AdminProvider";
import AdminShell from "./components/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}

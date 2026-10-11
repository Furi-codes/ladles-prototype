/** Admin routes share one data provider and navigation shell instead of repeating them on every page. */
import { AdminProvider } from "./components/AdminProvider";
import AdminShell from "./components/AdminShell";

/** Places the shell and page children inside the provider so both can use useAdminData. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}

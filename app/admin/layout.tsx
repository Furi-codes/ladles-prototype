/**
 * Wraps admin routes in their shared data provider and workspace shell.
 * Next.js keeps this layout across child-route navigation, so pages can reuse the same header
 * and loaded data.
 */

import { AdminProvider } from "@/presentation/admin/shell/AdminProvider";
import AdminShell from "@/presentation/admin/shell/AdminShell";

/** Places the shell and page children inside the provider so both can use useAdminData. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}

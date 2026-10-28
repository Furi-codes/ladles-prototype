/**
 * Supplies the Next.js loading fallback for this portal route.
 * The portal-specific wrapper reuses the shared loading presentation.
 */

import AdminLoadingScreen from "@/presentation/admin/shell/AdminLoadingScreen";

export default function AdminLoading() {
  return <AdminLoadingScreen />;
}

/**
 * Opens the admin settings at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from "@/presentation/admin/shell/PageHeader";
import { Suspense } from 'react';
import SettingsManager from "@/presentation/admin/settings/SettingsManager";
export default function SettingsPage() {
  return <> <PageHeader activeNav="Settings" /><Suspense fallback={<p role="status">Loading settings…</p>}><SettingsManager /></Suspense></>;
}

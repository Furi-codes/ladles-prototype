import PageHeader from "../components/PageHeader";
import { Suspense } from 'react';
import SettingsManager from "../components/SettingsManager";
export default function SettingsPage() {
  return <> <PageHeader activeNav="Settings" /><Suspense fallback={<p role="status">Loading settings…</p>}><SettingsManager /></Suspense></>;
}

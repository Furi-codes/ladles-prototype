/**
 * Wraps corporate routes in the shared business workspace.
 * Account checks and the header remain mounted while feature content changes.
 */

import CorporateShell from '@/presentation/corporate/shell/CorporateShell';

/** Next.js keeps this layout mounted while corporate pages change. */
export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <CorporateShell>{children}</CorporateShell>;
}

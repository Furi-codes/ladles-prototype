import CorporateShell from './components/CorporateShell';

/** Next.js keeps this layout mounted while corporate pages change. */
export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <CorporateShell>{children}</CorporateShell>;
}

import PageHeader from '../components/PageHeader';
import CorporateManager from '../components/CorporateManager';
import LegacyCorporateHistory from '../components/LegacyCorporateHistory';
import { corporateBookingsEnabled } from '@/lib/feature-flags';
export default function CorporatePage() { return corporateBookingsEnabled ? <LegacyCorporateHistory /> : <><PageHeader activeNav="Corporate CSR" /><CorporateManager /></>; }

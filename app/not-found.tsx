/** An unavailable URL gets a branded way back rather than a generic framework page. */
import StatusPage from '@/presentation/components/experience/StatusPage';
import styles from '@/presentation/components/experience/status-page.module.css';

export default function NotFound() {
  return <main data-experience="system" className={`portalUi ${styles.page}`}><StatusPage missing title="A different kind of detour." message="We couldn’t find that page. Your next opportunity to make a difference is still waiting back at the portal." /></main>;
}

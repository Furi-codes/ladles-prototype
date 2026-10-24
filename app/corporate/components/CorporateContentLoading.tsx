import ui from '../corporate.module.css';

/** Route transitions and data refreshes stay inside the persistent corporate header. */
export default function CorporateContentLoading({ message = 'Loading page…' }: { message?: string }) {
  return <div className={ui.contentLoading} role="status"><span className={ui.contentSpinner} aria-hidden="true" />{message}</div>;
}

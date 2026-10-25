/**
 * Shows a content-level loading state during corporate navigation.
 * The existing workspace header remains in place while the requested feature loads.
 */

import ui from '@/styles/corporate.module.css';

/** Route transitions and data refreshes stay inside the persistent corporate header. */
export default function CorporateContentLoading({ message = 'Loading page…' }: { message?: string }) {
  return <div className={ui.contentLoading} role="status"><span className={ui.contentSpinner} aria-hidden="true" />{message}</div>;
}

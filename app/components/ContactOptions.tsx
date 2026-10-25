"use client";
import { userFacingError } from '@/lib/user-facing-error';

import { useRef, useState } from 'react';
import { isValidPhone } from '@/lib/contact-details';
import styles from '@/app/admin/admin.module.css';

/** Reveal the details first. Opening a mail/call app is an explicit, separate action. */
export default function ContactOptions({ email, phone, label = 'Contact options', phoneLabel = 'Phone', expanded = false, buttonClassName = styles.secondaryButton }: { email?: string | null; phone?: string | null; label?: string; phoneLabel?: string; expanded?: boolean; buttonClassName?: string }) {
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const cleanEmail = email?.trim() || '', cleanPhone = phone?.trim() || '';
  if (!cleanEmail && !cleanPhone) return <span>No contact details provided.</span>;
  const copy = async (value: string, kind: string) => {
    if (pending.current) return; pending.current = true; setMessage('');
    try { await navigator.clipboard.writeText(value); setMessage(userFacingError(kind + ' copied.', " copied.")); }
    catch { setMessage(userFacingError('Copy is unavailable. Select and copy the displayed ' + kind.toLowerCase() + ' manually.', " manually.")); }
    finally { pending.current = false; }
  };
  const content = <>
    {cleanEmail && <div><p>Email: <span>{cleanEmail}</span></p><div className={styles.tableActions}><button type="button" className={buttonClassName} onClick={() => void copy(cleanEmail, 'Email')}>Copy email</button>{/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) && <a className={buttonClassName} href={'mailto:' + cleanEmail}>Open email app</a>}</div></div>}
    {cleanPhone && <div><p>{phoneLabel}: <span>{cleanPhone}</span></p><div className={styles.tableActions}><button type="button" className={buttonClassName} onClick={() => void copy(cleanPhone, phoneLabel)}>Copy {phoneLabel.toLowerCase()}</button>{isValidPhone(cleanPhone) && <a className={buttonClassName} href={'tel:' + cleanPhone.replace(/[^+0-9]/g, '')}>Call (open calling app)</a>}</div></div>}
    {message && <p role="status">{message}</p>}
  </>;
  return expanded ? <div>{content}</div> : <details><summary className={buttonClassName}>{label}</summary>{content}</details>;
}

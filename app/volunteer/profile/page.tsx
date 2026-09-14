"use client";

import { useState } from "react";
import Link from "next/link";
import { useVolunteerData } from "../components/VolunteerProvider";
import styles from "../volunteer.module.css";

export default function VolunteerProfilePage() {
  const { profile, saveProfile, requestEmailChange, consent } = useVolunteerData();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    const error = await saveProfile({ full_name: fullName.trim(), date_of_birth: dateOfBirth });
    if (error) setProfileError(error);
    setIsSavingProfile(false);
  }

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingEmail(true);
    setEmailError(null);
    const error = await requestEmailChange(email.trim());
    if (error) setEmailError(error);
    setIsSavingEmail(false);
  }

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>My profile</h1><p className={styles.pageDescription}>Manage your volunteer details and account settings.</p></div>
      <Link href="/volunteer" className={styles.secondaryButton}>Back to dashboard</Link>
    </section>
    <div className={styles.settingsGrid}>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Personal details</h2><p className={styles.cardHint}>Keep these details accurate for bookings and attendance.</p></div></div><form className={styles.settingsBody} onSubmit={saveDetails}>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-name">Full name</label><input id="profile-name" className={styles.input} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-dob">Date of birth</label><input id="profile-dob" className={styles.input} required type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>
        {profileError && <div className={styles.messageError} role="alert">{profileError}</div>}
        <div className={styles.modalActions}><button className={styles.primaryButton} disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save details"}</button></div>
      </form></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Email address</h2><p className={styles.cardHint}>Changing your email requires confirmation through Supabase.</p></div></div><form className={styles.settingsBody} onSubmit={changeEmail}>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-email">Email address</label><input id="profile-email" className={styles.input} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        {emailError && <div className={styles.messageError} role="alert">{emailError}</div>}
        <div className={styles.modalActions}><button className={styles.secondaryButton} disabled={email === profile?.email || isSavingEmail}>{isSavingEmail ? "Requesting..." : "Request email change"}</button></div>
      </form></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Volunteer acknowledgements</h2><p className={styles.cardHint}>Your current onboarding consent record.</p></div></div><div className={styles.settingsBody}><div className={styles.consentSummary}><span>Code of conduct</span><strong>{consent?.code_of_conduct_accepted ? "Accepted" : "Not recorded"}</strong><span>Information use</span><strong>{consent?.data_use_accepted ? "Accepted" : "Not recorded"}</strong><span>Information accuracy</span><strong>{consent?.information_accuracy_accepted ? "Accepted" : "Not recorded"}</strong></div>{consent?.accepted_at && <p className={styles.cardHint}>Accepted on {new Date(consent.accepted_at).toLocaleDateString("en-ZA")}</p>}</div></section>
    </div>
  </>;
}

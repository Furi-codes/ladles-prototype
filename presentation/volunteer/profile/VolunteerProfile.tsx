"use client";

/**
 * Organises volunteer details, account security, photo and reminder settings.
 * Profile edits and Auth email changes use separate actions because they update different parts
 * of the account.
 */

import { useState } from "react";
import { userFacingError } from '@/business/shared/errors/user-facing';
import { useVolunteerData } from "@/presentation/volunteer/shell/VolunteerProvider";
import ProfilePhotoEditor from "@/presentation/volunteer/profile/ProfilePhotoEditor";
import NotificationPreferences from "@/presentation/volunteer/notifications/NotificationPreferences";
import ThemeToggle from "@/presentation/components/theme/ThemeToggle";
import ChangePasswordForm from '@/presentation/auth/ChangePasswordForm';
import { useVolunteerSignOut } from "@/presentation/volunteer/shell/VolunteerAccountContext";
import styles from "@/presentation/styles/volunteer.module.css";
import { corporateRolloutEnabled } from "@/business/shared/config/features";

export default function VolunteerProfilePage() {
  const requestSignOut = useVolunteerSignOut();
  const { profile, saveProfile, requestEmailChange, consent } = useVolunteerData();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  /**
   * Save editable volunteer details through the provider so the rest of the workspace receives
   * the updated profile.
   */
  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    const error = await saveProfile({ full_name: fullName.trim(), date_of_birth: dateOfBirth, ...(corporateRolloutEnabled ? { phone } : {}) });
    if (error) setProfileError(userFacingError(error, 'Your profile could not be saved. Please try again.'));
    setIsSavingProfile(false);
  }

  /**
   * Start the Auth email-confirmation flow rather than directly replacing the profile's email
   * field.
   */
  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingEmail(true);
    setEmailError(null);
    const error = await requestEmailChange(email.trim());
    if (error) setEmailError(userFacingError(error, 'Your email change could not be requested. Please try again.'));
    setIsSavingEmail(false);
  }

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>My profile</h1><p className={styles.pageDescription}>Manage your volunteer details and account settings.</p></div>
    </section>
    <section className={`${styles.card} ${styles.profileAccountControls}`} aria-labelledby="account-controls">
      <div><h2 id="account-controls" className={styles.cardTitle}>Account & appearance</h2><p className={styles.cardHint}>Choose your display theme or sign out of your account.</p></div>
      <div className={styles.profileAccountButtons}><ThemeToggle /><button type="button" className={styles.signOut} onClick={requestSignOut}>Sign out</button></div>
    </section>
    <div className={styles.settingsGrid}>
      <ProfilePhotoEditor />
      <NotificationPreferences />
      <ChangePasswordForm email={profile?.email || ''} />
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Personal details</h2><p className={styles.cardHint}>Keep these details accurate for bookings and attendance.</p></div></div><form className={styles.settingsBody} onSubmit={saveDetails}>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-name">Full name</label><input id="profile-name" className={styles.input} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-dob">Date of birth</label><input id="profile-dob" className={styles.input} required type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>
        {corporateRolloutEnabled && <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-phone">Cellphone number (optional)</label><input id="profile-phone" className={styles.input} type="tel" autoComplete="tel" maxLength={25} value={phone} onChange={event => setPhone(event.target.value)} /><p className={styles.cardHint}>Add a number if you would like the team to be able to contact you by phone.</p></div>}
        {profileError && <div className={styles.messageError} role="alert">{profileError}</div>}
        <div className={styles.modalActions}><button className={styles.primaryButton} disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save details"}</button></div>
      </form></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Email address</h2><p className={styles.cardHint}>Follow the confirmation links sent by email to finish changing your sign-in address.</p></div></div><form className={styles.settingsBody} onSubmit={changeEmail}>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="profile-email">Email address</label><input id="profile-email" className={styles.input} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        {emailError && <div className={styles.messageError} role="alert">{emailError}</div>}
        <div className={styles.modalActions}><button className={styles.secondaryButton} disabled={email === profile?.email || isSavingEmail}>{isSavingEmail ? "Requesting..." : "Request email change"}</button></div>
      </form></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Volunteer acknowledgements</h2><p className={styles.cardHint}>Your current onboarding consent record.</p></div></div><div className={styles.settingsBody}><div className={styles.consentSummary}><span>Code of conduct</span><strong>{consent?.code_of_conduct_accepted ? "Accepted" : "Not recorded"}</strong><span>Information use</span><strong>{consent?.data_use_accepted ? "Accepted" : "Not recorded"}</strong><span>Information accuracy</span><strong>{consent?.information_accuracy_accepted ? "Accepted" : "Not recorded"}</strong></div>{consent?.accepted_at && <p className={styles.cardHint}>Accepted on {new Date(consent.accepted_at).toLocaleDateString("en-ZA")}</p>}</div></section>
    </div>
  </>;
}

import LoginForm from '@/app/components/LoginForm';

/** Existing registration links open the same entry screen, not the corporate dashboard layout. */
export default function CorporateRegistrationPage() {
  return <LoginForm initialMode="business" />;
}

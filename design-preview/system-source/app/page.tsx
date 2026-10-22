/** The public home route delegates account access to the interactive login component. */
import LoginForm from "./components/LoginForm";

/** Renders the account entry screen; profile-based redirects happen inside LoginForm. */
export default function LoginPage() {
  return <LoginForm />;
}

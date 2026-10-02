"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./ThemeToggle";
import PortalLoadingScreen from "./PortalLoadingScreen";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function redirectIfAlreadyLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profileData) {
        setIsRedirecting(true);
        router.replace("/volunteer");
        return;
      }

      setIsRedirecting(true);
      router.replace(profileData.role === "admin" ? "/admin" : "/volunteer");
    }

    redirectIfAlreadyLoggedIn();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setMessage(`Error: ${authError.message}`);
      setIsLoading(false);
      return;
    }

    if (authData.user) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        setMessage(`Logged in, but couldn't fetch role: ${profileError.message}`);
        setIsLoading(false);
        return;
      }

      setIsRedirecting(true);
      router.replace(profileData?.role === "admin" ? "/admin" : "/volunteer");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast || !dateOfBirth || !email || !password) {
      setMessage("Please fill out your First Name, Last Name, Date of Birth, Email, and Password.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const combinedFullName = `${cleanFirst} ${cleanLast}`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: combinedFullName,
          date_of_birth: dateOfBirth,
        },
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Success! Please check your email for a confirmation link before logging in.");
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setPassword("");
      setIsSignUp(false);
    }

    setIsLoading(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setMessage("Please enter your email address first.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Password reset link sent! Please check your email inbox.");
      setEmail("");
    }
    setIsLoading(false);
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/volunteer`,
      },
    });

    if (error) setMessage(`Google Error: ${error.message}`);
  }

  if (isRedirecting) {
    return <PortalLoadingScreen message="Ladles of Love is securely opening your portal…" />;
  }

  function changeMode(signUp: boolean) { setIsSignUp(signUp); setIsForgotPassword(false); setMessage(""); setShowPassword(false); }
  const title = isForgotPassword ? "Reset your password" : isSignUp ? "Start making a difference" : "Welcome back";
  return <main className={styles.page}>
    <header className={styles.header}><ThemeToggle /></header>
    <div className={styles.layout}>
      <section className={styles.formSide} aria-labelledby="auth-title"><div className={styles.brand}><Image src="/Ladles-logo.png" alt="Ladles of Love" width={68} height={68} preload /><span><strong>LADLES OF LOVE</strong><small>VOLUNTEER PORTAL</small></span></div><div className={styles.card}>
        {!isForgotPassword && <div className={styles.tabs} aria-label="Account access"><button type="button" disabled={isLoading} aria-pressed={!isSignUp} onClick={()=>changeMode(false)}>Sign in</button><button type="button" disabled={isLoading} aria-pressed={isSignUp} onClick={()=>changeMode(true)}>Create account</button></div>}
        <span className={styles.eyebrow}>{isForgotPassword ? "Account recovery" : isSignUp ? "Join the community" : "Your next act of kindness starts here"}</span><h2 id="auth-title">{title}</h2><p className={styles.intro}>{isForgotPassword ? "Enter your email and we’ll send you a reset link." : isSignUp ? "Create your volunteer account to book shifts and track your contribution." : "Manage your shifts and view your impact."}</p>
        <form onSubmit={isForgotPassword ? handleResetPassword : isSignUp ? handleSignUp : handleLogin} aria-busy={isLoading}><fieldset className={styles.fields} disabled={isLoading}><legend className={styles.srOnly}>{title}</legend>
          {isSignUp && !isForgotPassword && <><div className={styles.nameRow}><div className={styles.field}><label htmlFor="first-name">First name</label><input id="first-name" autoComplete="given-name" required value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" /></div><div className={styles.field}><label htmlFor="last-name">Last name</label><input id="last-name" autoComplete="family-name" required value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" /></div></div><div className={styles.field}><label htmlFor="birth-date">Date of birth</label><input id="birth-date" type="date" autoComplete="bday" required max={new Date().toISOString().slice(0,10)} value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} /></div></>}
          <div className={styles.field}><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></div>
          {!isForgotPassword && <div className={styles.field}><div className={styles.labelRow}><label htmlFor="auth-password">Password</label>{!isSignUp && <button className={styles.textButton} type="button" onClick={()=>{setIsForgotPassword(true);setMessage("");}}>Forgot password?</button>}</div><div className={styles.password}><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={isSignUp ? "Create a password" : "Enter your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></div>}
          {message && <div className={/error|failed|please fill|couldn't/i.test(message) ? styles.error : styles.notice} role="status">{message}</div>}
          <button type="submit" className={styles.submit}>{isLoading ? "Please wait…" : isForgotPassword ? "Send reset link" : isSignUp ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button>
        </fieldset></form>
        {!isForgotPassword ? <><div className={styles.divider}><span>or continue with</span></div><button type="button" className={styles.google} disabled={isLoading} onClick={handleGoogleLogin}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.2 5.2-4.7 6.8v5.6h7.6c4.5-4.1 7-10.2 7-16.4z" /><path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.4v6.1C6.4 41.8 14.6 47 24 47z" /><path fill="#FBBC04" d="M10.3 27.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5v-6.1H2.4C.9 15.5 0 19.6 0 24s.9 8.5 2.4 11.6l7.9-8.1z" /><path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.7l7-7C36.2 2.1 30.5 0 24 0 14.6 0 6.4 5.2 2.4 12.9l7.9 6.1C12.2 13.8 17.6 9.5 24 9.5z" /></svg>Continue with Google</button><p className={styles.footer}>{isSignUp ? "Already part of the community?" : "New to volunteering?"} <button type="button" disabled={isLoading} className={styles.textButton} onClick={()=>changeMode(!isSignUp)}>{isSignUp ? "Sign in" : "Create an account"}</button></p></> : <p className={styles.footer}><button type="button" disabled={isLoading} className={styles.textButton} onClick={()=>changeMode(false)}>← Back to sign in</button></p>}
      </div><p className={styles.support}>Your time matters. Thank you for choosing to give it.</p></section>
    </div>
  </main>;
}

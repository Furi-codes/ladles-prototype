"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

// --- CLOUD CONNECTION ---
const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginPage() {
  const router = useRouter();
  
  // --- STATE ---
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false); // NEW STATE
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // --- AUTH FUNCTIONS ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

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

      if (profileError) {
        setMessage(`Logged in, but couldn't fetch role: ${profileError.message}`);
        setIsLoading(false);
        return;
      }

      if (profileData.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/volunteer");
      }
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast || !email || !password) {
      setMessage("Please fill out your First Name, Last Name, Email, and Password.");
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
          full_name: combinedFullName
        }
      }
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Success! Please check your email for a confirmation link before logging in.");
      setFirstName("");
      setLastName("");
      setPassword("");
      setIsSignUp(false); 
    }
    
    setIsLoading(false);
  }

  // --- NEW: FORGOT PASSWORD FUNCTION ---
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setMessage("Please enter your email address first.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    // Tells Supabase to send an email, and when they click it, route them to our new page
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Password reset link sent! Please check your email inbox.");
      // Clear out the email box just in case
      setEmail(""); 
    }
    setIsLoading(false);
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/volunteer`
      }
    });
    if (error) setMessage(`Google Error: ${error.message}`);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "6px", background: "#ef3a40", zIndex: 100 }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "440px", padding: "0 20px", position: "relative", zIndex: 1 }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "90px", height: "90px", borderRadius: "50%", margin: "0 auto 16px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <Image src="/ladles-logo.png" alt="Ladles of Love" width={90} height={90} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#2b3336", margin: "0 0 4px", letterSpacing: "-0.5px" }}>LADLES OF LOVE</h1>
          <p style={{ fontSize: "12px", color: "#ef3a40", margin: 0, letterSpacing: "2px", textTransform: "uppercase", fontStyle: "italic" }}>feeding the soul</p>
        </div>

        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "40px 36px", width: "100%", boxShadow: "0 8px 40px rgba(43,51,54,0.10)", border: "1px solid #e0e0e0" }}>
          
          <h2 style={{ fontSize: "22px", color: "#2b3336", margin: "0 0 4px", fontWeight: "800" }}>
            {isForgotPassword ? "Reset Password" : (isSignUp ? "Create an Account" : "Sign in")}
          </h2>
          <p style={{ fontSize: "13px", color: "#666", margin: "0 0 28px" }}>
            {isForgotPassword ? "We will send you a secure link to reset your password." : (isSignUp ? "Join our volunteer community" : "Access your volunteer dashboard")}
          </p>

          <form onSubmit={isForgotPassword ? handleResetPassword : (isSignUp ? handleSignUp : handleLogin)}>
            
            {isSignUp && !isForgotPassword && (
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#2b3336", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>First Name</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" style={{ width: "100%", padding: "12px 14px", borderRadius: "6px", border: "1.5px solid #ddd", background: "#f3f3f3", fontSize: "14px", color: "#2b3336", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#2b3336", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>Last Name</label>
                  <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" style={{ width: "100%", padding: "12px 14px", borderRadius: "6px", border: "1.5px solid #ddd", background: "#f3f3f3", fontSize: "14px", color: "#2b3336", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#2b3336", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", padding: "12px 14px", borderRadius: "6px", border: "1.5px solid #ddd", background: "#f3f3f3", fontSize: "14px", color: "#2b3336", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* ONLY show password if we are NOT in forgot password mode */}
            {!isForgotPassword && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#2b3336", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!isForgotPassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "6px", border: "1.5px solid #ddd", background: "#f3f3f3", fontSize: "14px", color: "#2b3336", outline: "none", boxSizing: "border-box", paddingRight: "60px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: "11px", fontWeight: "700", color: "#666", cursor: "pointer", letterSpacing: "0.5px" }}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {!isSignUp && (
                  <div style={{ textAlign: "right", marginTop: "6px" }}>
                    <span 
                      onClick={() => {
                        setIsForgotPassword(true);
                        setMessage("");
                      }} 
                      style={{ fontSize: "12px", color: "#ef3a40", cursor: "pointer", fontWeight: "600" }}
                    >
                      Forgot password?
                    </span>
                  </div>
                )}
              </div>
            )}

            {message && (
              <div style={{ padding: "10px", marginBottom: "16px", borderRadius: "6px", background: message.includes("Error") || message.includes("failed") ? "#fee2e2" : "#dcfce7", color: message.includes("Error") || message.includes("failed") ? "#ef3a40" : "#16a34a", fontSize: "12px", textAlign: "center", fontWeight: "600", lineHeight: "1.4" }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={isLoading} style={{ width: "100%", padding: "14px", borderRadius: "6px", border: "none", background: "#ef3a40", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px", boxShadow: "0 4px 14px rgba(239,58,64,0.35)", transition: "background 0.2s" }} onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#2b3336"} onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40"}>
              {isLoading ? "Loading..." : (isForgotPassword ? "Send Reset Link" : (isSignUp ? "Sign Up" : "Sign In"))}
            </button>
          </form>

          {/* Hide social login and sign-up toggle if in forgot password mode */}
          {!isForgotPassword ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
                <span style={{ fontSize: "12px", color: "#aaa" }}>or</span>
                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
              </div>

              <button onClick={handleGoogleLogin} type="button" style={{ width: "100%", padding: "13px", borderRadius: "6px", border: "1.5px solid #ddd", background: "#fff", color: "#2b3336", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "background 0.2s" }} onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#f3f3f3"} onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#fff"}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.2 5.2-4.7 6.8v5.6h7.6c4.5-4.1 7-10.2 7-16.4z" />
                  <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.4v6.1C6.4 41.8 14.6 47 24 47z" />
                  <path fill="#FBBC04" d="M10.3 27.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5v-6.1H2.4C.9 15.5 0 19.6 0 24s.9 8.5 2.4 11.6l7.9-8.1z" />
                  <path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.7l7-7C36.2 2.1 30.5 0 24 0 14.6 0 6.4 5.2 2.4 12.9l7.9 6.1C12.2 13.8 17.6 9.5 24 9.5z" />
                </svg>
                Continue with Google
              </button>

              <p style={{ textAlign: "center", fontSize: "13px", color: "#666", margin: "20px 0 0" }}>
                {isSignUp ? "Already have an account? " : "New volunteer? "}
                <span onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }} style={{ color: "#ef3a40", fontWeight: "700", cursor: "pointer" }}>
                  {isSignUp ? "Sign in instead" : "Create an account"}
                </span>
              </p>
            </>
          ) : (
            <p style={{ textAlign: "center", fontSize: "13px", color: "#666", margin: "20px 0 0" }}>
              Remember your password?{" "}
              <span onClick={() => { setIsForgotPassword(false); setMessage(""); }} style={{ color: "#ef3a40", fontWeight: "700", cursor: "pointer" }}>
                Back to login
              </span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

// --- CLOUD CONNECTION ---
const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  // Check if they actually have permission to be here
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // If they don't have a valid session from the email link, kick them out
        router.push("/");
      } else {
        setIsChecking(false);
      }
    }
    checkUser();
  }, [router]);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) return;
    
    setIsLoading(true);
    setMessage("");

    // Tells Supabase to overwrite their old password with this new one
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Success! Password updated. Redirecting to your dashboard...");
      // Wait 2 seconds so they can read the message, then send them to login
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
    setIsLoading(false);
  }

  if (isChecking) {
    return <div style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center" }}>Verifying secure link...</div>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "6px", background: "#ef3a40", zIndex: 100 }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "440px", padding: "0 20px", position: "relative", zIndex: 1 }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "90px", height: "90px", borderRadius: "50%", margin: "0 auto 16px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <Image src="/ladles-logo.png" alt="Ladles of Love" width={90} height={90} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: "12px", padding: "40px 36px", width: "100%", boxShadow: "0 8px 40px rgba(43,51,54,0.10)", border: "1px solid #e0e0e0" }}>
          <h2 style={{ fontSize: "22px", color: "#2b3336", margin: "0 0 4px", fontWeight: "800" }}>Set New Password</h2>
          <p style={{ fontSize: "13px", color: "#666", margin: "0 0 28px" }}>Please enter your new secure password.</p>

          <form onSubmit={handleUpdatePassword}>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#2b3336", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            </div>

            {message && (
              <div style={{ padding: "10px", marginBottom: "16px", borderRadius: "6px", background: message.includes("Error") ? "#fee2e2" : "#dcfce7", color: message.includes("Error") ? "#ef3a40" : "#16a34a", fontSize: "12px", textAlign: "center", fontWeight: "600", lineHeight: "1.4" }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={isLoading} style={{ width: "100%", padding: "14px", borderRadius: "6px", border: "none", background: "#ef3a40", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px", boxShadow: "0 4px 14px rgba(239,58,64,0.35)", transition: "background 0.2s" }} onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#2b3336"} onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40"}>
              {isLoading ? "Saving..." : "Update Password"}
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}
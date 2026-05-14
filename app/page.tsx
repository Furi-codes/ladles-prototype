"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f3f3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Red top bar */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: "6px",
        background: "#ef3a40",
        zIndex: 100,
      }} />

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "440px",
        padding: "0 20px",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "90px", height: "90px",
            borderRadius: "50%",
            margin: "0 auto 16px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}>
            <Image
              src="/ladles-logo.png"
              alt="Ladles of Love"
              width={90}
              height={90}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
            />
          </div>
          <h1 style={{
            fontSize: "28px",
            fontWeight: "800",
            color: "#2b3336",
            margin: "0 0 4px",
            letterSpacing: "-0.5px",
          }}>
            LADLES OF LOVE
          </h1>
          <p style={{
            fontSize: "12px",
            color: "#ef3a40",
            margin: 0,
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontStyle: "italic",
          }}>
            feeding the soul
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "40px 36px",
          width: "100%",
          boxShadow: "0 8px 40px rgba(43,51,54,0.10)",
          border: "1px solid #e0e0e0",
        }}>
          <h2 style={{
            fontSize: "22px",
            color: "#2b3336",
            margin: "0 0 4px",
            fontWeight: "800",
          }}>
            Sign in
          </h2>
          <p style={{
            fontSize: "13px",
            color: "#666",
            margin: "0 0 28px",
          }}>
            Access your volunteer dashboard
          </p>

          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "700",
              color: "#2b3336",
              marginBottom: "6px",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              defaultValue="volunteer@example.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "6px",
                border: "1.5px solid #ddd",
                background: "#f3f3f3",
                fontSize: "14px",
                color: "#2b3336",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "700",
              color: "#2b3336",
              marginBottom: "6px",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              defaultValue="password123"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "6px",
                border: "1.5px solid #ddd",
                background: "#f3f3f3",
                fontSize: "14px",
                color: "#2b3336",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ textAlign: "right", marginTop: "6px" }}>
              <span style={{
                fontSize: "12px",
                color: "#ef3a40",
                cursor: "pointer",
              }}>
                Forgot password?
              </span>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            onClick={() => router.push("/volunteer")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "6px",
              border: "none",
              background: "#ef3a40",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "12px",
              boxShadow: "0 4px 14px rgba(239,58,64,0.35)",
              transition: "background 0.2s",
            }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#2b3336"}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40"}
          >
            Sign In
          </button>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: "12px", margin: "16px 0",
          }}>
            <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
            <span style={{ fontSize: "12px", color: "#aaa" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }} />
          </div>

          {/* Google Button */}
          <button
            onClick={() => router.push("/volunteer")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "6px",
              border: "1.5px solid #ddd",
              background: "#fff",
              color: "#2b3336",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "background 0.2s",
            }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#f3f3f3"}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#fff"}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.2 5.2-4.7 6.8v5.6h7.6c4.5-4.1 7-10.2 7-16.4z" />
              <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.4v6.1C6.4 41.8 14.6 47 24 47z" />
              <path fill="#FBBC04" d="M10.3 27.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5v-6.1H2.4C.9 15.5 0 19.6 0 24s.9 8.5 2.4 11.6l7.9-8.1z" />
              <path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.7l7-7C36.2 2.1 30.5 0 24 0 14.6 0 6.4 5.2 2.4 12.9l7.9 6.1C12.2 13.8 17.6 9.5 24 9.5z" />
            </svg>
            Continue with Google
          </button>

          {/* Sign Up link */}
          <p style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#666",
            margin: "20px 0 0",
          }}>
            New volunteer?{" "}
            <span
              onClick={() => router.push("/volunteer")}
              style={{ color: "#ef3a40", fontWeight: "700", cursor: "pointer" }}
            >
              Create an account
            </span>
          </p>
        </div>

        {/* Footer */}
        <p style={{
          fontSize: "12px",
          color: "#2b3336",
          opacity: 0.5,
          marginTop: "24px",
          textAlign: "center",
        }}>
          © 2025 Ladles of Love · Nourishing communities, one ladle at a time.
        </p>
      </div>
    </main>
  );
}
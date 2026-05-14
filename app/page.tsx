"use client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a0a00 0%, #3d1a00 40%, #7c3300 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Georgia', serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background circles */}
      <div style={{
        position: "absolute", top: "-120px", left: "-120px",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,140,0,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-80px", right: "-80px",
        width: "400px", height: "400px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,200,50,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Subtle grid texture */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
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

        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
  <div
    style={{
      width: "76px",
      height: "76px",
      borderRadius: "50%",
      margin: "0 auto 18px",
      boxShadow:
        "0 0 0 6px rgba(255,140,0,0.2), 0 8px 32px rgba(255,140,0,0.35)",
      overflow: "hidden",
      position: "relative",
    }}
  >
    <img
      src="/Ladles-logo.png"
      alt="Ladles of Love Logo"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  </div>

  <h1
    style={{
      fontFamily: "'Georgia', serif",
      fontSize: "30px",
      color: "white",
      margin: 0,
    }}
  >
    Ladles of Love
  </h1>

  <p
    style={{
      color: "#d9a15b",
      letterSpacing: "3px",
      marginTop: "8px",
    }}
  >
    VOLUNTEER PORTAL
  </p>
</div>

        {/* Card */}
        <div style={{
          background: "rgba(255,252,245,0.97)",
          borderRadius: "20px",
          padding: "40px 36px",
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 2px 0 rgba(255,180,80,0.4) inset",
          border: "1px solid rgba(255,180,80,0.2)",
        }}>
          <h2 style={{
            fontFamily: "'Georgia', serif",
            fontSize: "22px",
            color: "#2d1200",
            margin: "0 0 6px",
            fontWeight: "700",
          }}>
            Sign in
          </h2>
          <p style={{
            fontFamily: "'Trebuchet MS', sans-serif",
            fontSize: "13px",
            color: "#8c6a40",
            margin: "0 0 28px",
          }}>
            Access your volunteer dashboard
          </p>

          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontFamily: "'Trebuchet MS', sans-serif",
              fontSize: "12px",
              fontWeight: "600",
              color: "#5c3a1a",
              marginBottom: "6px",
              letterSpacing: "0.5px",
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
                borderRadius: "10px",
                border: "1.5px solid #e8d5b5",
                background: "#fffdf9",
                fontFamily: "'Trebuchet MS', sans-serif",
                fontSize: "14px",
                color: "#2d1200",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              display: "block",
              fontFamily: "'Trebuchet MS', sans-serif",
              fontSize: "12px",
              fontWeight: "600",
              color: "#5c3a1a",
              marginBottom: "6px",
              letterSpacing: "0.5px",
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
                borderRadius: "10px",
                border: "1.5px solid #e8d5b5",
                background: "#fffdf9",
                fontFamily: "'Trebuchet MS', sans-serif",
                fontSize: "14px",
                color: "#2d1200",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ textAlign: "right", marginTop: "6px" }}>
              <span style={{
                fontFamily: "'Trebuchet MS', sans-serif",
                fontSize: "12px",
                color: "#d4780a",
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
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #d4780a, #ff8c00)",
              color: "#fff",
              fontFamily: "'Trebuchet MS', sans-serif",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              letterSpacing: "0.5px",
              marginBottom: "12px",
              boxShadow: "0 4px 16px rgba(212,120,10,0.45)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(212,120,10,0.55)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(212,120,10,0.45)";
            }}
          >
            Sign In
          </button>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: "12px", margin: "16px 0",
          }}>
            <div style={{ flex: 1, height: "1px", background: "#e8d5b5" }} />
            <span style={{
              fontFamily: "'Trebuchet MS', sans-serif",
              fontSize: "12px", color: "#b09070",
            }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#e8d5b5" }} />
          </div>

          {/* Google Button */}
          <button
            onClick={() => router.push("/volunteer")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "12px",
              border: "1.5px solid #e8d5b5",
              background: "#fff",
              color: "#2d1200",
              fontFamily: "'Trebuchet MS', sans-serif",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "background 0.2s",
            }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#fff8f0"}
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
            fontFamily: "'Trebuchet MS', sans-serif",
            fontSize: "13px",
            color: "#8c6a40",
            margin: "20px 0 0",
          }}>
            New volunteer?{" "}
            <span
              onClick={() => router.push("/volunteer")}
              style={{ color: "#d4780a", fontWeight: "600", cursor: "pointer" }}
            >
              Create an account
            </span>
          </p>
        </div>

        {/* Footer */}
        <p style={{
          fontFamily: "'Trebuchet MS', sans-serif",
          fontSize: "12px",
          color: "rgba(255,220,160,0.45)",
          marginTop: "28px",
          textAlign: "center",
        }}>
          © 2025 Ladles of Love · Nourishing communities, one ladle at a time.
        </p>
      </div>
    </main>
  );
}
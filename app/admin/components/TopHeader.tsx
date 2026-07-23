import { useRouter } from "next/navigation";

export default function TopHeader({ activeNav }: { activeNav: string }) {
    const router = useRouter();
    return (
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Admin Dashboard</span>
            <span style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>{activeNav}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/volunteer")} style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#e62b32", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              ← Switch to Volunteer View
            </button>
            <div style={{ padding: "5px 12px", borderRadius: "20px", background: "#1a1a1a", border: "1px solid #333", fontSize: "12px", color: "#ffffff", fontWeight: "600" }}>🔴 Online</div>
          </div>
        </header>
    );
}
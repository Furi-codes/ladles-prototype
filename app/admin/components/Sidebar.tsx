import Image from "next/image";

const navLinks = [
  { label: "Dashboard", icon: "📊" },
  { label: "Manage Activities", icon: "📅" },
  { label: "Volunteers", icon: "👥" },
  { label: "Corporate CSR", icon: "🏢" },
  { label: "Export Reports", icon: "📤" },
  { label: "Settings", icon: "⚙️" },
];

export default function Sidebar({ activeNav, setActiveNav }: { activeNav: string; setActiveNav: any}) {
    return (
        <aside style={{ width: "240px", background: "#ffffff", borderRight: "1px solid #e2e8f0", flexShrink: 0, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Image src="/newLogo.png" alt="Ladles of Love Logo" width={45} height={45} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: "800", lineHeight: 1.1, letterSpacing: "-0.5px" }}>Ladles of Love</div>
              <div style={{ fontSize: "10px", color: "#e62b32", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>Admin Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navLinks.map((link) => {
            const isActive = activeNav === link.label;
            return (
              <button
                key={link.label}
                onClick={() => setActiveNav(link.label)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", background: isActive ? "#fef2f2" : "transparent", color: isActive ? "#e62b32" : "#64748b", fontSize: "13px", fontWeight: isActive ? "700" : "600", cursor: "pointer", textAlign: "left", marginBottom: "4px", transition: "background 0.15s, color 0.15s", borderLeft: isActive ? "3px solid #e62b32" : "3px solid transparent" }}
                onMouseOver={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
                onMouseOut={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span>{link.icon}</span> {link.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "16px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "13px", flexShrink: 0 }}>JJ</div>
          <div>
            <div style={{ fontSize: "12px", color: "#1a1a1a", fontWeight: "700" }}>Joe Johnson</div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>Operations Lead</div>
          </div>
        </div>
      </aside>
    );
}
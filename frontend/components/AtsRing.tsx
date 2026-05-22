"use client";

export default function AtsRing({ score }: { score: number }) {
    const radius = 52;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? "#F0F0F0" : score >= 60 ? "#C8C8C8" : "#9A9A9A";
    const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Low";
    const bgColor = score >= 80 ? "rgba(255,255,255,0.06)" : score >= 60 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.035)";

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
            background: bgColor, border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 20px",
        }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="9" />
                <circle
                    cx="60" cy="60" r={radius} fill="none"
                    stroke={color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    transform="rotate(-90 60 60)"
                    style={{ transition: "stroke-dashoffset 1.2s ease" }}
                />
                <text x="60" y="56" textAnchor="middle" fill={color} fontSize="26" fontWeight="800">{score}</text>
                <text x="60" y="72" textAnchor="middle" fill="var(--muted)" fontSize="10" fontWeight="600" letterSpacing="0.5">ATS SCORE</text>
                <text x="60" y="86" textAnchor="middle" fill={color} fontSize="11" fontWeight="600">{label}</text>
            </svg>
        </div>
    );
}

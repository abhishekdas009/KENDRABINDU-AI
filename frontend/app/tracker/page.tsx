import TrackerTable from "@/components/TrackerTable";

export default function TrackerPage() {
    return (
        <div className="mobile-page tracker-page" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="mobile-page-head">
                <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Application Tracker</h1>
                <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>All sent applications and HR replies</p>
            </div>
            <div className="mobile-surface tracker-surface" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px" }}>
                <TrackerTable />
            </div>
        </div>
    );
}

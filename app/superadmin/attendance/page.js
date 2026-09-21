"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ShimmerLoader from "@/components/ShimmerLoader";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function SuperadminAttendancePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [summaryData, setSummaryData] = useState([]);
    const [rawRecords, setRawRecords] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Filters
    const currentDate = new Date();
    const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1); // 1-12
    const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
    const [filterSiteId, setFilterSiteId] = useState("all");
    const [filterRole, setFilterRole] = useState("SUPERVISOR"); // SUPERVISOR | PROJECT_MANAGER

    // View state
    const [viewMode, setViewMode] = useState("LOGS"); // SUMMARY | LOGS

    // Available Sites
    const [sites, setSites] = useState([]);

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await fetch("/api/attendance/sites", { cache: "no-store" });
                if (res.ok) setSites(await res.json());
            } catch (err) {
                console.error("Failed to fetch sites", err);
            }
        };
        fetchSites();
    }, []);

    const fetchAttendanceData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                month: filterMonth,
                year: filterYear,
                siteId: filterSiteId,
                role: filterRole
            });
            const res = await fetch(`/api/attendance/admin?${queryParams}`);

            if (res.status === 401) {
                router.push("/login");
                return;
            }

            const data = await res.json();

            if (res.ok) {
                setSummaryData(data.summary || []);
                setRawRecords(data.rawRecords || []);
            } else {
                toast.error(data.error || "Failed to load attendance data");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred fetching data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendanceData();
    }, [filterMonth, filterYear, filterSiteId, filterRole]);

    const handleLogout = async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return formatDateDDMMYYYY(dateString);
    };

    const formatTime = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleTimeString("en-IN", {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const months = [
        { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
        { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
        { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
        { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
    ];

    const years = [2024, 2025, 2026, 2027, 2028];

    return (
        <div style={{ minHeight: "100vh" }} className="responsive-root">
            <div className="bg-mesh-custom" />
            <div className="orb1" />
            <div className="orb2" />

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}>
                <button className="mobile-menu-close" onClick={() => setIsMenuOpen(false)}>✕</button>
                <div style={{ marginBottom: "24px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Admin Actions</div>
                </div>
                <button className="mobile-menu-link" onClick={() => { setIsMenuOpen(false); router.push("/superadmin/dashboard"); }}>
                    <span>🏠</span> Dashboard
                </button>
                <button className="mobile-menu-link" style={{ width: "100%", background: "rgba(248, 113, 113, 0.05)", borderColor: "rgba(248, 113, 113, 0.2)", color: "var(--danger)", marginTop: "16px" }} onClick={handleLogout}>
                    <span>🚪</span> Sign Out
                </button>
            </div>

            {/* Header */}
            <header className="page-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => router.push("/superadmin/dashboard")}>
                    <Image src="/Logo_1.png" alt="Solar Logo" width={240} height={36} style={{ borderRadius: '8px' }} />
                </div>
                <div className="nav-desktop">
                    <button className="btn-ghost" onClick={() => router.push("/superadmin/dashboard")}>Dashboard</button>
                    <button className="btn-ghost" onClick={handleLogout}>Sign Out</button>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor" />
                            <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" />
                            <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="page-content">
                <div className="fade-up" style={{ maxWidth: "1200px", margin: "0 auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "32px" }}>
                        <div style={{ textAlign: "center", padding: "0 16px" }}>
                            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text)" }}>
                                {filterRole === "PROJECT_MANAGER" ? "Manager" : "Supervisor"} Attendance 📍
                            </h1>
                            <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Monitor workforce presence and completed shifts.</p>
                        </div>

                        {/* Filters and Controls */}
                        <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>

                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                {/* Role filter toggle */}
                                <div style={{ display: "flex", gap: "0", background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "3px", alignSelf: "center" }}>
                                    <button
                                        onClick={() => setFilterRole("SUPERVISOR")}
                                        style={{
                                            padding: "7px 16px",
                                            borderRadius: "6px",
                                            background: filterRole === "SUPERVISOR" ? "var(--primary)" : "transparent",
                                            color: filterRole === "SUPERVISOR" ? "#fff" : "var(--text-muted)",
                                            border: "none",
                                            cursor: "pointer",
                                            fontWeight: "600",
                                            fontSize: "13px",
                                            transition: "all 0.2s ease",
                                            whiteSpace: "nowrap"
                                        }}>
                                        👷 Supervisor
                                    </button>
                                    <button
                                        onClick={() => setFilterRole("PROJECT_MANAGER")}
                                        style={{
                                            padding: "7px 16px",
                                            borderRadius: "6px",
                                            background: filterRole === "PROJECT_MANAGER" ? "var(--primary)" : "transparent",
                                            color: filterRole === "PROJECT_MANAGER" ? "#fff" : "var(--text-muted)",
                                            border: "none",
                                            cursor: "pointer",
                                            fontWeight: "600",
                                            fontSize: "13px",
                                            transition: "all 0.2s ease",
                                            whiteSpace: "nowrap"
                                        }}>
                                        📋 Manager
                                    </button>
                                </div>

                                <select
                                    className="form-input"
                                    style={{ width: "auto", minWidth: "150px" }}
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(Number(e.target.value))}
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>

                                <select
                                    className="form-input"
                                    style={{ width: "auto" }}
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(Number(e.target.value))}
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>

                                <select
                                    className="form-input"
                                    style={{ width: "auto", minWidth: "200px" }}
                                    value={filterSiteId}
                                    onChange={(e) => setFilterSiteId(e.target.value)}
                                >
                                    <option value="all">All Projects</option>
                                    {sites.map(site => (
                                        <option key={site.id} value={site.id}>{site.name.replace(" - Site", "")}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "8px" }}>
                                <button
                                    onClick={() => setViewMode("SUMMARY")}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "6px",
                                        background: viewMode === "SUMMARY" ? "var(--primary)" : "transparent",
                                        color: viewMode === "SUMMARY" ? "#fff" : "var(--text-muted)",
                                        border: "none",
                                        cursor: "pointer",
                                        fontWeight: "600",
                                        transition: "all 0.2s ease"
                                    }}>
                                    Summary
                                </button>
                                <button
                                    onClick={() => setViewMode("LOGS")}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "6px",
                                        background: viewMode === "LOGS" ? "var(--primary)" : "transparent",
                                        color: viewMode === "LOGS" ? "#fff" : "var(--text-muted)",
                                        border: "none",
                                        cursor: "pointer",
                                        fontWeight: "600",
                                        transition: "all 0.2s ease"
                                    }}>
                                    Detailed Logs
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <ShimmerLoader />
                        ) : (
                            <>
                                {viewMode === "SUMMARY" && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                                        {summaryData.length === 0 ? (
                                            <p style={{ color: "var(--text-muted)", textAlign: "center", width: "100%" }}>No attendance data found for this period.</p>
                                        ) : (
                                            summaryData.map(sup => (
                                                <div key={sup.user.id} className="glass-panel hover-lift" style={{ padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "bold", color: "#fff" }}>
                                                            {sup.user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>{sup.user.name}</div>
                                                            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{sup.user.phone}</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.1)", padding: "12px", borderRadius: "8px" }}>
                                                        <div>
                                                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Days Present</div>
                                                            <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text)" }}>{sup.daysPresent}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Days Worked</div>
                                                            <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--success)" }}>{sup.daysWorked}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {viewMode === "LOGS" && (
                                    <div className="glass-panel" style={{ overflowX: "auto", borderRadius: "12px" }}>
                                        {rawRecords.length === 0 ? (
                                            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>No attendance logs found for this period.</p>
                                        ) : (
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                                                <thead>
                                                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Date</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>{filterRole === "PROJECT_MANAGER" ? "Manager" : "Supervisor"}</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Check-In Site</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Check-Out Site</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Check-In</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Check-Out</th>
                                                        <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rawRecords.map(record => (
                                                        <tr key={record.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)" }}>{formatDate(record.checkInTime)}</td>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)" }}>{record.user?.name || "Unknown"}</td>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)" }}>{record.checkInSite?.name || "Unknown"}</td>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)", color: record.checkOutSite ? "var(--text)" : "var(--text-muted)", fontStyle: record.checkOutSite ? "normal" : "italic" }}>{record.checkOutSite?.name || "—"}</td>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)" }}>{formatTime(record.checkInTime)}</td>
                                                            <td style={{ padding: "16px", fontSize: "14px", color: "var(--text)" }}>{formatTime(record.checkOutTime)}</td>
                                                            <td style={{ padding: "16px" }}>
                                                                <span style={{
                                                                    padding: "4px 8px",
                                                                    borderRadius: "4px",
                                                                    fontSize: "12px",
                                                                    fontWeight: "600",
                                                                    background: record.status === "CHECKED_IN" ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                                    color: record.status === "CHECKED_IN" ? "#3b82f6" : "var(--success)"
                                                                }}>
                                                                    {record.status.replace("_", " ")}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

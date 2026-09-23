"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ShimmerLoader from "@/components/ShimmerLoader";

export default function AttendancePage() {
    const router = useRouter();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gpsStatus, setGpsStatus] = useState("Idle");
    const [location, setLocation] = useState(null);

    // For site selection
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState("");

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const fetchStatusAndSites = async () => {
        setLoading(true);
        try {
            // Fetch Status
            const resStatus = await fetch("/api/attendance/status", { cache: "no-store" });
            const dataStatus = await resStatus.json();

            if (resStatus.ok) {
                setStatus(dataStatus);
            } else {
                toast.error(dataStatus.error || "Failed to load status");
            }

            // Always fetch sites — needed for both check-in and check-out so
            // the user can select whichever site they are currently visiting.
            const resSites = await fetch("/api/attendance/sites", { cache: "no-store" });
            const dataSites = await resSites.json();
            if (resSites.ok) {
                setSites(dataSites);
                // Pre-select the first site only when no selection exists yet;
                // preserve any existing selection when refreshing after actions.
                if (dataSites.length > 0 && !selectedSiteId) {
                    setSelectedSiteId(dataSites[0].id);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatusAndSites();
    }, []);

    const requestLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                setGpsStatus("Geolocation not supported");
                reject(new Error("Geolocation is not supported by your browser"));
            } else {
                setGpsStatus("Fetching location...");
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const loc = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                        };
                        setLocation(loc);
                        setGpsStatus(`Accuracy: ${Math.round(loc.accuracy)}m`);
                        resolve(loc);
                    },
                    (error) => {
                        setGpsStatus("GPS Disabled or Denied");
                        reject(error);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        });
    };

    const handleAction = async (actionType) => {
        try {
            // Site selection is required for both check-in and check-out.
            // On checkout the selected site is the one the user is currently at
            // (which may differ from the check-in site).
            if (!selectedSiteId) {
                toast.error(
                    actionType === "check-in"
                        ? "Please select a site to check in."
                        : "Please select the site you are currently at to check out."
                );
                return;
            }

            let currentLoc = location;
            // Fetch fresh location on action
            currentLoc = await requestLocation();
            if (!currentLoc) return;

            setLoading(true);
            const endpoint = actionType === "check-in" ? "/api/attendance/check-in" : "/api/attendance/check-out";

            // The key name differs between the two endpoints:
            //   check-in  → siteId         (unchanged backend contract)
            //   check-out → checkoutSiteId  (new: lets the user check out from a different site)
            const payload = {
                ...currentLoc,
                ...(actionType === "check-in" ? { siteId: selectedSiteId } : { checkoutSiteId: selectedSiteId })
            };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setLocationError(null);
                toast.success(data.message);
                fetchStatusAndSites();
            } else {
                // Parse distance error for visual banner
                const msg = data.message || "Action failed";
                const distanceMatch = msg.match(/Distance:\s*(\d+)m.*Allowed:\s*(\d+)m/);
                if (distanceMatch) {
                    setLocationError({
                        distance: parseInt(distanceMatch[1]),
                        allowed: parseInt(distanceMatch[2]),
                        message: msg,
                    });
                    // Auto-dismiss after 8 seconds
                    setTimeout(() => setLocationError(null), 8000);
                } else {
                    toast.error(msg);
                }
            }
        } catch (error) {
            toast.error(error.message || "Could not fetch location. Please enable GPS.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
    };

    return (
        <div style={{ minHeight: "100vh" }} className="responsive-root">
            <div className="bg-mesh-custom" />
            <div className="orb1" />
            <div className="orb2" />

            {/* Scoped Styles */}
            <style>{`
                @keyframes attendancePulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.8); opacity: 0; }
                }
                @keyframes attendanceBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes attendanceGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(var(--attendance-glow-rgb, 217, 119, 6), 0.15); }
                    50% { box-shadow: 0 0 40px rgba(var(--attendance-glow-rgb, 217, 119, 6), 0.3); }
                }
                @keyframes attendanceShimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .attendance-hero-icon {
                    animation: attendanceBounce 2s ease-in-out infinite;
                }
                .attendance-pulse-ring {
                    animation: attendancePulse 2s ease-in-out infinite;
                }
                .attendance-card {
                    animation: attendanceGlow 3s ease-in-out infinite;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .attendance-status-row {
                    transition: background 0.2s ease;
                    border-radius: 10px;
                    padding: 12px 14px;
                }
                .attendance-status-row:hover {
                    background: rgba(0, 0, 0, 0.02);
                }
                .attendance-select-wrapper {
                    position: relative;
                }
                .attendance-select-wrapper::after {
                    content: '';
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 6px solid var(--muted-foreground);
                    pointer-events: none;
                }
                .attendance-select {
                    width: 100%;
                    padding: 14px 40px 14px 16px;
                    background: var(--background);
                    border: 1.5px solid var(--border);
                    border-radius: 12px;
                    color: var(--foreground);
                    font-size: 15px;
                    font-family: inherit;
                    font-weight: 500;
                    outline: none;
                    cursor: pointer;
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .attendance-select:focus {
                    border-color: var(--ring);
                    box-shadow: 0 0 0 3px oklch(0.6996 0.2020 44.4414 / 0.15);
                }
                .attendance-select:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .attendance-checkin-btn {
                    width: 100%;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, oklch(0.6996 0.2020 44.4414), oklch(0.6200 0.2020 44.4414));
                    color: #fff;
                    border: none;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 700;
                    font-family: inherit;
                    cursor: pointer;
                    letter-spacing: 0.02em;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: opacity 0.2s, transform 0.15s, box-shadow 0.3s;
                    box-shadow: 0 4px 16px oklch(0.6996 0.2020 44.4414 / 0.35);
                    position: relative;
                    overflow: hidden;
                }
                .attendance-checkin-btn::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                    background-size: 200% 100%;
                    animation: attendanceShimmer 3s ease-in-out infinite;
                }
                .attendance-checkin-btn:hover:not(:disabled) {
                    opacity: 0.95;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px oklch(0.6996 0.2020 44.4414 / 0.45);
                }
                .attendance-checkin-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .attendance-checkin-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .attendance-checkin-btn:disabled::before {
                    animation: none;
                }
                .attendance-checkout-btn {
                    width: 100%;
                    padding: 16px 24px;
                    border: 2px solid var(--border);
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 700;
                    font-family: inherit;
                    cursor: pointer;
                    letter-spacing: 0.02em;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    background: var(--background);
                    color: var(--muted-foreground);
                }
                .attendance-checkout-btn.ready {
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-color: transparent;
                    color: #fff;
                    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
                }
                .attendance-checkout-btn.ready::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                    background-size: 200% 100%;
                    animation: attendanceShimmer 3s ease-in-out infinite;
                }
                .attendance-checkout-btn.ready:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45);
                }
                .attendance-checkout-btn:disabled {
                    cursor: not-allowed;
                }
                .attendance-timer-container {
                    position: relative;
                    padding: 28px 20px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, oklch(0.6996 0.2020 44.4414 / 0.06), oklch(0.6996 0.2020 44.4414 / 0.02));
                    border: 1.5px solid oklch(0.6996 0.2020 44.4414 / 0.15);
                    text-align: center;
                    overflow: hidden;
                }
                .attendance-timer-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, oklch(0.6996 0.2020 44.4414 / 0.5), transparent);
                }
                @media (max-width: 480px) {
                    .attendance-card {
                        padding: 20px !important;
                    }
                }
            `}</style>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}>
                <button className="mobile-menu-close" onClick={() => setIsMenuOpen(false)}>✕</button>
                <div style={{ marginBottom: "24px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Field Operations</div>
                </div>

                <button className="mobile-menu-link" onClick={() => { setIsMenuOpen(false); router.push("/supervisor/dashboard"); }}>
                    <span>🏠</span> Dashboard
                </button>

                <button className="mobile-menu-link" style={{ width: "100%", background: "rgba(248, 113, 113, 0.05)", borderColor: "rgba(248, 113, 113, 0.2)", color: "var(--danger)", marginTop: "16px" }} onClick={handleLogout}>
                    <span>🚪</span> Sign Out
                </button>
            </div>

            {/* Header */}
            <header className="page-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => router.push("/supervisor/dashboard")}>
                    <Image
                        src="/Logo_1.png"
                        alt="Solar Logo"
                        width={240}
                        height={36}
                        style={{ borderRadius: '8px' }}
                    />
                </div>
                <div className="nav-desktop">
                    <button className="btn-ghost" onClick={() => router.push("/supervisor/dashboard")}>Dashboard</button>
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
                {loading && !status ? (
                    <ShimmerLoader />
                ) : (
                    <div className="fade-up" style={{ maxWidth: "480px", margin: "0 auto" }}>

                        {/* Hero Section */}
                        <div style={{ textAlign: "center", marginBottom: "28px", padding: "0 16px" }}>
                            {/* Animated location icon */}
                            {/* <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                                <div className="attendance-pulse-ring" style={{
                                    position: "absolute",
                                    width: "72px",
                                    height: "72px",
                                    borderRadius: "50%",
                                    border: "2px solid",
                                    borderColor: status?.checkedIn ? "var(--success)" : "oklch(0.6996 0.2020 44.4414 / 0.4)",
                                }} />
                                <div className="attendance-hero-icon" style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "50%",
                                    background: status?.checkedIn
                                        ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.08))"
                                        : "linear-gradient(135deg, oklch(0.6996 0.2020 44.4414 / 0.12), oklch(0.6996 0.2020 44.4414 / 0.06))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "28px",
                                }}>
                                    {status?.checkedIn ? "🟢" : "📍"}
                                </div>
                            </div> */}

                            <h1 style={{ fontSize: "26px", fontWeight: "700", color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                                {status?.checkedIn ? "You&apos;re Checked In" : "Attendance"}
                            </h1>
                            <p style={{ color: "var(--muted-foreground)", marginTop: "6px", fontSize: "15px" }}>
                                {status?.checkedIn ? "Your shift is currently active" : "Check in to your project location"}
                            </p>
                        </div>

                        {/* Main Card */}
                        <div className="attendance-card glass-card" style={{ padding: "28px", borderRadius: "20px" }}>

                            <>
                                    {/* ── Today's Sessions (multiple check-in/out cycles) ── */}
                                    {status?.sessions?.length > 0 && (
                                        <div style={{
                                            background: "var(--background)",
                                            borderRadius: "14px",
                                            border: "1px solid var(--border)",
                                            marginBottom: "20px",
                                            padding: "14px 16px",
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                                    Today&apos;s Sessions ({status.sessionCountToday})
                                                </span>
                                                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--foreground)" }}>
                                                    {Math.floor((status.totalMinutesToday || 0) / 60)}h {(status.totalMinutesToday || 0) % 60}m total
                                                </span>
                                            </div>
                                            {status.sessions.map((s) => (
                                                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "6px 0", color: "var(--muted-foreground)" }}>
                                                    <span>{s.site?.name || "Unknown Site"}</span>
                                                    <span>
                                                        {new Date(s.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        {" – "}
                                                        {s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In progress"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── Status Info Section ────────────── */}
                                    <div style={{
                                        background: "var(--background)",
                                        borderRadius: "14px",
                                        border: "1px solid var(--border)",
                                        marginBottom: "20px",
                                        overflow: "hidden",
                                    }}>
                                        {/* Status Row */}
                                        <div className="attendance-status-row" style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "14px 16px",
                                            borderBottom: "1px solid var(--border)",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{
                                                    width: "32px",
                                                    height: "32px",
                                                    borderRadius: "8px",
                                                    background: status?.checkedIn
                                                        ? "rgba(16, 185, 129, 0.1)"
                                                        : "oklch(0.6996 0.2020 44.4414 / 0.1)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "15px",
                                                }}>
                                                    {status?.checkedIn ? "⚡" : "🔵"}
                                                </div>
                                                <span style={{ color: "var(--muted-foreground)", fontSize: "14px", fontWeight: "500" }}>Status</span>
                                            </div>
                                            <span style={{
                                                fontWeight: "600",
                                                fontSize: "13px",
                                                padding: "5px 12px",
                                                borderRadius: "20px",
                                                background: status?.checkedIn
                                                    ? (status.canCheckout ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)")
                                                    : "oklch(0.6996 0.2020 44.4414 / 0.1)",
                                                color: status?.checkedIn
                                                    ? (status.canCheckout ? "var(--success)" : "#3b82f6")
                                                    : "oklch(0.6996 0.2020 44.4414)",
                                            }}>
                                                {status?.checkedIn ? (status.canCheckout ? "Ready to Leave" : "On Duty") : "Ready"}
                                            </span>
                                        </div>

                                        {/* Project Site Row (when checked in) */}
                                        {status?.checkedIn && (
                                            <div className="attendance-status-row" style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "14px 16px",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div style={{
                                                        width: "32px",
                                                        height: "32px",
                                                        borderRadius: "8px",
                                                        background: "rgba(139, 92, 246, 0.1)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "15px",
                                                    }}>🏗️</div>
                                                    <span style={{ color: "var(--muted-foreground)", fontSize: "14px", fontWeight: "500" }}>Site</span>
                                                </div>
                                                <span style={{ fontWeight: "600", color: "var(--foreground)", fontSize: "14px" }}>
                                                    {status.activeSite?.name || "Unknown Site"}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Site Selection (always visible) ── */}
                                    {/* Shown for both check-in and check-out so supervisors/PMs can
                                        record the site they are physically at right now, which may
                                        differ from the site they checked in at earlier in the day. */}
                                    <div style={{ marginBottom: "20px" }}>
                                        <label style={{
                                            display: "block",
                                            fontSize: "13px",
                                            fontWeight: "600",
                                            color: "var(--muted-foreground)",
                                            marginBottom: "8px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}>
                                            {status?.checkedIn ? "Check-Out Site" : "Check-In Site"}
                                        </label>
                                        <div className="attendance-select-wrapper">
                                            <select
                                                className="attendance-select"
                                                value={selectedSiteId}
                                                onChange={(e) => { setSelectedSiteId(e.target.value); setLocationError(null); }}
                                                disabled={loading}
                                            >
                                                {sites.length === 0 && <option value="">No active sites available</option>}
                                                {sites.map(site => (
                                                    <option key={site.id} value={site.id}>{site.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>

                            {/* ── Location Error Banner ────────── */}
                            {locationError && (
                                <div className="fade-up" style={{
                                    marginBottom: "16px",
                                    padding: "20px",
                                    borderRadius: "14px",
                                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.03))",
                                    border: "1.5px solid rgba(239, 68, 68, 0.2)",
                                    position: "relative",
                                    overflow: "hidden",
                                }}>
                                    {/* Top accent line */}
                                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.6), transparent)" }} />

                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                                        {/* Icon */}
                                        <div style={{
                                            width: "44px",
                                            height: "44px",
                                            borderRadius: "12px",
                                            background: "rgba(239, 68, 68, 0.1)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <line x1="5" y1="5" x2="19" y2="19" />
                                            </svg>
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: "15px", fontWeight: "700", color: "#ef4444", marginBottom: "6px" }}>
                                                Not at Valid Location
                                            </div>
                                            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: "1.5", margin: 0, marginBottom: "12px" }}>
                                                You&apos;re too far from the project site. Please move closer and try again.
                                            </p>

                                            {/* Distance badges */}
                                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    padding: "4px 10px",
                                                    borderRadius: "20px",
                                                    background: "rgba(239, 68, 68, 0.08)",
                                                    border: "1px solid rgba(239, 68, 68, 0.15)",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    color: "#ef4444",
                                                }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                                    {locationError.distance}m away
                                                </span>
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    padding: "4px 10px",
                                                    borderRadius: "20px",
                                                    background: "rgba(16, 185, 129, 0.08)",
                                                    border: "1px solid rgba(16, 185, 129, 0.15)",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    color: "var(--success)",
                                                }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="16 12 12 8 8 12" /><line x1="12" y1="16" x2="12" y2="8" /></svg>
                                                    Max {locationError.allowed}m
                                                </span>
                                            </div>
                                        </div>

                                        {/* Dismiss */}
                                        <button
                                            onClick={() => setLocationError(null)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "var(--muted-foreground)",
                                                padding: "4px",
                                                flexShrink: 0,
                                                borderRadius: "6px",
                                                transition: "background 0.2s",
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = "rgba(0,0,0,0.05)"}
                                            onMouseLeave={(e) => e.target.style.background = "none"}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Action Buttons ─────────────────── */}
                            {(
                                <div style={{ marginTop: "8px" }}>
                                    {!status?.checkedIn && (
                                        <button
                                            onClick={() => handleAction("check-in")}
                                            disabled={loading || sites.length === 0}
                                            className="attendance-checkin-btn"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="spinner" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                        <circle cx="12" cy="10" r="3" />
                                                    </svg>
                                                    <span>Check In</span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {status?.checkedIn && (
                                        <button
                                            onClick={() => handleAction("check-out")}
                                            disabled={loading}
                                            className="attendance-checkout-btn ready"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="spinner" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                                        <polyline points="16 17 21 12 16 7" />
                                                        <line x1="21" y1="12" x2="9" y2="12" />
                                                    </svg>
                                                    <span>Check Out</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ── Checkout Info ──────────────────── */}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function WorkerDashboard({ role }) {
    const router = useRouter();
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const todayISO = () => new Date().toISOString().split("T")[0];
    const [newWorker, setNewWorker] = useState({ name: "", phone: "", designation: "", status: "ACTIVE", joining_date: todayISO() });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    const [selectedWorker, setSelectedWorker] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchWorkers = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/workers");
            const data = await res.json();
            setWorkers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkers();
    }, []);

    const handleAddWorker = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        // Phone validation: if provided, must be exactly 10 digits
        if (newWorker.phone && newWorker.phone.length !== 10) {
            setError("Phone number must be exactly 10 digits.");
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/workers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newWorker)
            });
            if (res.ok) {
                setIsAddOpen(false);
                setNewWorker({ name: "", phone: "", designation: "", status: "ACTIVE", joining_date: todayISO() });
                fetchWorkers();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to add worker");
            }
        } catch (err) {
            setError("Server error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteWorker = async (workerId) => {
        if (!confirm("Are you sure you want to delete this worker? This action cannot be undone.")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/workers/${workerId}`, { method: "DELETE" });
            if (res.ok) {
                setSelectedWorker(null);
                fetchWorkers();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete worker");
            }
        } catch (err) {
            alert("Server error while deleting worker");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewDetails = async (workerId) => {
        setDetailLoading(true);
        setSelectedWorker(null);
        try {
            const res = await fetch(`/api/workers/${workerId}`);
            const data = await res.json();
            if (res.ok) {
                setSelectedWorker(data);
            } else {
                console.error("Failed to fetch worker:", data.error);
            }
        } catch (err) {
            console.error("Error fetching worker:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const filteredWorkers = workers.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.designation && w.designation.toLowerCase().includes(search.toLowerCase()))
    );

    const basePath = role === "SUPER_ADMIN" ? "/superadmin/dashboard" : "/manager/dashboard";
    const roleBadgeClass = role === "SUPER_ADMIN" ? "role-super" : "role-manager";
    const roleLabel = role === "SUPER_ADMIN" ? "⚡ Super Admin" : "📋 Manager";

    const thStyle = {
        padding: "14px 16px",
        fontSize: "12px",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600
    };

    const tdStyle = {
        padding: "16px",
        fontSize: "14px",
        borderBottom: "1px solid var(--border)"
    };

    return (
        <div style={{ minHeight: "100vh" }}>
            <div className="bg-mesh" />

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}>
                <button className="mobile-menu-close" onClick={() => setIsMenuOpen(false)}>✕</button>
                <div style={{ marginBottom: "24px", textAlign: "center" }}>
                    <div className={`role-badge ${roleBadgeClass}`} style={{ marginBottom: "12px" }}>{roleLabel}</div>
                </div>
                <Link href={basePath} className="mobile-menu-link" onClick={() => setIsMenuOpen(false)}>
                    <span>🏠</span> Dashboard
                </Link>
                <button
                    className="mobile-menu-link"
                    style={{ width: "100%", background: "rgba(248, 113, 113, 0.05)", borderColor: "rgba(248, 113, 113, 0.2)", color: "var(--danger)" }}
                    onClick={() => router.push("/login")}
                >
                    <span>🚪</span> Sign Out
                </button>
            </div>

            {/* Header */}
            <header className="page-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Image src="/Logo_1.png" alt="Solar Logo" width={240} height={36} style={{ borderRadius: "8px" }} />
                </div>
                <div className="nav-desktop">
                    <Link href={basePath} className="btn-ghost" style={{ textDecoration: "none" }}>← Back to Dashboard</Link>
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

            {/* Main Content */}
            <main className="page-content">
                {/* Title + Add Button */}
                <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "6px" }}>
                            👷 Worker Management
                        </h1>
                        <p style={{ color: "var(--text-muted)", fontSize: "15px", margin: 0 }}>
                            Manage your workforce, vendors, and staff.
                        </p>
                    </div>
                    <button
                        className="btn-primary"
                        style={{ width: "auto", padding: "10px 22px", fontSize: "14px" }}
                        onClick={() => setIsAddOpen(true)}
                    >
                        + Add Worker
                    </button>
                </div>

                {/* Search */}
                <div className="fade-up-2" style={{ marginBottom: "24px" }}>
                    <input
                        className="input-field"
                        style={{ maxWidth: "400px" }}
                        placeholder="Search by name or designation..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="fade-up-3" style={{ overflowX: "auto", maxWidth: "100%" }}>
                    <div className="glass-card" style={{ padding: 0, width: "100%", minWidth: "700px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Designation</th>
                                    <th style={thStyle}>Phone</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                                            Loading workers...
                                        </td>
                                    </tr>
                                ) : filteredWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                                            {search ? "No workers match your search." : "No workers found. Add your first worker above."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWorkers.map(w => (
                                        <tr key={w.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{w.name}</td>
                                            <td style={tdStyle}>{w.designation || "—"}</td>
                                            <td style={tdStyle}>{w.phone || "—"}</td>
                                            <td style={tdStyle}>
                                                <span
                                                    className="role-badge"
                                                    style={{
                                                        background: w.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                                                        color: w.status === "ACTIVE" ? "#10b981" : "var(--text-muted)",
                                                        border: `1px solid ${w.status === "ACTIVE" ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                                                        fontSize: "11px"
                                                    }}
                                                >
                                                    {w.status}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: "right" }}>
                                                <button
                                                    className="btn-ghost"
                                                    style={{ padding: "6px 14px", fontSize: "12px" }}
                                                    onClick={() => handleViewDetails(w.id)}
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Add Worker Modal */}
            {isAddOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 200,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px"
                    }}
                >
                    {/* Backdrop */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.4)",
                            backdropFilter: "blur(4px)"
                        }}
                        onClick={() => setIsAddOpen(false)}
                    />

                    {/* Modal */}
                    <div
                        className="glass-card"
                        style={{
                            position: "relative",
                            width: "100%",
                            maxWidth: "440px",
                            padding: "32px",
                            animation: "fadeUp 0.3s ease both"
                        }}
                    >
                        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>Add New Worker</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>
                            Create a new worker profile.
                        </p>

                        <form onSubmit={handleAddWorker}>
                            {error && (
                                <div className="alert-error" style={{ marginBottom: "16px" }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Full Name
                                </label>
                                <input
                                    className="input-field"
                                    required
                                    value={newWorker.name}
                                    onChange={e => setNewWorker({ ...newWorker, name: e.target.value })}
                                    placeholder="e.g. Ramesh"
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Designation
                                </label>
                                <input
                                    className="input-field"
                                    value={newWorker.designation}
                                    onChange={e => setNewWorker({ ...newWorker, designation: e.target.value })}
                                    placeholder="e.g. Labour, Plumber"
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Phone (Optional)
                                </label>
                                <input
                                    className="input-field"
                                    value={newWorker.phone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setNewWorker({ ...newWorker, phone: val });
                                    }}
                                    placeholder="e.g. 91XXXXXXX"
                                    maxLength={10}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                />
                                {newWorker.phone && newWorker.phone.length > 0 && newWorker.phone.length < 10 && (
                                    <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                                        {10 - newWorker.phone.length} more digit{10 - newWorker.phone.length !== 1 ? "s" : ""} needed
                                    </p>
                                )}
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Joining Date
                                </label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={newWorker.joining_date}
                                    onChange={e => setNewWorker({ ...newWorker, joining_date: e.target.value })}
                                />
                                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                                    Defaults to today's date
                                </p>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => setIsAddOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={isSubmitting}
                                    style={{ width: "auto", padding: "10px 24px" }}
                                >
                                    {isSubmitting ? "Saving..." : "Save Worker"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Worker Detail Modal */}
            {(selectedWorker || detailLoading) && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 200,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px"
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.4)",
                            backdropFilter: "blur(4px)"
                        }}
                        onClick={() => setSelectedWorker(null)}
                    />

                    <div
                        className="glass-card"
                        style={{
                            position: "relative",
                            width: "100%",
                            maxWidth: "560px",
                            maxHeight: "80vh",
                            overflowY: "auto",
                            padding: "32px",
                            animation: "fadeUp 0.3s ease both"
                        }}
                    >
                        {detailLoading ? (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                                Loading worker details...
                            </div>
                        ) : selectedWorker ? (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                                    <div>
                                        <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>{selectedWorker.name}</h2>
                                        <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>
                                            {selectedWorker.designation || "No designation"}
                                        </p>
                                    </div>
                                    <span
                                        className="role-badge"
                                        style={{
                                            background: selectedWorker.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                                            color: selectedWorker.status === "ACTIVE" ? "#10b981" : "var(--text-muted)",
                                            border: `1px solid ${selectedWorker.status === "ACTIVE" ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                                            fontSize: "11px"
                                        }}
                                    >
                                        {selectedWorker.status}
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                                    <div className="stat-card">
                                        <div className="stat-label">Phone</div>
                                        <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "4px" }}>
                                            {selectedWorker.phone || "—"}
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-label">Joining Date</div>
                                        <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "4px" }}>
                                            {selectedWorker.joining_date ? formatDateDDMMYYYY(selectedWorker.joining_date) : "—"}
                                        </div>
                                    </div>
                                    <div className="stat-card" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                                        <div className="stat-label">Total Expenses</div>
                                        <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "4px", color: "#10b981" }}>
                                            ₹{selectedWorker.materials && selectedWorker.materials.length > 0
                                                ? selectedWorker.materials.reduce((sum, m) => sum + (parseFloat(m.quantity) * parseFloat(m.unit_price)), 0).toLocaleString()
                                                : "0"}
                                        </div>
                                    </div>
                                </div>

                                {selectedWorker.address && (
                                    <div style={{ marginBottom: "16px" }}>
                                        <div className="stat-label" style={{ marginBottom: "4px" }}>Address</div>
                                        <p style={{ fontSize: "14px", color: "var(--text-primary)", margin: 0 }}>{selectedWorker.address}</p>
                                    </div>
                                )}

                                {selectedWorker.notes && (
                                    <div style={{ marginBottom: "24px" }}>
                                        <div className="stat-label" style={{ marginBottom: "4px" }}>Notes</div>
                                        <p style={{ fontSize: "14px", color: "var(--text-primary)", margin: 0 }}>{selectedWorker.notes}</p>
                                    </div>
                                )}

                                {/* Linked Materials / Expenses */}
                                <div className="divider" />
                                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                    Linked Expenses ({selectedWorker.materials?.length || 0})
                                </h3>

                                {selectedWorker.materials && selectedWorker.materials.length > 0 ? (
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                                            <thead>
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Material</th>
                                                    <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Qty</th>
                                                    <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Unit Price</th>
                                                    <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Date</th>
                                                    <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>Project</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedWorker.materials.map(m => (
                                                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <td style={{ padding: "10px 8px", fontWeight: 500 }}>{m.name}</td>
                                                        <td style={{ padding: "10px 8px" }}>{m.quantity}</td>
                                                        <td style={{ padding: "10px 8px" }}>₹{parseFloat(m.unit_price).toLocaleString()}</td>
                                                        <td style={{ padding: "10px 8px", color: "var(--text-muted)", fontSize: "12px" }}>
                                                            {m.request?.created_at ? formatDateDDMMYYYY(m.request.created_at) : "—"}
                                                        </td>
                                                        <td style={{ padding: "10px 8px", color: "var(--text-muted)" }}>{m.request?.project?.name || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                                        No expenses linked to this worker yet.
                                    </p>
                                )}

                                {/* Active Reminders */}
                                <div className="divider" />
                                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                    🔔 Active Reminders ({selectedWorker.reminders?.length || 0})
                                </h3>

                                {selectedWorker.reminders && selectedWorker.reminders.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {selectedWorker.reminders.map(r => (
                                            <div key={r.id} style={{
                                                padding: "12px 16px",
                                                background: "rgba(59, 130, 246, 0.04)",
                                                border: "1px solid rgba(59, 130, 246, 0.12)",
                                                borderRadius: "10px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                gap: "8px"
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>{r.reason}</div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                        Every month on day {r.day_of_month} • {r.project?.name || "—"}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#3b82f6" }}>
                                                    ₹{parseFloat(r.amount).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                                        No active reminders for this worker.
                                    </p>
                                )}

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", flexWrap: "wrap", gap: "12px" }}>
                                    {role === "SUPER_ADMIN" && (
                                        <button
                                            className="btn-ghost"
                                            style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.05)" }}
                                            onClick={() => handleDeleteWorker(selectedWorker.id)}
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? "Deleting..." : "🗑️ Delete Worker"}
                                        </button>
                                    )}
                                    <button
                                        className="btn-ghost"
                                        style={{ marginLeft: "auto" }}
                                        onClick={() => setSelectedWorker(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}

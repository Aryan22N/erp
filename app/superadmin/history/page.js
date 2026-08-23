"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ShimmerLoader from "@/components/ShimmerLoader";
import TableShimmerLoader from "@/components/TableShimmerLoader";
import CardShimmerLoader from "@/components/CardShimmerLoader";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function PaymentHistory() {
    const [requests, setRequests] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Show shimmer for initial load
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000);
        
        return () => clearTimeout(timer);
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            // Always send status explicitly: "ALL" = no status filter (full history),
            // specific status = filtered. Never omit it, or the backend defaults to PENDING_ADMIN.
            const url = `/api/payment-requests?limit=2000&status=${statusFilter}${selectedProjectId ? `&project=${selectedProjectId}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            setProjects(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [selectedProjectId, statusFilter]);

    useEffect(() => {
        fetchProjects();
    }, []);

    const exportToExcel = () => {
        if (!requests || requests.length === 0) {
            alert("No data to export");
            return;
        }

        const headers = ["Date", "Project", "Requested By", "Approver (PM)", "Materials", "Amount", "Status"];
        const csvRows = [];
        csvRows.push(headers.join(","));

        requests.forEach(req => {
            const date = formatDateDDMMYYYY(req.created_at);
            const project = req.project?.name || "";
            const requestedBy = req.supervisor?.name || "Self";
            const approver = req.pm?.name || "Pending/N/A";
            const materials = req.materials.map(m => `${m.name} (x${m.quantity})`).join("; ");
            const amount = parseFloat(req.total_amount).toString();
            const status = req.status.replace("_", " ");

            // Escape strings for CSV
            const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

            csvRows.push([
                escapeCSV(date),
                escapeCSV(project),
                escapeCSV(requestedBy),
                escapeCSV(approver),
                escapeCSV(materials),
                amount,
                escapeCSV(status)
            ].join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Payment_History_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredRequests = requests;

    // Removed the global if (loading) blockade to let the layout persist
    return (
        <div style={{ minHeight: "100vh" }}>
            <div className="bg-mesh no-print" />

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}>
                <button className="mobile-menu-close" onClick={() => setIsMenuOpen(false)}>✕</button>
                <div style={{ marginBottom: "24px", textAlign: "center" }}>
                    <div className="role-badge role-super" style={{ marginBottom: "12px" }}>⚡ Super Admin</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Control Center</div>
                </div>
                
                <Link href="/superadmin/dashboard" className="mobile-menu-link" onClick={() => setIsMenuOpen(false)}>
                    <span>🏠</span> Dashboard
                </Link>
                
                <button className="mobile-menu-link" style={{ width: "100%", background: "rgba(248, 113, 113, 0.05)", borderColor: "rgba(248, 113, 113, 0.2)", color: "var(--danger)" }} onClick={() => router.push("/login")}>
                    <span>🚪</span> Sign Out
                </button>
            </div>

            <header className="page-header no-print">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                     <Image
                                            src="/Logo_1.png"
                                            alt="Solar Logo"
                                            width={240}
                                            height={36}
                                            style={{ borderRadius: '8px' }}
                                        />
                </div>
                
                <div className="nav-desktop">
                    <Link href="/superadmin/dashboard" className="btn-ghost" style={{ textDecoration: "none" }}>← Back to Dashboard</Link>
                    <button className="btn-primary" onClick={exportToExcel} style={{ width: "auto", padding: "8px 20px", background: "#10b981", borderColor: "#10b981" }}>📊 Export to Excel</button>
                    <button className="btn-ghost" onClick={() => router.push("/login")}>Sign Out</button>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button 
                        className="btn-primary mobile-only-btn" 
                        style={{ padding: "6px 14px", fontSize: "12px", width: "auto", height: "36px", background: "#10b981", borderColor: "#10b981" }} 
                        onClick={exportToExcel}
                    >
                        📊 Export
                    </button>
                    <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
            </header>

            <main className="page-content">
                <div className="fade-up" style={{ marginBottom: "36px" }}>
                    <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "8px" }}>
                        Payment History
                    </h1>
                    <p className="no-print" style={{ color: "var(--text-muted)", fontSize: "15px" }}>
                        Historical record of all payment requests and their final status.
                    </p>
                </div>

                <div className="no-print" style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                            <label className="stat-label">Filter by Project</label>
                            <select 
                                className="input-field" 
                                style={{ maxWidth: "300px", marginTop: "8px" }}
                                value={selectedProjectId || ""}
                                onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">All Projects</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="stat-label">Filter by Status</label>
                            <select
                                className="input-field"
                                style={{ maxWidth: "250px", marginTop: "8px" }}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="ALL">All Requests</option>
                                <option value="PENDING_ADMIN">Manager Approved</option>
                                <option value="PENDING_PM">Pending PM</option>
                                <option value="PAID">Paid</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-responsive" style={{ overflowX: "auto", maxWidth: "100%" }}>
                    <div className="glass-card printable-area" style={{ padding: "0", width: "100%", minWidth: "900px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", tableLayout: "fixed" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "10%" }}>Date</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "18%" }}>Project</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "12%" }}>Requested By</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "12%" }}>Approver (PM)</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "28%" }}>Materials</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "10%" }}>Amount</th>
                                <th style={{ padding: "16px 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", width: "10%" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: "40px 24px" }}>
                                        <CardShimmerLoader />
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                                        {selectedProjectId ? "No payment requests found for this project." : "No payment requests found."}
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                <tr key={req.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "16px 12px", fontSize: "14px" }}>{formatDateDDMMYYYY(req.created_at)}</td>
                                    <td style={{ padding: "16px 12px", fontSize: "14px", fontWeight: 600 }}>{req.project?.name}</td>
                                    <td style={{ padding: "16px 12px", fontSize: "14px" }}>{req.supervisor?.name || "Self"}</td>
                                    <td style={{ padding: "16px 12px", fontSize: "14px" }}>{req.pm?.name || "Pending/N/A"}</td>
                                    <td style={{ padding: "16px 12px", fontSize: "13px", color: "var(--text-muted)" }}>
                                        <div className="print-wrap-materials" style={{ wordWrap: "break-word", whiteSpace: "normal" }}>
                                            {req.materials.map(m => `${m.name} (x${m.quantity})`).join(", ")}
                                        </div>
                                    </td>
                                    <td style={{ padding: "16px 12px", fontSize: "15px", fontWeight: 700 }}>₹{parseFloat(req.total_amount).toLocaleString()}</td>
                                    <td style={{ padding: "16px 12px" }}>
                                        <span className="role-badge" style={{
                                            background: req.status === "PAID" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                                            color: req.status === "PAID" ? "#10b981" : "var(--text-muted)",
                                            fontSize: "11px"
                                        }}>
                                            {req.status.replace("_", " ")}
                                        </span>
                                    </td>
                                </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    body {
                        background: #fff !important;
                        color: #000 !important;
                    }
                    .glass-card {
                        background: none !important;
                        border: 1px solid #ddd !important;
                        box-shadow: none !important;
                        backdrop-filter: none !important;
                    }
                    th, td {
                        border-bottom: 1px solid #eee !important;
                        color: #000 !important;
                    }
                    .page-content {
                        padding: 0 !important;
                        max-width: 100% !important;
                    }
                    .table-responsive {
                        overflow: visible !important;
                    }
                    .printable-area {
                        min-width: auto !important;
                        width: 100% !important;
                    }
                    .print-wrap-materials {
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    @page {
                        size: landscape;
                        margin: 1cm;
                    }
                    .role-badge {
                        border: 1px solid #ccc !important;
                        background: none !important;
                        color: #000 !important;
                    }
                }
            `}</style>
        </div>
    );
}

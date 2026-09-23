"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Toast from "./Toast";
import ExpenseDetailModal from "./ExpenseDetailModal";
import { formatDateDDMMYYYY } from "@/lib/utils";

function ScrollSentinel({ onReachBottom }) {
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onReachBottom();
                }
            },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [onReachBottom]);

    return <div ref={ref} style={{ height: "10px", width: "100%", margin: "4px 0" }} />;
}

export default function PaymentRequestList({ refreshTrigger, role, limit = null, showFilter = false }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [lastActionTimes, setLastActionTimes] = useState({}); // { "id-action": timestamp }
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [statusFilter, setStatusFilter] = useState(
        role === "PROJECT_MANAGER" ? "PENDING_PM" : role === "SUPER_ADMIN" ? "PENDING_ADMIN" : "ALL"
    ); // Explicit states
    const [actionInProgress, setActionInProgress] = useState(null); // Track which request is being processed
    const [showAll, setShowAll] = useState(false); // For "View More" functionality
    const [expandedNotes, setExpandedNotes] = useState({}); // { requestId: boolean }
    const [pmNotes, setPmNotes] = useState({}); // { requestId: string }
    const [savingNote, setSavingNote] = useState({}); // { requestId: boolean }
    const [selectedRequest, setSelectedRequest] = useState(null); // { request, groupKey } to show in modal
    const [budgetDialog, setBudgetDialog] = useState(null); // { pendingArgs, budgetData }
    const [expandedGroups, setExpandedGroups] = useState({}); // { [groupKey]: boolean } - default collapsed
    const [visibleCounts, setVisibleCounts] = useState({}); // { [groupKey]: number } - default 10
    const [loadedSubRequests, setLoadedSubRequests] = useState({}); // { [groupKey]: Array }
    const [loadingSubRequests, setLoadingSubRequests] = useState({}); // { [groupKey]: boolean }

    const toggleGroup = async (req) => {
        const key = getReqKey(req);
        const willExpand = !expandedGroups[key];
        setExpandedGroups(prev => ({ ...prev, [key]: willExpand }));

        // On-demand lazy load: if expanding AND sub-requests for this date group are not yet loaded
        if (willExpand && !loadedSubRequests[key]) {
            const requestIds = req.requestIds || (req.id ? [req.id] : []);
            if (requestIds.length > 0) {
                setLoadingSubRequests(prev => ({ ...prev, [key]: true }));
                try {
                    const res = await fetch(`/api/payment-requests/group-details?ids=${requestIds.join(",")}`);
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setLoadedSubRequests(prev => ({ ...prev, [key]: data }));
                    }
                } catch (err) {
                    console.error("Error fetching sub-requests for group:", err);
                } finally {
                    setLoadingSubRequests(prev => ({ ...prev, [key]: false }));
                }
            }
        }
    };

    const loadMoreSubRequests = (key) => {
        setVisibleCounts(prev => ({ ...prev, [key]: (prev[key] || 10) + 10 }));
    };



    const fetchRequests = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (role === "SUPER_ADMIN" || role === "PROJECT_MANAGER") {
                params.append("status", statusFilter);
            }
            if (selectedProjectId) {
                params.append("project", selectedProjectId);
            }
            if (role === "MANAGER_OWN_REQUESTS") {
                params.append("own", "true");
            }
            if (limit) {
                params.append("limit", limit);
            }
            const res = await fetch(`/api/payment-requests?${params.toString()}`);
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const initialSelectRef = useRef(false);

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            const projectList = Array.isArray(data) ? data : [];
            setProjects(projectList);
            if (projectList.length > 0 && selectedProjectId === null && !initialSelectRef.current) {
                // setSelectedProjectId(projectList[0].id);
                // initialSelectRef.current = true;
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [refreshTrigger, role, showFilter, statusFilter, selectedProjectId]);

    useEffect(() => {
        if (role === "SUPER_ADMIN" || role === "PROJECT_MANAGER" || role === "MANAGER_OWN_REQUESTS" || (showFilter && role === "SUPERVISOR")) {
            fetchProjects();
        }
    }, [role, showFilter]);

    const addToast = (title, message, type = "success") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const getReqKey = (req) => {
        if (!req.isClubbed) return req.id;
        if (req.clubKey) return req.clubKey;
        const dateObj = new Date(req.created_at);
        const dateKey = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;
        return `${req.project_id}-${dateKey}-${req.status}`;
    };

    const handleAction = async (id, action, isClubbed = false, requestIds = [], projectId = null, currentPct = 0, isSubRequest = false, overrideBudget = false) => {
        // id is used for the key (e.g., 'group-1-date' for clubbed)
        const actionKey = `${id}-${action}`;
        const now = Date.now();
        const lastTime = lastActionTimes[actionKey] || 0;

        const body = {};
        if (overrideBudget) body.overrideBudget = true;


        // Cooldown check (5 seconds = 5000ms)
        if (now - lastTime < 5000) {
            console.log("Cooldown active for this action");
            addToast("Please Wait", "Please wait a moment before trying again.", "error");
            return;
        }

        // Prevent multiple actions on same request/group
        if (actionInProgress === id) {
            return;
        }

        // Auto-save note if present
        if (pmNotes[id]) {
            const success = await handleSavePMNote(id, projectId, currentPct, true);
            if (!success) {
                addToast("Note Failed", "Failed to save the note before approval. Action cancelled.", "error");
                return;
            }
        }

        setActionInProgress(id);

        try {
            // If clubbed, join IDs into a comma-separated string for the bulk-enabled APIs
            const targetId = isClubbed && requestIds.length > 0 ? requestIds.join(",") : id;
            const res = await fetch(`/api/payment-requests/${targetId}/${action}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (res.status === 409) {
                const data = await res.json();
                if (data.error === "BUDGET_EXCEEDED") {
                    setBudgetDialog({
                        pendingArgs: [id, action, isClubbed, requestIds, projectId, currentPct, isSubRequest],
                        budgetData: data
                    });
                    setActionInProgress(null);
                    return;
                }
            }

            if (res.ok) {
                setLastActionTimes(prev => ({ ...prev, [actionKey]: now }));

                // Read response body to detect bypass approvals
                let responseData = {};
                try { responseData = await res.json(); } catch (_) {}
                const wasBypass = action === "approve" &&
                    Array.isArray(responseData.bypassedIds) &&
                    responseData.bypassedIds.length > 0;

                // Optimistic update
                if (isSubRequest && action === "reject") {
                    setRequests(prev => prev.map(req => {
                        if (req.isClubbed && req.subRequests) {
                            const updatedSubReqs = req.subRequests.filter(s => s.id !== id);
                            if (updatedSubReqs.length === 0) return null; // Remove group completely if empty

                            return {
                                ...req,
                                subRequests: updatedSubReqs,
                                requestIds: updatedSubReqs.map(s => s.id),
                                materials: updatedSubReqs.flatMap(s => s.materials),
                                total_amount: updatedSubReqs.reduce((sum, s) => sum + parseFloat(s.total_amount), 0)
                            };
                        }
                        return req;
                    }).filter(Boolean));
                } else {
                    setRequests(prev => prev.filter(req => {
                        const groupKey = getReqKey(req);
                        return groupKey !== id;
                    }));
                }

                addToast(
                    wasBypass ? "Direct Approval ✓"
                        : action === "approve" ? "Request Approved ✓"
                        : action === "mark-paid" ? "Payment Marked ✓"
                        : "Request Rejected ✗",
                    wasBypass
                        ? `SA directly approved the request (manager bypassed). It now awaits payment.`
                        : action === "approve"
                        ? `The payment request ${isClubbed ? "group" : ""} has been approved. It now awaits payment.`
                        : action === "mark-paid"
                        ? `The payment request ${isClubbed ? "group" : ""} has been marked as Paid.`
                        : `The payment request ${isClubbed ? "group" : ""} has been rejected.`,
                    action === "mark-paid" || action === "approve" ? "success" : "error"
                );

                // Refresh list in background
                setTimeout(() => fetchRequests(), 1000);

            } else {
                addToast("Action Failed", "Something went wrong while processing the request.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Network Error", "Unable to connect to the server.", "error");
        } finally {
            setActionInProgress(null);
        }
    };

    const handleBudgetOverride = async () => {
        if (!budgetDialog) return;
        const [id, action, isClubbed, requestIds, projectId, currentPct, isSubRequest] = budgetDialog.pendingArgs;
        setBudgetDialog(null);
        await handleAction(id, action, isClubbed, requestIds, projectId, currentPct, isSubRequest, true);
    };

    // Handle approve/reject fired from inside the ExpenseDetailModal
    const handleModalAction = async (sub, groupKey, action, progressPct) => {
        await handleAction(sub.id, action, false, [], sub.project_id, progressPct, true);
        // Close modal after action (success or failure — handleAction shows a toast either way)
        setSelectedRequest(null);
        // Also sync loadedSubRequests so the accordion body reflects the change immediately
        setLoadedSubRequests(prev => ({
            ...prev,
            [groupKey]: (prev[groupKey] || []).filter(s => s.id !== sub.id)
        }));
    };

    // Handle partial (per-material) approval from inside the ExpenseDetailModal
    const handlePartialApprove = async (requestId, approvedMaterialIds, rejectedMaterialIds) => {
        try {
            const res = await fetch(`/api/payment-requests/${requestId}/approve-partial`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approvedMaterialIds, rejectedMaterialIds })
            });

            if (res.ok) {
                const data = await res.json();
                const action = data.action;

                if (action === "full_approve") {
                    addToast("Request Approved ✓", "All items have been approved.", "success");
                } else if (action === "full_reject") {
                    addToast("Request Rejected ✗", "All items have been rejected.", "error");
                } else if (action === "partial_with_pending") {
                    const pendingCount = (selectedRequest?.request?.materials?.length || 0) - approvedMaterialIds.length - rejectedMaterialIds.length;
                    addToast(
                        "Decision Submitted ✓",
                        `${approvedMaterialIds.length} approved, ${rejectedMaterialIds.length} rejected, ${pendingCount} kept pending for later.`,
                        "success"
                    );
                } else {
                    addToast(
                        "Decision Submitted ✓",
                        `${approvedMaterialIds.length} item(s) approved, ${rejectedMaterialIds.length} item(s) rejected.`,
                        "success"
                    );
                }

                // Refresh the list
                setTimeout(() => fetchRequests(), 800);
            } else {
                addToast("Action Failed", "Something went wrong while processing the request.", "error");
                throw new Error("API error");
            }
        } catch (err) {
            console.error("Partial approve error:", err);
            addToast("Network Error", "Unable to connect to the server.", "error");
            throw err;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "PENDING_PM": return "#f59e0b";
            case "PENDING_ADMIN": return "#3b82f6";
            case "APPROVED": return "#8b5cf6";
            case "PAID": return "#10b981";
            case "REJECTED": return "#f87171";
            default: return "var(--text-muted)";
        }
    };

    const getProgressColor = (pct) => {
        if (pct >= 75) return "#10b981";
        if (pct >= 50) return "#3b82f6";
        if (pct >= 25) return "#f59e0b";
        return "#ef4444";
    };

    const toggleNotes = (id) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };



    const handleSavePMNote = async (requestId, projectId, currentPct, silent = false) => {
        const note = pmNotes[requestId];
        if (!note || !note.trim()) return true;

        if (!silent) setSavingNote(prev => ({ ...prev, [requestId]: true }));
        try {
            const today = new Date();
            const dateStr = today.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

            const res = await fetch(`/api/projects/${projectId}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    percentage: currentPct,
                    date: dateStr,
                    notes: `[${role === "SUPER_ADMIN" ? "Admin" : "Manager"} Note] ${note}`
                })
            });

            if (res.ok) {
                if (!silent) addToast("Note Saved", "Your note has been added to the project progress.", "success");
                setPmNotes(prev => ({ ...prev, [requestId]: "" }));
                if (!silent) fetchRequests();
                return true;
            } else {
                if (!silent) addToast("Error", "Failed to save note.", "error");
                return false;
            }
        } catch (err) {
            console.error("Error saving PM note:", err);
            if (!silent) addToast("Error", "An unexpected error occurred.", "error");
            return false;
        } finally {
            if (!silent) setSavingNote(prev => ({ ...prev, [requestId]: false }));
        }
    };

    const handleDeleteRequest = async (id) => {
        if (!confirm("Are you sure you want to delete this expense request?")) return;

        try {
            const res = await fetch(`/api/payment-requests/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                addToast("Deleted", "The request has been deleted.", "success");
                setRequests(prev => prev.filter(r => r.id !== id));
            } else {
                addToast("Failed", "Could not delete the request.", "error");
            }
        } catch (err) {
            console.error("Error deleting request:", err);
            addToast("Error", "Network error.", "error");
        }
    };

    let filteredRequests = requests;

    if (selectedProjectId && (role === "SUPER_ADMIN" || role === "MANAGER_OWN_REQUESTS" || (showFilter && role === "SUPERVISOR"))) {
        filteredRequests = filteredRequests.filter(req => req.project_id === selectedProjectId);
    }

    if (role === "SUPER_ADMIN" && statusFilter !== "ALL") {
        filteredRequests = filteredRequests.filter(req => req.status === statusFilter);
    }

    // Apply limit for display (if not showing all)
    const displayedRequests = !showAll && limit ? filteredRequests.slice(0, limit) : filteredRequests;

    return (
        <div className="fade-up-2">
            <style>{`
                @keyframes premium-shimmer-anim {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                .premium-shimmer {
                    background: #f1f5f9;
                    background-image: linear-gradient(
                        to right,
                        #f1f5f9 0%,
                        #e2e8f0 20%,
                        #f1f5f9 40%,
                        #f1f5f9 100%
                    );
                    background-repeat: no-repeat;
                    background-size: 1000px 100%;
                    display: block;
                    position: relative;
                    animation: premium-shimmer-anim 2s linear infinite;
                }
            `}</style>
            <Toast toasts={toasts} />
            <h2 className="section-title">{role === "SUPERVISOR" || role === "MANAGER_OWN_REQUESTS" ? "Recent Requests" : "Pending Approvals"}</h2>

            {(role === "SUPER_ADMIN" || role === "PROJECT_MANAGER" || role === "MANAGER_OWN_REQUESTS" || (showFilter && role === "SUPERVISOR")) && (
                <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                    <div>
                        <label className="stat-label">Filter by Project</label>
                        <select
                            className="input-field"
                            style={{ maxWidth: "300px", marginTop: "8px" }}
                            value={selectedProjectId || ""}
                            onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={loading}
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    {(role === "SUPER_ADMIN" || role === "PROJECT_MANAGER") && (
                        <div>
                            <label className="stat-label">Filter by Status</label>
                            <select
                                className="input-field"
                                style={{ maxWidth: "250px", marginTop: "8px" }}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                disabled={loading}
                            >
                                <option value="ALL">All Requests</option>
                                <option value="PENDING_ADMIN">Pending Admin Approval</option>
                                <option value="APPROVED">Admin Approved (Awaiting Payment)</option>
                                <option value="PENDING_PM">Pending Manager</option>
                                <option value="PAID">Paid</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="premium-shimmer" style={{ height: "400px", width: "100%", borderRadius: "20px", border: "1px solid #e2e8f0" }}></div>
            ) : filteredRequests.length === 0 ? (
                <div className="glass-card" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    {(role === "SUPER_ADMIN" || role === "PROJECT_MANAGER" || role === "MANAGER_OWN_REQUESTS" || (showFilter && role === "SUPERVISOR")) && selectedProjectId
                        ? "No payment requests found for this project."
                        : "No payment requests found."}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {displayedRequests.map((req) => {
                        const reqKey = getReqKey(req);
                        const isExpanded = !!expandedGroups[reqKey];
                        const isSubLoading = !!loadingSubRequests[reqKey];
                        const fetchedSubList = loadedSubRequests[reqKey];
                        const subList = fetchedSubList && fetchedSubList.length > 0 ? fetchedSubList : (req.subRequests && req.subRequests.length > 0 ? req.subRequests : [req]);
                        const visibleCount = visibleCounts[reqKey] || 10;
                        const displayedSubList = subList.slice(0, visibleCount);
                        const hasMoreSubRequests = visibleCount < subList.length;

                        return (
                            <div
                                key={reqKey}
                                className="glass-card"
                                style={{
                                    padding: "18px 24px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "14px",
                                    borderLeft: req.isClubbed ? "4px solid var(--primary)" : "1px solid var(--border)",
                                    transition: "all 0.25s ease"
                                }}
                            >
                                {/* Accordion Header Row (Project Name + Date + Status on Left, Expand arrow on Right, NO TOTAL AMOUNT) */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                        userSelect: "none"
                                    }}
                                    onClick={() => toggleGroup(req)}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                                        <span style={{ fontWeight: 800, fontSize: "19px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                                            {req.project?.name}
                                        </span>
                                        <span style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: 600 }}>
                                            • {formatDateDDMMYYYY(req.created_at)}
                                        </span>
                                        <span
                                            className="role-badge"
                                            style={{
                                                background: `${getStatusColor(req.status)}20`,
                                                color: getStatusColor(req.status),
                                                border: `1px solid ${getStatusColor(req.status)}30`,
                                                fontSize: "13px",
                                                fontWeight: 700,
                                                padding: "4px 12px"
                                            }}
                                        >
                                            {(req.isClubbed && req.requestIds?.length > 1) ? `${req.status.replace("_", " ")} (${req.requestIds.length})` : req.status.replace("_", " ")}
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <button
                                            type="button"
                                            className="btn-ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleGroup(req);
                                            }}
                                            style={{
                                                padding: "8px 18px",
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                border: "1px solid var(--border)",
                                                borderRadius: "8px",
                                                background: "rgba(255,255,255,0.05)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            {isExpanded ? "Collapse ▲" : "Expand ▼"}
                                        </button>
                                    </div>
                                </div>

                                {/* Accordion Expanded Body */}
                                {isExpanded && (
                                    <div
                                        style={{
                                            borderTop: "1px solid var(--border)",
                                            paddingTop: "16px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "14px",
                                            animation: "fadeUp 0.2s ease both"
                                        }}
                                    >
                                        {isSubLoading ? (
                                            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                                                <div className="premium-shimmer" style={{ height: "64px", width: "100%", borderRadius: "10px", marginBottom: "8px" }}></div>
                                                Loading details for {formatDateDDMMYYYY(req.created_at)}...
                                            </div>
                                        ) : (
                                            <>
                                                {/* Sub-Requests Listing Header Counter */}
                                                {subList.length > 1 && (
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                                                        <span>Showing {displayedSubList.length} of {subList.length} requests</span>
                                                        {hasMoreSubRequests && (
                                                            <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                                                                {subList.length - displayedSubList.length} remaining
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Sub-Requests Listing */}
                                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                    {displayedSubList.map((sub, idx) => (
                                                        <div
                                                            key={sub.id || idx}
                                                            style={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                                padding: "14px 16px",
                                                                background: "rgba(15, 23, 42, 0.02)",
                                                                borderRadius: "10px",
                                                                border: "1px solid var(--border)",
                                                                flexWrap: "wrap",
                                                                gap: "12px"
                                                            }}
                                                        >
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                                    <span>Requested by: {sub.supervisor?.name || "Self"}</span>
                                                                    <span
                                                                        className="role-badge"
                                                                        style={{
                                                                            background: `${getStatusColor(sub.status)}20`,
                                                                            color: getStatusColor(sub.status),
                                                                            border: `1px solid ${getStatusColor(sub.status)}30`,
                                                                            fontSize: "11px",
                                                                            fontWeight: 700,
                                                                            padding: "2px 8px"
                                                                        }}
                                                                    >
                                                                        {sub.status === "PENDING_ADMIN" ? "PENDING ADMIN" : sub.status === "PENDING_PM" ? "PENDING PM" : sub.status.replace("_", " ")}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                                                                    Amount: <strong style={{ color: (sub.status === "REJECTED" || (role === "SUPER_ADMIN" && sub.status === "PENDING_PM")) ? "#94a3b8" : "var(--text-primary)", textDecoration: sub.status === "REJECTED" ? "line-through" : "none" }}>₹{parseFloat(sub.total_amount).toLocaleString()}</strong>
                                                                    {sub.status === "REJECTED" && (
                                                                        <span style={{ color: "#ef4444", marginLeft: "6px", fontSize: "12px", fontWeight: 600 }}>(Excluded from Total)</span>
                                                                    )}
                                                                    {role === "SUPER_ADMIN" && sub.status === "PENDING_PM" && (
                                                                        <span style={{ color: "#f59e0b", marginLeft: "6px", fontSize: "12px", fontWeight: 600 }}>(Pending Manager - Excluded from Total)</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn-ghost"
                                                                    style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid var(--border)" }}
                                                                    onClick={() => setSelectedRequest({ request: sub, groupKey: reqKey, progressPct: req.progress?.percentage || 0 })}
                                                                >
                                                                    📄 View Details
                                                                </button>

                                                                {((role === "SUPERVISOR" && sub.status === "PENDING_PM") || (role === "MANAGER_OWN_REQUESTS" && (sub.status === "PENDING_ADMIN" || sub.status === "PENDING_PM"))) && !req.isClubbed && (
                                                                    <>
                                                                        <Link
                                                                            href={`/${role === "SUPERVISOR" ? "supervisor" : "manager"}/dashboard/edit-expense/${sub.id}`}
                                                                            className="btn-ghost"
                                                                            style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid var(--primary)", color: "var(--primary)", textDecoration: "none", display: "inline-block" }}
                                                                        >
                                                                            ✏️ Edit
                                                                        </Link>
                                                                        <button
                                                                            className="btn-ghost"
                                                                            style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid #fecaca", color: "#ef4444", background: "#fef2f2" }}
                                                                            onClick={() => handleDeleteRequest(sub.id)}
                                                                        >
                                                                            🗑️ Delete
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {(role === "PROJECT_MANAGER" && sub.status === "PENDING_PM") || (role === "SUPER_ADMIN" && sub.status === "PENDING_ADMIN") ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            className="btn-ghost"
                                                                            style={{
                                                                                padding: "6px 14px",
                                                                                fontSize: "12px",
                                                                                border: "1px solid #fca5a5",
                                                                                color: "#ef4444",
                                                                                background: "rgba(248, 113, 113, 0.05)"
                                                                            }}
                                                                            onClick={() => handleAction(sub.id, "reject", false, [], sub.project_id, req.progress?.percentage || 0, true)}
                                                                        >
                                                                            Reject
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn-primary"
                                                                            style={{ padding: "6px 14px", fontSize: "12px", width: "auto" }}
                                                                            onClick={() => handleAction(sub.id, "approve", false, [], sub.project_id, req.progress?.percentage || 0, true)}
                                                                        >
                                                                            Approve
                                                                        </button>
                                                                    </>
                                                                ) : role === "SUPER_ADMIN" && sub.status === "APPROVED" ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-primary"
                                                                        style={{
                                                                            padding: "6px 14px",
                                                                            fontSize: "12px",
                                                                            width: "auto",
                                                                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                                                            boxShadow: "0 2px 8px rgba(16,185,129,0.3)"
                                                                        }}
                                                                        onClick={() => handleAction(sub.id, "mark-paid", false, [], sub.project_id, req.progress?.percentage || 0, true)}
                                                                    >
                                                                        💰 Mark as Paid
                                                                    </button>
                                                                ) : role === "SUPER_ADMIN" && sub.status === "PENDING_PM" ? (
                                                                    /* SA direct approve — manager bypass */
                                                                    <button
                                                                        type="button"
                                                                        style={{
                                                                            padding: "6px 14px",
                                                                            fontSize: "12px",
                                                                            width: "auto",
                                                                            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                                                            border: "none",
                                                                            color: "#fff",
                                                                            borderRadius: "8px",
                                                                            cursor: "pointer",
                                                                            fontWeight: 700,
                                                                            boxShadow: "0 2px 8px rgba(245,158,11,0.35)"
                                                                        }}
                                                                        onClick={() => handleAction(sub.id, "approve", false, [], sub.project_id, req.progress?.percentage || 0, true)}
                                                                    >
                                                                        ⚡ Direct Approve
                                                                    </button>
                                                                ) : null}

                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {/* Infinite Scroll Sentinel & Load Next 10 Trigger */}
                                        {hasMoreSubRequests && (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                                                <ScrollSentinel onReachBottom={() => loadMoreSubRequests(reqKey)} />
                                                <button
                                                    type="button"
                                                    className="btn-ghost"
                                                    onClick={() => loadMoreSubRequests(reqKey)}
                                                    style={{
                                                        padding: "8px 24px",
                                                        fontSize: "12px",
                                                        fontWeight: 600,
                                                        border: "1px dashed var(--primary)",
                                                        color: "var(--primary)",
                                                        borderRadius: "8px"
                                                    }}
                                                >
                                                    ⬇️ Load Next 10 Requests ({subList.length - displayedSubList.length} remaining)
                                                </button>
                                            </div>
                                        )}

                                        {/* Footer: Cumulative Total Sum & Bulk Actions */}
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                paddingTop: "14px",
                                                borderTop: "1px dashed var(--border)",
                                                marginTop: "6px",
                                                flexWrap: "wrap",
                                                gap: "12px"
                                            }}
                                        >
                                            <div>
                                                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    📊 Cumulative Group Total:{" "}
                                                </span>
                                                <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
                                                    ₹{parseFloat(req.total_amount).toLocaleString()}
                                                </span>
                                            </div>

                                            {(() => {
                                                 // ── Normal approvable: PENDING_ADMIN only (SA regular approve) ──
                                                 const normalApprovableIds = role === "SUPER_ADMIN"
                                                     ? ((req.approvableRequestIds || []).filter(rid =>
                                                         (req.subRequests || []).find(s => s.id === rid)?.status === "PENDING_ADMIN"
                                                       ))
                                                     : ((req.approvableRequestIds && req.approvableRequestIds.length > 0)
                                                         ? req.approvableRequestIds
                                                         : (req.subRequests || [req])
                                                             .filter(s => s.status === "PENDING_PM")
                                                             .map(s => s.id));

                                                 // ── Direct approvable: PENDING_PM only (SA bypass) ──
                                                 const directApprovableIds = role === "SUPER_ADMIN"
                                                     ? ((req.directApprovableRequestIds && req.directApprovableRequestIds.length > 0)
                                                         ? req.directApprovableRequestIds
                                                         : (req.subRequests || []).filter(s => s.status === "PENDING_PM").map(s => s.id))
                                                     : [];

                                                 // ── Payable: APPROVED requests (SA mark as paid) ──
                                                 const payableIds = role === "SUPER_ADMIN"
                                                     ? ((req.payableRequestIds && req.payableRequestIds.length > 0)
                                                         ? req.payableRequestIds
                                                         : (req.subRequests || []).filter(s => s.status === "APPROVED").map(s => s.id))
                                                     : [];

                                                 const hasActions = normalApprovableIds.length > 0 || directApprovableIds.length > 0 || payableIds.length > 0;
                                                 if (!hasActions) return null;

                                                 return (
                                                     <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                                         {/* Normal Approve / Reject group (PENDING_ADMIN) */}
                                                         {normalApprovableIds.length > 0 && (
                                                             <div style={{ display: "flex", gap: "8px" }}>
                                                                 <button
                                                                     className="btn-ghost"
                                                                     onClick={() => handleAction(reqKey, "reject", req.isClubbed, normalApprovableIds, req.project_id, req.progress?.percentage || 0)}
                                                                     style={{ color: "#64748b", padding: "8px 16px", fontSize: "13px", border: "1px solid var(--border)" }}
                                                                     disabled={actionInProgress === reqKey}
                                                                 >
                                                                     {actionInProgress === reqKey ? "Processing..." : normalApprovableIds.length > 1 ? "Reject All Pending" : "Reject"}
                                                                 </button>
                                                                 <button
                                                                     className="btn-primary"
                                                                     onClick={() => handleAction(reqKey, "approve", req.isClubbed, normalApprovableIds, req.project_id, req.progress?.percentage || 0)}
                                                                     style={{ padding: "8px 20px", fontSize: "13px", width: "auto" }}
                                                                     disabled={actionInProgress === reqKey}
                                                                 >
                                                                     {actionInProgress === reqKey ? "Processing..." : normalApprovableIds.length > 1 ? "Approve All Pending" : "Approve"}
                                                                 </button>
                                                             </div>
                                                         )}

                                                         {/* Direct Approve group (PENDING_PM — SA override, amber) */}
                                                         {directApprovableIds.length > 0 && (
                                                             <button
                                                                 onClick={() => handleAction(reqKey, "approve", req.isClubbed, directApprovableIds, req.project_id, req.progress?.percentage || 0)}
                                                                 style={{
                                                                     padding: "8px 20px",
                                                                     fontSize: "13px",
                                                                     border: "none",
                                                                     borderRadius: "10px",
                                                                     cursor: "pointer",
                                                                     fontWeight: 700,
                                                                     color: "#fff",
                                                                     background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                                                     boxShadow: "0 4px 12px rgba(245,158,11,0.35)"
                                                                 }}
                                                                 disabled={actionInProgress === reqKey}
                                                             >
                                                                 {actionInProgress === reqKey ? "Processing..." : `⚡ Direct Approve${directApprovableIds.length > 1 ? ` (${directApprovableIds.length})` : ""}`}
                                                             </button>
                                                         )}

                                                         {/* Mark as Paid group (APPROVED) — shown separately */}
                                                         {payableIds.length > 0 && (
                                                             <button
                                                                 className="btn-primary"
                                                                 onClick={() => handleAction(reqKey, "mark-paid", req.isClubbed, payableIds, req.project_id, req.progress?.percentage || 0)}
                                                                 style={{
                                                                     padding: "8px 20px",
                                                                     fontSize: "13px",
                                                                     width: "auto",
                                                                     background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                                                     boxShadow: "0 4px 12px rgba(16,185,129,0.3)"
                                                                 }}
                                                                 disabled={actionInProgress === reqKey}
                                                             >
                                                                 {actionInProgress === reqKey ? "Processing..." : `💰 Mark as Paid${payableIds.length > 1 ? ` (${payableIds.length})` : ""}`}

                                                             </button>
                                                         )}
                                                     </div>
                                                 );
                                             })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* View More Button for Supervisors */}
            {showFilter && role === "SUPERVISOR" && filteredRequests.length > (limit || 3) && !showAll && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                        className="btn-ghost"
                        onClick={() => setShowAll(true)}
                        style={{
                            padding: "10px 32px",
                            fontSize: "14px",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textUnderlineOffset: "4px"
                        }}
                    >
                        View More ({filteredRequests.length - (limit || 3)} more)
                    </button>
                </div>
            )}

            {/* View All Button for Super Admin */}
            {role === "SUPER_ADMIN" && filteredRequests.length > 3 && !showAll && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                        className="btn-ghost"
                        onClick={() => setShowAll(true)}
                        style={{
                            padding: "10px 32px",
                            fontSize: "14px",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textUnderlineOffset: "4px"
                        }}
                    >
                        View All ({filteredRequests.length - 3} more requests)
                    </button>
                </div>
            )}
            <ExpenseDetailModal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                request={selectedRequest?.request ?? null}
                role={role}
                actionInProgress={selectedRequest ? actionInProgress === selectedRequest.request?.id : false}
                onApprove={
                    selectedRequest &&
                        ((role === "PROJECT_MANAGER" && selectedRequest.request?.status === "PENDING_PM") ||
                            (role === "SUPER_ADMIN" && selectedRequest.request?.status === "PENDING_ADMIN"))
                        ? () => handleModalAction(selectedRequest.request, selectedRequest.groupKey, "approve", selectedRequest.progressPct)
                        : undefined
                }
                onReject={
                    selectedRequest &&
                        ((role === "PROJECT_MANAGER" && selectedRequest.request?.status === "PENDING_PM") ||
                            (role === "SUPER_ADMIN" && (selectedRequest.request?.status === "PENDING_ADMIN" || selectedRequest.request?.status === "APPROVED")))
                        ? () => handleModalAction(selectedRequest.request, selectedRequest.groupKey, "reject", selectedRequest.progressPct)
                        : undefined
                }
                onMarkPaid={
                    selectedRequest &&
                        role === "SUPER_ADMIN" &&
                        selectedRequest.request?.status === "APPROVED"
                        ? () => handleModalAction(selectedRequest.request, selectedRequest.groupKey, "mark-paid", selectedRequest.progressPct)
                        : undefined
                }
                onDirectApprove={
                    selectedRequest &&
                        role === "SUPER_ADMIN" &&
                        selectedRequest.request?.status === "PENDING_PM"
                        ? () => handleModalAction(selectedRequest.request, selectedRequest.groupKey, "approve", selectedRequest.progressPct)
                        : undefined
                }
                onPartialApprove={
                    selectedRequest &&
                        role === "PROJECT_MANAGER" &&
                        selectedRequest.request?.status === "PENDING_PM" &&
                        (selectedRequest.request?.materials?.length || 0) > 1
                        ? (reqId, approvedIds, rejectedIds) => handlePartialApprove(reqId, approvedIds, rejectedIds)
                        : undefined
                }
            />

            {/* Budget Exceeded Dialog */}
            {budgetDialog && (() => {
                const bd = budgetDialog.budgetData;
                const pct = Math.min(((bd.currentExpenses + bd.approvingAmount) / bd.allocatedBudget) * 100, 150);
                const spentPct = Math.min((bd.currentExpenses / bd.allocatedBudget) * 100, 100);
                const overflowPct = Math.min(pct - spentPct, 100 - spentPct);
                return (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        padding: "70px 16px 16px",
                        overflowY: "auto",
                    }}>
                        {/* Backdrop */}
                        <div
                            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
                            onClick={() => setBudgetDialog(null)}
                        />
                        {/* Card — max height with inner scroll */}
                        <div style={{
                            position: "relative",
                            background: "#fff",
                            borderRadius: "20px",
                            width: "100%",
                            maxWidth: "440px",
                            maxHeight: "min(80vh, 600px)",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                            border: "2px solid #fecaca",
                            animation: "fadeUp 0.25s ease both",
                        }}>
                            {/* Scrollable body */}
                            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
                                {/* Title */}
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                    <div style={{
                                        width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                                        background: "#fee2e2", border: "1.5px solid #fca5a5",
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px"
                                    }}>🚨</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: "16px", color: "#991b1b", lineHeight: 1.2 }}>Budget Limit Exceeded!</div>
                                        <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>Approving this will cross the project budget.</div>
                                    </div>
                                </div>

                                {/* 2×2 grid breakdown */}
                                <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "12px", border: "1px solid #fecaca", marginBottom: "12px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                                        {[
                                            { label: "Allocated", value: bd.allocatedBudget, color: "#1e40af" },
                                            { label: "Already Spent", value: bd.currentExpenses, color: "#92400e" },
                                            { label: "This Request", value: bd.approvingAmount, color: "#b45309" },
                                            { label: "Remaining", value: bd.remainingBudget, color: "#065f46" },
                                        ].map(row => (
                                            <div key={row.label} style={{ background: "#fff", borderRadius: "8px", padding: "9px 11px", border: "1px solid #fca5a520" }}>
                                                <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500, marginBottom: "2px" }}>{row.label}</div>
                                                <div style={{ fontSize: "13px", fontWeight: 700, color: row.color }}>₹{Number(row.value).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 4px 2px", borderTop: "1px solid #fca5a5" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#991b1b" }}>⚠️ Overrun</span>
                                        <span style={{ fontSize: "15px", fontWeight: 800, color: "#ef4444" }}>₹{Number(bd.amountExceeded).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div style={{ marginBottom: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280", marginBottom: "5px" }}>
                                        <span>Utilization after approval</span>
                                        <span style={{ fontWeight: 700, color: pct > 100 ? "#ef4444" : "#f59e0b" }}>{pct.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: "8px", borderRadius: "999px", background: "#e5e7eb", overflow: "hidden", position: "relative" }}>
                                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${spentPct}%`, background: "#f59e0b" }} />
                                        <div style={{ position: "absolute", left: `${spentPct}%`, top: 0, height: "100%", width: `${overflowPct}%`, background: "#ef4444" }} />
                                    </div>
                                    <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                                        <span style={{ fontSize: "10px", color: "#92400e", display: "flex", alignItems: "center", gap: "3px" }}>
                                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />Already spent
                                        </span>
                                        <span style={{ fontSize: "10px", color: "#991b1b", display: "flex", alignItems: "center", gap: "3px" }}>
                                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />This request
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Fixed footer — always visible, never scrolls */}
                            <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #fee2e2", flexShrink: 0 }}>
                                <div style={{ display: "flex", gap: "10px", marginBottom: "7px" }}>
                                    <button
                                        onClick={() => setBudgetDialog(null)}
                                        style={{
                                            flex: 1, padding: "12px", borderRadius: "10px",
                                            border: "1.5px solid #e5e7eb", background: "#f9fafb",
                                            color: "#374151", fontWeight: 600, fontSize: "14px", cursor: "pointer"
                                        }}
                                    >Cancel</button>
                                    <button
                                        onClick={handleBudgetOverride}
                                        style={{
                                            flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                                            background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                                            color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                                            boxShadow: "0 4px 14px rgba(239,68,68,0.3)"
                                        }}
                                    >Force Approve</button>
                                </div>
                                <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", textAlign: "center" }}>
                                    This action will be flagged for audit.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function ExpenseDetailModal({
    isOpen,
    onClose,
    request,
    role,
    onApprove,
    onReject,
    onMarkPaid,
    actionInProgress,
    onPartialApprove
}) {
    const router = useRouter();
    // { [materialId]: "approve" | "reject" | null }
    const [materialDecisions, setMaterialDecisions] = useState({});
    const [partialProcessing, setPartialProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setMaterialDecisions({});
        } else {
            document.body.style.overflow = "auto";
        }
        return () => { document.body.style.overflow = "auto"; };
    }, [isOpen]);

    if (!isOpen || !request) return null;

    const materials = request.materials || [];
    const notes = request.progress?.notes || [];
    const completionPercentage = request.progress?.percentage || 0;

    const canAct =
        (role === "PROJECT_MANAGER" && request.status === "PENDING_PM") ||
        (role === "SUPER_ADMIN" && (request.status === "PENDING_ADMIN" || request.status === "APPROVED"));

    // Per-item buttons only for PM with 2+ materials
    const showPerItemActions = canAct && role === "PROJECT_MANAGER" && materials.length > 1 && !!onPartialApprove;

    const approvedIds   = materials.filter(m => materialDecisions[m.id] === "approve").map(m => m.id);
    const rejectedIds   = materials.filter(m => materialDecisions[m.id] === "reject").map(m => m.id);
    const pendingItems  = materials.filter(m => !materialDecisions[m.id]);
    // Submit is enabled as soon as at least one item has an explicit decision.
    // Undecided items automatically stay PENDING_PM.
    const hasAnyDecision = approvedIds.length > 0 || rejectedIds.length > 0;

    const toggleDecision = (materialId, decision) => {
        setMaterialDecisions(prev => ({
            ...prev,
            [materialId]: prev[materialId] === decision ? null : decision
        }));
    };

    const handleSubmit = async () => {
        if (!hasAnyDecision || !onPartialApprove) return;
        setPartialProcessing(true);
        try {
            await onPartialApprove(request.id, approvedIds, rejectedIds);
            onClose();
        } finally {
            setPartialProcessing(false);
        }
    };

    const handleViewAllNotes = () => {
        onClose();
        if (role === "SUPER_ADMIN") router.push("/superadmin/projects/progress");
        else if (role === "PROJECT_MANAGER") router.push("/manager/projects/progress");
        else router.push("/supervisor/dashboard/progress");
    };

    return createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div style={styles.header}>
                    <h2 style={styles.title}>Expense Details</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={styles.completionBadge}>{completionPercentage}% Completed</div>
                        <button style={styles.closeBtn} onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* ── Scrollable content ── */}
                <div style={styles.content}>

                    {/* Notes */}
                    {notes.length > 0 && (
                        <div style={styles.section}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={styles.sectionTitle}>📝 Project Progress Notes</h3>
                                <button onClick={handleViewAllNotes} style={styles.viewAllBtn}>View All</button>
                            </div>
                            <div style={styles.notesContainer}>
                                {notes.slice(0, 5).map((note, idx) => (
                                    <div key={idx} style={styles.noteCard}>
                                        <div style={styles.noteMeta}>
                                            <span>{note.date}</span>
                                            <span>{note.percentage}% Complete</span>
                                        </div>
                                        <p style={styles.noteText}>{note.notes || "No additional description provided."}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Materials */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>🛒 Requested Expenses</h3>
                        <div style={styles.materialsList}>
                            {materials.map((m, idx) => {
                                const decision = materialDecisions[m.id];
                                const isApproved = decision === "approve";
                                const isRejected = decision === "reject";

                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            ...styles.materialItem,
                                            border: isApproved
                                                ? "1.5px solid #10b981"
                                                : isRejected
                                                    ? "1.5px solid #ef4444"
                                                    : "1px solid #e2e8f0",
                                            background: isApproved
                                                ? "rgba(16,185,129,0.04)"
                                                : isRejected
                                                    ? "rgba(239,68,68,0.04)"
                                                    : "#fff",
                                            transition: "all 0.18s ease"
                                        }}
                                    >
                                        {/* Left: info */}
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 0 }}>
                                            {/* Status dot */}
                                            {showPerItemActions && (
                                                <div style={{
                                                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                                                    border: isApproved ? "2px solid #10b981" : isRejected ? "2px solid #ef4444" : "2px dashed #94a3b8",
                                                    background: isApproved ? "rgba(16,185,129,0.15)" : isRejected ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.1)",
                                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
                                                    color: isApproved ? "#059669" : isRejected ? "#dc2626" : "#94a3b8"
                                                }}>
                                                    {isApproved ? "✓" : isRejected ? "✕" : "…"}
                                                </div>
                                            )}
                                            <div style={styles.materialInfo}>
                                                <div style={styles.materialName}>{m.name}</div>
                                                <div style={styles.materialMeta}>
                                                    Qty: {m.quantity} • Price: ₹{parseFloat(m.unit_price).toLocaleString()}
                                                </div>
                                                {m.description && (
                                                    <div style={styles.materialDescription}>{m.description}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: image + per-item action buttons */}
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                                            {m.image_url && (
                                                <div style={styles.materialImageContainer}>
                                                    <a href={m.image_url} target="_blank" rel="noopener noreferrer" style={styles.imageLink}>
                                                        <img src={m.image_url} alt={m.name} style={styles.materialImage} />
                                                        <div style={styles.imageOverlay}>📷 VIEW</div>
                                                    </a>
                                                </div>
                                            )}

                                            {showPerItemActions && (
                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={() => toggleDecision(m.id, "reject")}
                                                        style={{
                                                            ...styles.itemBtn,
                                                            borderColor: isRejected ? "#ef4444" : "#fca5a5",
                                                            color: "#ef4444",
                                                            background: isRejected ? "rgba(239,68,68,0.12)" : "rgba(254,242,242,0.9)",
                                                            fontWeight: isRejected ? 800 : 600,
                                                            boxShadow: isRejected ? "0 0 0 2px rgba(239,68,68,0.2)" : "none"
                                                        }}
                                                    >
                                                        ✕ Reject
                                                    </button>
                                                    <button
                                                        onClick={() => toggleDecision(m.id, "approve")}
                                                        style={{
                                                            ...styles.itemBtn,
                                                            borderColor: isApproved ? "#10b981" : "#6ee7b7",
                                                            color: isApproved ? "#fff" : "#059669",
                                                            background: isApproved
                                                                ? "linear-gradient(135deg,#10b981,#059669)"
                                                                : "rgba(16,185,129,0.08)",
                                                            fontWeight: isApproved ? 800 : 600,
                                                            boxShadow: isApproved ? "0 0 0 2px rgba(16,185,129,0.2)" : "none"
                                                        }}
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Decision tally — shown as soon as any item is decided */}
                    {showPerItemActions && (
                        <div style={styles.tally}>
                            {approvedIds.length > 0 && (
                                <span style={{ color: "#059669", fontWeight: 700, fontSize: 13 }}>
                                    ✓ {approvedIds.length} will be approved
                                </span>
                            )}
                            {rejectedIds.length > 0 && (
                                <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 13 }}>
                                    ✕ {rejectedIds.length} will be rejected
                                </span>
                            )}
                            {pendingItems.length > 0 && (
                                <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>
                                    ⏳ {pendingItems.length} kept pending (decide later)
                                </span>
                            )}
                        </div>
                    )}

                    {/* Total */}
                    <div style={styles.totalSection}>
                        <span style={styles.totalLabel}>Total Amount:</span>
                        <span style={styles.totalValue}>₹{parseFloat(request.total_amount).toLocaleString()}</span>
                    </div>
                </div>

                {/* ── Footer ── */}
                {canAct && (onApprove || onReject || onPartialApprove || onMarkPaid) && (
                    <div style={styles.actionFooter}>
                        <div style={styles.footerDivider} />

                        {/* Per-item submit mode (PM only) */}
                        {showPerItemActions ? (
                            <div style={styles.actionRow}>
                                <span style={styles.actionLabel}>Manager Decision</span>
                                <div style={styles.actionButtons}>
                                    {/* Reject All shortcut */}
                                    {onReject && (
                                        <button
                                            style={{
                                                ...styles.rejectBtn,
                                                opacity: (actionInProgress || partialProcessing) ? 0.6 : 1,
                                                cursor: (actionInProgress || partialProcessing) ? "not-allowed" : "pointer"
                                            }}
                                            disabled={!!(actionInProgress || partialProcessing)}
                                            onClick={onReject}
                                        >
                                            {actionInProgress ? "Processing..." : "✕ Reject All"}
                                        </button>
                                    )}
                                    {/* Submit per-item decisions — enabled as soon as ≥1 item decided */}
                                    <button
                                        style={{
                                            ...styles.approveBtn,
                                            opacity: (!hasAnyDecision || actionInProgress || partialProcessing) ? 0.45 : 1,
                                            cursor: (!hasAnyDecision || actionInProgress || partialProcessing) ? "not-allowed" : "pointer"
                                        }}
                                        disabled={!hasAnyDecision || !!(actionInProgress || partialProcessing)}
                                        onClick={handleSubmit}
                                    >
                                        {partialProcessing
                                            ? "Processing..."
                                            : approvedIds.length === materials.length
                                                ? "✓ Approve All"
                                                : pendingItems.length > 0 && approvedIds.length === 0
                                                    ? "✕ Reject Selected"
                                                    : "✓ Submit Decision"}
                                    </button>
                                </div>
                            </div>
                        ) : role === "SUPER_ADMIN" && request.status === "APPROVED" ? (
                            /* ── SA: APPROVED → Paid action ── */
                            <div style={styles.actionRow}>
                                <span style={styles.actionLabel}>Payment Action</span>
                                <div style={styles.actionButtons}>
                                    {onReject && (
                                        <button
                                            style={{
                                                ...styles.rejectBtn,
                                                opacity: actionInProgress ? 0.6 : 1,
                                                cursor: actionInProgress ? "not-allowed" : "pointer"
                                            }}
                                            disabled={!!actionInProgress}
                                            onClick={onReject}
                                        >
                                            {actionInProgress ? "Processing..." : "↩ Undo Approval"}
                                        </button>
                                    )}
                                    {onMarkPaid && (
                                        <button
                                            style={{
                                                ...styles.approveBtn,
                                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                                boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                                                opacity: actionInProgress ? 0.6 : 1,
                                                cursor: actionInProgress ? "not-allowed" : "pointer"
                                            }}
                                            disabled={!!actionInProgress}
                                            onClick={onMarkPaid}
                                        >
                                            {actionInProgress ? "Processing..." : "💰 Mark as Paid"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* ── Standard: Reject + Approve (PM or SA on PENDING_ADMIN) ── */
                            <div style={styles.actionRow}>
                                <span style={styles.actionLabel}>
                                    {role === "PROJECT_MANAGER" ? "Manager Decision" : "Admin Decision"}
                                </span>
                                <div style={styles.actionButtons}>
                                    {onReject && (
                                        <button
                                            style={{
                                                ...styles.rejectBtn,
                                                opacity: actionInProgress ? 0.6 : 1,
                                                cursor: actionInProgress ? "not-allowed" : "pointer"
                                            }}
                                            disabled={!!actionInProgress}
                                            onClick={onReject}
                                        >
                                            {actionInProgress ? "Processing..." : "✕ Reject All"}
                                        </button>
                                    )}
                                    {onApprove && (
                                        <button
                                            style={{
                                                ...styles.approveBtn,
                                                opacity: actionInProgress ? 0.6 : 1,
                                                cursor: actionInProgress ? "not-allowed" : "pointer"
                                            }}
                                            disabled={!!actionInProgress}
                                            onClick={onApprove}
                                        >
                                            {actionInProgress ? "Processing..." : "✓ Approve All"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

const styles = {
    overlay: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
        zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    },
    modal: {
        backgroundColor: "#fff", borderRadius: "16px", width: "100%",
        maxWidth: "600px", maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04)"
    },
    header: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", borderBottom: "1px solid #f1f5f9"
    },
    title: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" },
    completionBadge: {
        backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981",
        padding: "6px 12px", borderRadius: "20px", fontSize: "13px",
        fontWeight: 700, border: "1px solid rgba(16,185,129,0.2)"
    },
    closeBtn: { background: "none", border: "none", fontSize: "20px", color: "#64748b", cursor: "pointer", padding: "4px" },
    content: { padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" },
    section: { display: "flex", flexDirection: "column", gap: "12px" },
    sectionTitle: {
        margin: 0, fontSize: "14px", fontWeight: 600, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.05em"
    },
    viewAllBtn: {
        background: "none", border: "none", color: "var(--primary)",
        fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "underline"
    },
    notesContainer: { display: "flex", flexDirection: "column", gap: "12px" },
    noteCard: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" },
    noteMeta: {
        display: "flex", justifyContent: "space-between",
        fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px"
    },
    noteText: { margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" },
    materialsList: { display: "flex", flexDirection: "column", gap: "12px" },
    materialItem: {
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "12px 16px", borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)", gap: "10px"
    },
    materialInfo: { display: "flex", flexDirection: "column", gap: "4px" },
    materialName: { fontSize: "15px", fontWeight: 600, color: "#1e293b" },
    materialMeta: { fontSize: "13px", color: "#64748b" },
    materialDescription: {
        fontSize: "13px", color: "#475569", marginTop: "4px",
        padding: "6px 10px", backgroundColor: "#f8fafc", borderRadius: "6px",
        borderLeft: "3px solid #cbd5e1", lineHeight: 1.5, whiteSpace: "pre-wrap"
    },
    materialImageContainer: {
        width: "50px", height: "50px", borderRadius: "8px",
        overflow: "hidden", position: "relative", border: "1px solid #e2e8f0"
    },
    imageLink: { display: "block", width: "100%", height: "100%", textDecoration: "none" },
    materialImage: { width: "100%", height: "100%", objectFit: "cover" },
    imageOverlay: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "rgba(0,0,0,0.6)", color: "#fff",
        fontSize: "9px", fontWeight: 700, textAlign: "center", padding: "2px 0"
    },
    itemBtn: {
        padding: "5px 11px", borderRadius: "8px", border: "1.5px solid",
        fontSize: "12px", cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap"
    },
    tally: {
        display: "flex", gap: "14px", flexWrap: "wrap",
        padding: "10px 14px", backgroundColor: "#f8fafc",
        borderRadius: "10px", border: "1px solid #e2e8f0"
    },
    totalSection: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: "16px", borderTop: "1px solid #e2e8f0", marginTop: "8px"
    },
    totalLabel: { fontSize: "16px", fontWeight: 600, color: "#475569" },
    totalValue: { fontSize: "20px", fontWeight: 800, color: "#0f172a" },
    actionFooter: { flexShrink: 0, padding: "0 24px 20px" },
    footerDivider: { height: "1px", background: "#e2e8f0", margin: "0 0 16px" },
    actionLabel: {
        fontSize: "12px", fontWeight: 600, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.05em"
    },
    actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
    actionButtons: { display: "flex", gap: "10px" },
    rejectBtn: {
        padding: "10px 22px", borderRadius: "10px", border: "1.5px solid #fca5a5",
        background: "rgba(254,242,242,0.8)", color: "#dc2626",
        fontSize: "14px", fontWeight: 700, transition: "all 0.15s ease", cursor: "pointer"
    },
    approveBtn: {
        padding: "10px 22px", borderRadius: "10px", border: "none",
        background: "linear-gradient(135deg,#10b981 0%,#059669 100%)",
        color: "#fff", fontSize: "14px", fontWeight: 700,
        boxShadow: "0 4px 12px rgba(16,185,129,0.3)", transition: "all 0.15s ease", cursor: "pointer"
    }
};

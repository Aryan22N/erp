"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function StoredImagesGallery() {
    const router = useRouter();
    const [materials, setMaterials] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState("all");
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [deletingId, setDeletingId] = useState(null);

    const fetchMaterials = async (projectId = "all") => {
        setLoading(true);
        try {
            const url = projectId && projectId !== "all" 
                ? `/api/materials/stored?project_id=${projectId}` 
                : "/api/materials/stored";
            const res = await fetch(url);
            const data = await res.json();
            setMaterials(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Fetch materials error:", err);
            addToast("Error", "Failed to fetch images.", "error");
        } finally {
            setTimeout(() => setLoading(false), 600);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            setProjects(data);
            if (data && data.length > 0 && selectedProject === "all") {
                setSelectedProject(data[0].id.toString());
            }
        } catch (err) {
            console.error("Fetch projects error:", err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchMaterials(selectedProject);
    }, [selectedProject]);

    const addToast = (title, message, type = "success") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const handleDelete = async (id, type) => {
        if (!confirm("Are you sure you want to delete this image? This will also remove it from storage.")) return;
        
        setDeletingId(id);
        try {
            const apiEndpoint = type === "BILL" 
                ? `/api/bills/${id}` 
                : `/api/materials/${id}/delete-image`;

            const res = await fetch(apiEndpoint, {
                method: "DELETE"
            });
            
            if (res.ok) {
                addToast("Deleted", "Image has been removed successfully.");
                setMaterials(prev => prev.filter(m => !(m.id === id && m.type === type)));
            } else {
                addToast("Error", "Failed to delete image.", "error");
            }
        } catch (err) {
            console.error("Delete error:", err);
            addToast("Error", "Network error occurred.", "error");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div style={{ minHeight: "100vh", padding: "40px 20px" }} className="responsive-root">
            <Toast toasts={toasts} />
            
            <div className="bg-mesh-custom" />
            <div className="orb1" />
            <div className="orb2" />

            <div className="page-content" style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <div style={{ marginBottom: "40px" }} className="fade-up">
                    <Link href="/superadmin/dashboard" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "20px" }}>
                        ← Back to Dashboard
                    </Link>
                    <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "8px" }}>
                        🖼️ Stored Images Gallery
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>
                        View and manage all images from finalized/paid requests.
                    </p>
                </div>

                <div className="glass-card" style={{ padding: "24px", marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
                    <div>
                        <label className="stat-label">Filter by Project</label>
                        <select 
                            className="input-field" 
                            style={{ maxWidth: "300px", marginTop: "8px" }}
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            <option value="all">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div className="stat-label">Total Images</div>
                        <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)" }}>{materials.length}</div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="glass-card" style={{ height: "300px", animation: "pulse 1.5s infinite" }}></div>
                        ))}
                    </div>
                ) : materials.length === 0 ? (
                    <div className="glass-card" style={{ padding: "80px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: "48px", marginBottom: "20px" }}>📷</div>
                        <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>No images found</h3>
                        <p style={{ color: "var(--text-muted)" }}>Try selecting a different project or check back later.</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
                        {materials.map((m) => (
                            <div key={m.id} className="glass-card fade-up" style={{ padding: "0", overflow: "hidden", border: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
                                <div 
                                    style={{ position: "relative", width: "100%", height: "200px", cursor: "zoom-in", overflow: "hidden" }}
                                    onClick={() => setPreviewImage(m.url)}
                                >
                                    <img 
                                        src={m.url} 
                                        alt={m.name} 
                                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
                                        onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
                                        onMouseOut={(e) => e.target.style.transform = "scale(1)"}
                                    />
                                    <div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600 }}>
                                        {m.projectName}
                                    </div>
                                </div>
                                <div style={{ padding: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                        <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>{m.name}</div>
                                        <div style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "10px", 
                                            background: m.type === "BILL" ? "#eff6ff" : (m.status === "PAID" ? "#dcfce7" : "#fee2e2"), 
                                            color: m.type === "BILL" ? "#1d4ed8" : (m.status === "PAID" ? "#166534" : "#991b1b") 
                                        }}>
                                            {m.type === "BILL" ? "BILL / QR" : m.status}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                                        Uploaded by: {m.supervisorName} <br />
                                        {formatDateDDMMYYYY(m.date)}
                                    </div>
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button 
                                            className="btn-ghost" 
                                            onClick={() => setPreviewImage(m.url)}
                                            style={{ flex: 1, height: "36px", fontSize: "12px", padding: 0 }}
                                        >
                                            👁️ View
                                        </button>
                                        <button 
                                            className="btn-ghost" 
                                            onClick={() => handleDelete(m.id, m.type)}
                                            disabled={deletingId === m.id}
                                            style={{ flex: 1, height: "36px", fontSize: "12px", padding: 0, color: "#ef4444", border: "1px solid #fee2e2" }}
                                        >
                                            {deletingId === m.id ? "..." : "🗑️ Delete"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewImage && (
                <div 
                    style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
                    onClick={() => setPreviewImage(null)}
                >
                    <div style={{ position: "relative", maxWidth: "95%", maxHeight: "95%" }}>
                        <img src={previewImage} alt="Preview" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "12px" }} />
                        <button 
                            onClick={() => setPreviewImage(null)}
                            style={{ position: "absolute", top: "-40px", right: "0", background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 0.8; }
                    100% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Copy, Check, ChevronRight } from "lucide-react";

const VARIABLES = [
    { value: "[[DQ]]",                  desc: "Deviance Quotient" },
    { value: "[[AQ]]",                  desc: "Awareness Quotient" },
    { value: "[[PointTotal]]",          desc: "Total Score" },
    { value: "[[LastDQ]]",              desc: "Prev. Poll DQ" },
    { value: "[[LastScore]]",           desc: "Prev. Poll Pts" },
    { value: "[[RandomCorrectPick]]",   desc: "Example User Pick (Right)" },
    { value: "[[RandomIncorrectPick]]", desc: "Example User Pick (Wrong)" },
    { value: "[[RandomCorrectPoll]]",   desc: "Example Poll Title (Right)" },
    { value: "[[RandomIncorrectPoll]]", desc: "Example Poll Title (Wrong)" },
];

export default function AdminSidebar() {
    const [copied, setCopied] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    function copy(text: string) {
        navigator.clipboard.writeText(text);
        setCopied(text);
        setTimeout(() => setCopied(null), 1500);
    }

    return (
        <>
            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? "Show Variables" : "Hide Variables"}
                style={{
                    position: "fixed", top: 80,
                    right: collapsed ? 0 : 256,
                    width: 20, height: 40, zIndex: 40,
                    background: "#fff",
                    border: "1px solid #e5e7eb", borderRight: "none",
                    borderRadius: "8px 0 0 8px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "-2px 2px 6px rgba(0,0,0,0.06)",
                    transition: "right 0.2s ease",
                }}
            >
                <ChevronRight style={{
                    width: 12, height: 12, color: "#9ca3af",
                    transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                }} />
            </button>

            {/* Panel */}
            <div style={{
                position: "fixed", top: 80, right: 0, bottom: 0, width: 256,
                zIndex: 30, background: "#fff",
                borderLeft: "1px solid #e5e7eb",
                display: "flex", flexDirection: "column",
                transform: collapsed ? "translateX(256px)" : "translateX(0)",
                transition: "transform 0.2s ease",
            }}>
                {/* Header */}
                <div style={{
                    padding: "10px 12px 8px",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#374151",
                }}>
                    Variables
                </div>

                {/* Variable list */}
                <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
                    {VARIABLES.map(v => (
                        <button
                            key={v.value}
                            onClick={() => copy(v.value)}
                            title={v.desc}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                width: "100%", padding: "6px 8px",
                                borderRadius: 8, border: "none", background: "none",
                                cursor: "pointer", textAlign: "left",
                                transition: "background 0.12s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                            onMouseLeave={e => (e.currentTarget.style.background = "none")}
                        >
                            <div>
                                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: "#111827" }}>
                                    {v.value}
                                </div>
                                <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3 }}>
                                    {v.desc}
                                </div>
                            </div>
                            <div style={{ color: copied === v.value ? "#22c55e" : "#d1d5db", flexShrink: 0, marginLeft: 8 }}>
                                {copied === v.value
                                    ? <Check size={11} />
                                    : <Copy size={11} />
                                }
                            </div>
                        </button>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
                        <a
                            href="/admin/documentation/variables"
                            target="_blank"
                            style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "4px 8px", fontSize: 10, fontWeight: 700,
                                color: "#3b82f6", textDecoration: "none",
                            }}
                        >
                            <span>Full Documentation</span><span>↗</span>
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}

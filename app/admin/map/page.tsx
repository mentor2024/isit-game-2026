"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { STAGE_NAMES } from "@/lib/formatters";
import { ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type LevelConfig = {
    stage: number;
    level: number;
    is_linked: boolean;
    show_interstitial: boolean;
    enabled_modules: string[];
    layout_config: any;
    path_selector_config?: {
        instructions: string;
        path1: { label: string; url: string };
        path2: { label: string; url: string };
    } | null;
};

type StageGroup = {
    stage: number;
    name: string;
    levels: LevelConfig[];
    hasBranch: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [0.45, 0.65, 0.85, 1.1];
const ZOOM_LABELS = ["Overview", "Wide", "Normal", "Detail"];

const STAGE_COLORS: Record<number, { bg: string; border: string; text: string; line: string; glow: string }> = {
    0: { bg: "#1a1a2e", border: "#e2b96f", text: "#e2b96f", line: "#e2b96f", glow: "rgba(226,185,111,0.3)" },
    1: { bg: "#1a2e1a", border: "#6fe2a0", text: "#6fe2a0", line: "#6fe2a0", glow: "rgba(111,226,160,0.25)" },
    2: { bg: "#1a1e2e", border: "#6fa8e2", text: "#6fa8e2", line: "#6fa8e2", glow: "rgba(111,168,226,0.25)" },
    3: { bg: "#2e1a1a", border: "#e26f6f", text: "#e26f6f", line: "#e26f6f", glow: "rgba(226,111,111,0.25)" },
    4: { bg: "#2a1a2e", border: "#c06fe2", text: "#c06fe2", line: "#c06fe2", glow: "rgba(192,111,226,0.25)" },
    5: { bg: "#2e2a1a", border: "#e2c56f", text: "#e2c56f", line: "#e2c56f", glow: "rgba(226,197,111,0.25)" },
};

function stageColor(stage: number) {
    const idx = ((stage - 1) % 5) + 1;
    return STAGE_COLORS[stage <= 0 ? 0 : idx] ?? STAGE_COLORS[1];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VLine({ color, dashed = false, height = 32 }: { color: string; dashed?: boolean; height?: number }) {
    return (
        <div style={{ display: "flex", justifyContent: "center", height }}>
            <div style={{
                width: 3, height: "100%", borderRadius: 2,
                background: dashed
                    ? `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 6px, transparent 6px, transparent 12px)`
                    : color,
                opacity: dashed ? 0.5 : 0.85,
            }} />
        </div>
    );
}

function LevelNode({ config }: { config: LevelConfig }) {
    const [hov, setHov] = useState(false);
    const col = stageColor(config.stage);
    const letter = String(config.level);
    const moduleCount = config.layout_config?.rows
        ? config.layout_config.rows.reduce((a: number, r: any) => a + r.columns.filter((c: any) => c.moduleId).length, 0)
        : (config.enabled_modules?.length ?? 0);
    const configured = !!config.layout_config?.rows?.length || moduleCount > 0;

    return (
        <Link
            href={`/admin/levels/${config.stage}/${config.level}`}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? col.bg : "#111318",
                border: `2px solid ${hov ? col.border : "#252830"}`,
                boxShadow: hov ? `0 0 18px ${col.glow}, 0 4px 12px rgba(0,0,0,0.5)` : "0 2px 6px rgba(0,0,0,0.4)",
                transition: "all 0.18s ease",
                minWidth: 130, borderRadius: 12,
                padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 5,
                textDecoration: "none", position: "relative",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: col.border + "20",
                    border: `1.5px solid ${col.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900, color: col.text, fontFamily: "monospace",
                }}>{letter}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                    Level {config.level}
                </span>
            </div>
            <div style={{ fontSize: 10, color: "#555d6b" }}>
                {configured ? `${moduleCount} module${moduleCount !== 1 ? "s" : ""}` : "unconfigured"}
                {config.is_linked && <span style={{ marginLeft: 5, color: col.border + "88" }}>· linked</span>}
            </div>
            {configured && (
                <div style={{
                    position: "absolute", top: 7, right: 7,
                    width: 5, height: 5, borderRadius: "50%",
                    background: col.border, opacity: 0.75,
                }} />
            )}
        </Link>
    );
}

function BranchFork({ config, stageNum }: { config: LevelConfig; stageNum: number }) {
    const col = stageColor(stageNum);
    const pc = config.path_selector_config;
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{
                width: 42, height: 42, background: "#111318",
                border: `2px solid ${col.border}`,
                borderRadius: 8, transform: "rotate(45deg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 14px ${col.glow}`,
            }}>
                <span style={{ transform: "rotate(-45deg)", fontSize: 17 }}>🔀</span>
            </div>
            {pc && (
                <div style={{
                    display: "flex", gap: 48, marginTop: 14,
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", color: col.text + "99",
                }}>
                    <span style={{ maxWidth: 80, textAlign: "center" }}>← {pc.path1.label || "Path 1"}</span>
                    <span style={{ maxWidth: 80, textAlign: "center" }}>{pc.path2.label || "Path 2"} →</span>
                </div>
            )}
        </div>
    );
}

function StageHeader({ group }: { group: StageGroup }) {
    const col = stageColor(group.stage);

    if (group.stage === 0) {
        return (
            <div style={{
                background: "#111318", border: `2px solid ${col.border}`,
                borderRadius: 16, padding: "16px 40px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                boxShadow: `0 0 36px ${col.glow}`, minWidth: 240,
            }}>
                <div style={{ fontSize: 10, color: col.text, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Entry Point</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", fontFamily: "Georgia, serif" }}>{group.name}</div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>Stage 0 · Pre-game</div>
            </div>
        );
    }

    return (
        <Link
            href={`/admin/stages/${group.stage}`}
            style={{
                background: "#111318",
                border: `1.5px solid ${col.border}22`,
                borderRadius: 12, padding: "10px 24px",
                display: "flex", alignItems: "center", gap: 12,
                textDecoration: "none", transition: "border-color 0.15s",
            }}
        >
            <div style={{
                width: 30, height: 30, background: col.border + "18",
                border: `2px solid ${col.border}`, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 900, color: col.text, fontFamily: "monospace",
            }}>{group.stage}</div>
            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: col.text, fontFamily: "Georgia, serif" }}>
                    Stage {group.name}
                </div>
                <div style={{ fontSize: 10, color: "#555d6b", display: "flex", alignItems: "center", gap: 4 }}>
                    {group.levels.length} level{group.levels.length !== 1 ? "s" : ""}
                    <ExternalLink style={{ width: 8, height: 8 }} />
                </div>
            </div>
        </Link>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MapPage() {
    const [groups, setGroups] = useState<StageGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(2);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            const [{ data: configs }, { data: pollLevels }] = await Promise.all([
                supabase.from("level_configurations")
                    .select("stage, level, is_linked, show_interstitial, enabled_modules, layout_config, path_selector_config")
                    .order("stage").order("level"),
                supabase.from("polls").select("stage, level"),
            ]);

            const configMap = new Map<string, LevelConfig>();
            (configs ?? []).forEach(c => configMap.set(`${c.stage}-${c.level}`, c as LevelConfig));
            (pollLevels ?? []).forEach(p => {
                const s = p.stage ?? 1, l = p.level ?? 1;
                if (!configMap.has(`${s}-${l}`)) {
                    configMap.set(`${s}-${l}`, { stage: s, level: l, is_linked: false, show_interstitial: false, enabled_modules: [], layout_config: null, path_selector_config: null });
                }
            });

            const stageMap = new Map<number, LevelConfig[]>();
            Array.from(configMap.values())
                .sort((a, b) => a.stage - b.stage || a.level - b.level)
                .forEach(lc => {
                    if (!stageMap.has(lc.stage)) stageMap.set(lc.stage, []);
                    stageMap.get(lc.stage)!.push(lc);
                });

            const built: StageGroup[] = [];

            // Always include the Awareness Assessment entry (stage 0)
            built.push({ stage: 0, name: "Awareness Assessment", levels: stageMap.get(0) ?? [], hasBranch: false });

            Array.from(stageMap.entries())
                .filter(([s]) => s > 0)
                .sort(([a], [b]) => a - b)
                .forEach(([s, levels]) => {
                    const last = levels[levels.length - 1];
                    built.push({
                        stage: s,
                        name: STAGE_NAMES[s - 1] ?? `Stage ${s}`,
                        levels,
                        hasBranch: !!last?.path_selector_config?.path1?.label,
                    });
                });

            setGroups(built);
            setLoading(false);
        }
        load();
    }, []);

    const scale = ZOOM_LEVELS[zoom];

    return (
        <div style={{ minHeight: "100vh", background: "#0a0b0f", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>

            {/* Toolbar */}
            <div style={{
                position: "sticky", top: 0, zIndex: 50,
                background: "#0d0e14", borderBottom: "1px solid #1a1c24",
                padding: "12px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0, fontFamily: "Georgia, serif" }}>
                        🗺 Game Map
                    </h1>
                    <p style={{ fontSize: 11, color: "#4b5563", margin: 0 }}>
                        {loading ? "Loading…" : `${groups.filter(g => g.stage > 0).length} stages · ${groups.reduce((a, g) => a + g.levels.length, 0)} levels configured`}
                    </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                        onClick={() => setZoom(z => Math.max(0, z - 1))}
                        disabled={zoom === 0}
                        style={{
                            width: 30, height: 30, borderRadius: 7,
                            background: "#1a1c24", border: "1px solid #252830",
                            color: zoom === 0 ? "#2d3038" : "#9ca3af",
                            cursor: zoom === 0 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    ><ZoomOut style={{ width: 14, height: 14 }} /></button>

                    {ZOOM_LABELS.map((label, i) => (
                        <button key={i} onClick={() => setZoom(i)} style={{
                            padding: "4px 10px", borderRadius: 6,
                            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                            background: zoom === i ? "#e2b96f" : "#1a1c24",
                            color: zoom === i ? "#0a0b0f" : "#6b7280",
                            border: `1px solid ${zoom === i ? "#e2b96f" : "#252830"}`,
                            cursor: "pointer", transition: "all 0.15s",
                        }}>{label}</button>
                    ))}

                    <button
                        onClick={() => setZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
                        disabled={zoom === ZOOM_LEVELS.length - 1}
                        style={{
                            width: 30, height: 30, borderRadius: 7,
                            background: "#1a1c24", border: "1px solid #252830",
                            color: zoom === ZOOM_LEVELS.length - 1 ? "#2d3038" : "#9ca3af",
                            cursor: zoom === ZOOM_LEVELS.length - 1 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    ><ZoomIn style={{ width: 14, height: 14 }} /></button>
                </div>
            </div>

            {/* Map canvas */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "48px 24px 120px", display: "flex", justifyContent: "center" }}>
                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 40, opacity: 0.3 }}>
                        {[200, 340, 280, 220].map((w, i) => (
                            <div key={i} style={{ width: w, height: 80, background: "#1a1c24", borderRadius: 12 }} />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        transformOrigin: "top center",
                        transform: `scale(${scale})`,
                        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                        display: "flex", flexDirection: "column", alignItems: "center",
                        marginBottom: `${(1 - scale) * -600}px`,
                    }}>
                        {groups.map((group, i) => {
                            const isLast = i === groups.length - 1;
                            const col = stageColor(group.stage);

                            return (
                                <div key={group.stage} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    {/* Stage header */}
                                    <StageHeader group={group} />

                                    {/* Levels (skip for stage 0 if no levels) */}
                                    {group.levels.length > 0 && (
                                        <>
                                            <VLine color={col.line} height={20} />
                                            <div style={{
                                                display: "flex", gap: 10, alignItems: "stretch",
                                                background: col.bg + "55",
                                                border: `1.5px solid ${col.border}18`,
                                                borderRadius: 14, padding: "14px 18px",
                                                flexWrap: "nowrap",
                                            }}>
                                                {group.levels.map((lvl, li) => (
                                                    <div key={lvl.level} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <LevelNode config={lvl} />
                                                        {li < group.levels.length - 1 && (
                                                            <div style={{
                                                                width: 20, height: 2, flexShrink: 0,
                                                                background: `linear-gradient(to right, ${col.line}88, ${col.line}44)`,
                                                                borderRadius: 2,
                                                            }} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* Connector / branch to next */}
                                    {!isLast && (
                                        <>
                                            <VLine color={col.line} height={22} />
                                            {group.hasBranch && group.levels.length > 0 ? (
                                                <>
                                                    <BranchFork config={group.levels[group.levels.length - 1]} stageNum={group.stage} />
                                                    <VLine color={col.line} height={22} dashed />
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.line, opacity: 0.4 }} />
                                                    <VLine color={col.line} height={22} />
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {/* End marker */}
                        {groups.length > 0 && (
                            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.3 }}>
                                <div style={{ width: 3, height: 20, background: "#374151", borderRadius: 2 }} />
                                <div style={{ fontSize: 9, color: "#374151", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                                    To be continued…
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

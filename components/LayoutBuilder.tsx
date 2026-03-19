"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
    useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import AssetPickerModal from "@/components/AssetPickerModal";
import RichTextEditor from "@/components/RichTextEditor";
import { createClient } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColumnWidth = "1/1" | "1/2" | "1/3" | "2/3" | "1/6" | "2/6" | "4/6" | "5/6";

export type ColumnModule = {
    moduleId: string;
    content?: string;
};

export type LayoutColumn = {
    width: ColumnWidth;
    // New: stacked modules
    modules?: ColumnModule[];
    // Legacy (auto-migrated on load)
    moduleId?: string | null;
    content?: string;
};

// Migrate legacy single-module column to modules array
function migrateColumn(col: LayoutColumn): LayoutColumn & { modules: ColumnModule[] } {
    if (col.modules) return col as LayoutColumn & { modules: ColumnModule[] };
    const modules: ColumnModule[] = col.moduleId ? [{ moduleId: col.moduleId, content: col.content }] : [];
    return { ...col, modules };
}

export type LayoutRow = {
    id: string;
    columns: LayoutColumn[];
};

export type LayoutConfig = {
    rows: LayoutRow[];
};

export type CustomModule = {
    id: string;           // UUID from Supabase
    name: string;
    emoji: string;
    base_module_id: string;  // e.g. "conditional_content"
    content: string;         // JSON config blob
    created_at?: string;
};

// ─── Module definitions ───────────────────────────────────────────────────────
// APP_MODULES = singleton (placed once). CONTENT_BLOCKS = repeatable.

export const APP_MODULES: { id: string; label: string; emoji: string; category: string }[] = [
    // Core game modules
    { id: "level_up_hero",      label: "You Leveled Up",        emoji: "🎉", category: "Game" },
    { id: "level_scores",       label: "Level Scores",          emoji: "📊", category: "Game" },
    { id: "your_metrics",       label: "Your Metrics",          emoji: "📈", category: "Game" },
    { id: "leaderboard",        label: "Leaderboard",           emoji: "🏆", category: "Game" },
    { id: "path_selector",      label: "Path Selector",         emoji: "🔀", category: "Game" },
    // Poll modules
    { id: "poll",               label: "Poll",                  emoji: "🗳️", category: "Polls" },
    { id: "aggregate_results",  label: "Poll Results",          emoji: "📋", category: "Polls" },
    // Rail modules (split from combined is_it_rails)
    { id: "is_rail",            label: "IS Rail",               emoji: "✅", category: "Rails" },
    { id: "it_rail",            label: "IT Rail",               emoji: "❌", category: "Rails" },
    { id: "is_it_rails",        label: "IS IT Rails (combined)",emoji: "🛤️", category: "Rails" },
    // Social
    { id: "discussion_forum",   label: "Discussion Forum",      emoji: "💬", category: "Social" },
    // Character
    { id: "izzy",               label: "Izzy",                  emoji: "🧑", category: "Character" },
    // Utility
    { id: "quest",              label: "Quest",                 emoji: "⚔️", category: "Utility" },
    { id: "awareness_assessment", label: "Awareness Assessment",  emoji: "🧠", category: "Utility" },
    { id: "scoring_groups",       label: "Scoring Groups",         emoji: "📊", category: "Utility" },
    { id: "conditional_content",  label: "Conditional Content",    emoji: "🔀", category: "Utility" },
];

export const CONTENT_BLOCKS: { id: string; label: string; emoji: string }[] = [
    { id: "tip",       label: "Tip",       emoji: "💡" },
    { id: "rich_text", label: "Rich Text", emoji: "📝" },
    { id: "image",     label: "Image",     emoji: "🖼️" },
    { id: "video",     label: "Video",     emoji: "🎬" },
];

const ALL_MODULES = [...APP_MODULES, ...CONTENT_BLOCKS];
const CONTENT_BLOCK_IDS = new Set(CONTENT_BLOCKS.map(b => b.id));

// Modules that have an inline config panel in the builder
const CONFIGURABLE_IDS = new Set([
    "level_up_hero", "izzy", "poll", "tip", "rich_text", "quest",
    "awareness_assessment", "scoring_groups", "conditional_content",
    "image", "video",
]);

// Custom module IDs are prefixed so the drag/drop system can identify them
const CUSTOM_MODULE_PREFIX = "custom:";

// Variables available for use in rich text editors
type PaletteVariable = { value: string; desc: string; };
type PaletteVariableGroup = { label: string; color: string; vars: PaletteVariable[]; note?: string; };

const PALETTE_VARIABLE_GROUPS: PaletteVariableGroup[] = [
    {
        label: "User Metrics",
        color: "#854d0e",
        vars: [
            { value: "[[DQ]]",         desc: "Overall Deviance Quotient" },
            { value: "[[AQ]]",         desc: "Overall Awareness Quotient" },
            { value: "[[PointTotal]]", desc: "Total Points Accumulated" },
        ],
    },
    {
        label: "Contextual (Last Action)",
        color: "#1e40af",
        note: "In Level Complete = current level. In Poll Instructions = previous poll.",
        vars: [
            { value: "[[LastDQ]]",    desc: "DQ for that scope" },
            { value: "[[LastScore]]", desc: "Points earned in that scope" },
        ],
    },
    {
        label: "Random Picks (Level)",
        color: "#166534",
        note: "Best in Level Completion messages — pulls from user's actual performance.",
        vars: [
            { value: "[[RandomCorrectPick]]",   desc: "A correct choice the user made" },
            { value: "[[RandomIncorrectPick]]", desc: "An incorrect choice the user made" },
            { value: "[[RandomCorrectPoll]]",   desc: "Title of a poll they got right" },
            { value: "[[RandomIncorrectPoll]]", desc: "Title of a poll they got wrong" },
        ],
    },
    {
        label: "Dynamic History",
        color: "#581c87",
        note: "Format: [[Type-S#-L#-P#]] — S=Stage, L=Level, P=Poll Order",
        vars: [
            { value: "[[Q-S#-L#-P#]]", desc: "Poll question / title" },
            { value: "[[A-S#-L#-P#]]", desc: "User's answer for that poll" },
            { value: "[[P-S#-L#-P#]]", desc: "Points earned for that poll" },
            { value: "[[F-S#-L#-P#]]", desc: "Feedback message for that answer" },
        ],
    },
];

// ─── Row presets ──────────────────────────────────────────────────────────────

const ROW_PRESETS: { label: string; columns: ColumnWidth[] }[] = [
    { label: "Full",         columns: ["1/1"] },
    { label: "½ + ½",        columns: ["1/2", "1/2"] },
    { label: "⅓ + ⅔",        columns: ["1/3", "2/3"] },
    { label: "⅔ + ⅓",        columns: ["2/3", "1/3"] },
    { label: "⅙ + ⅚",        columns: ["1/6", "5/6"] },
    { label: "⅚ + ⅙",        columns: ["5/6", "1/6"] },
    { label: "⅓ + ⅓ + ⅓",    columns: ["1/3", "1/3", "1/3"] },
    { label: "1-4-1",        columns: ["1/6", "4/6", "1/6"] },
    { label: "6 equal",      columns: ["1/6", "1/6", "1/6", "1/6", "1/6", "1/6"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colSpanClass(width: ColumnWidth): string {
    switch (width) {
        case "1/1":  return "col-span-6";
        case "1/2":  return "col-span-3";
        case "1/3":  return "col-span-2";
        case "2/3":  return "col-span-4";
        case "1/6":  return "col-span-1";
        case "2/6":  return "col-span-2";
        case "4/6":  return "col-span-4";
        case "5/6":  return "col-span-5";
    }
}

function generateId() {
    return Math.random().toString(36).slice(2, 9);
}

function getModuleMeta(id: string | null) {
    if (!id) return null;
    return ALL_MODULES.find(m => m.id === id) ?? null;
}

function parseContent(content: string | undefined): Record<string, any> {
    if (!content) return {};
    try { return JSON.parse(content); } catch { return {}; }
}

// ─── Inline config panels ─────────────────────────────────────────────────────

// ─── Izzy config panel (needs its own state for popup) ───────────────────────

function IzzyConfigPanel({
    cfg,
    update,
    inputCls,
    labelCls,
}: {
    cfg: Record<string, any>;
    update: (patch: Record<string, any>) => void;
    inputCls: string;
    labelCls: string;
}) {
    const [popupOpen, setPopupOpen] = useState(false);
    const [posePicker, setPosePicker] = useState(false);

    const POSITIONS = [
        ["top-left",  "top-center",  "top-right" ],
        ["mid-left",  "mid-center",  "mid-right" ],
        ["bot-left",  "bot-center",  "bot-right" ],
    ] as const;

    const ARROWS = [
        ["↖", "↑", "↗"],
        ["←", "·", "→"],
        ["↙", "↓", "↘"],
    ];

    const currentPos = cfg.balloonPos || "top-center";

    return (
        <div className="mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex flex-col gap-3">
            {/* Pose row with position popup trigger */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <p className={labelCls}>Pose</p>
                    <div className="relative">
                        {/* 9-dot grid icon button */}
                        <button
                            type="button"
                            onClick={() => setPopupOpen(o => !o)}
                            title="Set balloon position"
                            className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${popupOpen ? "bg-yellow-400 border-yellow-600" : "bg-white border-yellow-300 hover:border-yellow-500"}`}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {[0,1,2].map(row => [0,1,2].map(col => (
                                    <circle key={`${row}-${col}`} cx={3 + col * 5} cy={3 + row * 5} r="1.5" fill={popupOpen ? "#92400e" : "#ca8a04"} />
                                )))}
                            </svg>
                        </button>
                        {popupOpen && (
                            <div className="absolute right-0 top-full mt-2 z-50 bg-white border-2 border-yellow-400 rounded-xl shadow-2xl p-3" style={{width: "160px"}}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Balloon Position</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {POSITIONS.map((row, ri) => row.map((pos, ci) => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => { update({ balloonPos: pos }); setPopupOpen(false); }}
                                            title={pos.replace("-", " ")}
                                            className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center text-base
                                                ${currentPos === pos
                                                    ? "bg-yellow-400 border-yellow-600 text-yellow-900"
                                                    : "bg-gray-50 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 text-gray-500"
                                                }`}
                                        >
                                            {ARROWS[ri][ci]}
                                        </button>
                                    )))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Pose preview + picker */}
                <div className="flex items-center gap-2">
                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-white border-2 border-yellow-300 flex items-center justify-center shrink-0">
                        {cfg.pose
                            ? <img src={cfg.pose} alt="Selected pose" className="max-h-full object-contain" />
                            : <span className="text-2xl">🧑</span>
                        }
                    </div>
                    <button
                        type="button"
                        onClick={() => setPosePicker(true)}
                        className="flex-1 py-2 text-xs font-bold bg-yellow-100 hover:bg-yellow-200 border-2 border-yellow-300 hover:border-yellow-500 rounded-lg transition-all"
                    >
                        📂 Choose from Repository
                    </button>
                </div>
                {posePicker && (
                    <AssetPickerModal
                        typeFilter="image"
                        defaultTag="izzy"
                        onSelect={url => { update({ pose: url }); setPosePicker(false); }}
                        onClose={() => setPosePicker(false)}
                    />
                )}
            </div>
            <div>
                <p className={labelCls}>Word balloon text</p>
                <textarea
                    className={inputCls + " resize-none"}
                    rows={2}
                    placeholder="What does Izzy say?"
                    value={cfg.balloon || ""}
                    onChange={e => update({ balloon: e.target.value })}
                />
            </div>
        </div>
    );
}

// ─── Save As Module modal ─────────────────────────────────────────────────────

function SaveAsModuleModal({
    moduleId,
    content: moduleContent,
    existingModules,
    existingCustomModule,
    onSave,
    onClose,
}: {
    moduleId: string;
    content: string | undefined;
    existingModules: CustomModule[];
    existingCustomModule?: CustomModule;
    onSave: (mod: CustomModule) => void;
    onClose: () => void;
}) {
    const baseMeta = moduleId === "column_stack" ? { emoji: "📦", label: "Column Stack" } : getModuleMeta(moduleId);
    const isUpdate = !!existingCustomModule;

    const [name, setName] = useState(existingCustomModule?.name ?? "");
    const [emoji, setEmoji] = useState(existingCustomModule?.emoji ?? baseMeta?.emoji ?? "⭐");
    const [mode, setMode] = useState<"update" | "new">(isUpdate ? "update" : "new");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const supabase = createClient();

    async function handleSave() {
        const trimmed = name.trim();
        if (!trimmed) { setError("Please enter a name."); return; }
        setSaving(true);
        setError("");

        if (mode === "update" && existingCustomModule) {
            // UPDATE existing row
            const { data, error: dbErr } = await supabase
                .from("custom_modules")
                .update({ name: trimmed, emoji, content: moduleContent || "{}" })
                .eq("id", existingCustomModule.id)
                .select()
                .single();

            if (dbErr || !data) {
                setError(dbErr?.message || "Update failed");
                setSaving(false);
                return;
            }
            onSave(data as CustomModule);
        } else {
            // INSERT new row
            const { data, error: dbErr } = await supabase
                .from("custom_modules")
                .insert({ name: trimmed, emoji, base_module_id: moduleId, content: moduleContent || "{}" })
                .select()
                .single();

            if (dbErr || !data) {
                setError(dbErr?.message || "Save failed");
                setSaving(false);
                return;
            }
            onSave(data as CustomModule);
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
                    <h3 className="font-black text-base">
                        {isUpdate ? "💾 Update Custom Module" : "💾 Save as Custom Module"}
                    </h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-black font-bold text-xl">✕</button>
                </div>
                <div className="p-5 flex flex-col gap-4">

                    {/* Mode toggle — only shown when editing an existing custom module */}
                    {isUpdate && (
                        <div className="flex rounded-xl overflow-hidden border-2 border-gray-200 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => { setMode("update"); setName(existingCustomModule.name); setEmoji(existingCustomModule.emoji); }}
                                className={`flex-1 py-2 transition-colors ${mode === "update" ? "bg-black text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                ↺ Update "{existingCustomModule.name}"
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMode("new"); setName(""); setEmoji(baseMeta?.emoji ?? "⭐"); }}
                                className={`flex-1 py-2 transition-colors ${mode === "new" ? "bg-black text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                + Save as New
                            </button>
                        </div>
                    )}

                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
                        {mode === "update"
                            ? <>Updates <strong>{existingCustomModule?.name}</strong> with the current configuration. Already-placed instances are unaffected.</>
                            : <>Based on <strong>{baseMeta?.label || moduleId}</strong> — saves the current configuration as a new reusable module.</>
                        }
                    </div>

                    <div className="flex gap-2">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Icon</p>
                            <input
                                className="w-14 px-2 py-2 text-xl text-center border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                                value={emoji}
                                maxLength={2}
                                onChange={e => setEmoji(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                {mode === "update" ? "Module Name" : "New Module Name"}
                            </p>
                            <input
                                autoFocus
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                                placeholder="e.g. Awareness Assessment (AQ)"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(""); }}
                                onKeyDown={e => e.key === "Enter" && handleSave()}
                            />
                        </div>
                    </div>
                    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
                </div>
                <div className="px-5 pb-5 flex gap-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-2.5 text-sm font-bold border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 text-sm font-bold bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        {saving ? "Saving…" : mode === "update" ? "Update Module" : "Save Module"}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─── Conditional Content config panel ────────────────────────────────────────

const CRITERIA_OPTIONS = [
    { value: "scoring_group",    label: "Scoring Group (A / B / C)",         branches: ["A", "B", "C"] },
    { value: "agreed_majority",  label: "Agreed with Majority (Yes / No)",    branches: ["yes", "no"] },
    { value: "aq_range",         label: "Awareness Quotient Range",           branches: [] }, // dynamic
    { value: "concurrence",      label: "Concurrence % Range",                branches: [] }, // dynamic
    { value: "current_stage",    label: "Current Stage",                      branches: [] }, // dynamic
];

type ConditionalBranch = { condition: string; operator?: string; label: string; content: string };

function ConditionalContentPanel({
    cfg,
    update,
}: {
    cfg: Record<string, any>;
    update: (patch: Record<string, any>) => void;
}) {
    const criteria = cfg.criteria || "scoring_group";
    const selectedOption = CRITERIA_OPTIONS.find(o => o.value === criteria) ?? CRITERIA_OPTIONS[0];
    const branches: ConditionalBranch[] = cfg.branches || [];

    const inputCls = "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-black";
    const labelCls = "block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1";

    function setCriteria(val: string) {
        const opt = CRITERIA_OPTIONS.find(o => o.value === val)!;
        const seedBranches: ConditionalBranch[] = opt.branches.map(b => ({
            condition: b,
            label: b.toUpperCase(),
            content: branches.find(x => x.condition === b)?.content || "",
        }));
        const fallback: ConditionalBranch[] = (val === "aq_range" || val === "concurrence" || val === "current_stage")
            ? [{ condition: "", operator: ">=", label: "Branch 1", content: "" }]
            : [];
        update({ criteria: val, branches: seedBranches.length ? seedBranches : (branches.length ? branches : fallback) });
    }

    function updateBranch(idx: number, patch: Partial<ConditionalBranch>) {
        const next = branches.map((b, i) => i === idx ? { ...b, ...patch } : b);
        update({ branches: next });
    }

    function addBranch() {
        const isAq = criteria === "aq_range";
        update({ branches: [...branches, { condition: "", operator: isAq ? ">=" : "", label: `Branch ${branches.length + 1}`, content: "" }] });
    }

    function removeBranch(idx: number) {
        update({ branches: branches.filter((_, i) => i !== idx) });
    }

    const branchColors = ["border-blue-300 bg-blue-50", "border-purple-300 bg-purple-50", "border-orange-300 bg-orange-50", "border-pink-300 bg-pink-50", "border-teal-300 bg-teal-50"];

    const criteriaHint: Record<string, string> = {
        scoring_group:   "Branches on user's Scoring Group (A/B/C).",
        agreed_majority: "Branches on whether the user agreed with the poll majority.",
        aq_range:        "Set an operator and value for each branch. Evaluated top-down — first match wins.",
        concurrence:     "Set condition as a min concurrence %, e.g. '75' = ≥ 75% correct. First match wins.",
        current_stage:   "Set condition as the stage number, e.g. '2' matches Stage 2. Add a fallback branch with condition 'default'.",
    };

    return (
        <div className="mt-2 flex flex-col gap-2">
            {/* Criteria selector */}
            <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                <p className={labelCls}>Criteria</p>
                <select
                    className={inputCls}
                    value={criteria}
                    onChange={e => setCriteria(e.target.value)}
                >
                    {CRITERIA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <p className="text-[10px] text-sky-600 mt-1 leading-snug">{criteriaHint[criteria]}</p>
            </div>

            {/* Branches — each collapsible */}
            <div className="flex flex-col gap-1.5">
                {branches.map((branch, idx) => {
                    // Build a concise condition badge for the collapsed heading
                    const conditionBadge = criteria === "aq_range" && branch.condition
                        ? `${branch.operator || ">="} ${branch.condition}`
                        : (branch.condition && branch.condition !== branch.label ? branch.condition : null);

                    const branchControls = (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {criteria === "aq_range" && (
                                <>
                                    <select
                                        className="px-1 py-0.5 text-[10px] font-mono border border-gray-600 rounded bg-gray-800 text-white focus:outline-none w-10"
                                        value={branch.operator || ">="}
                                        onChange={e => updateBranch(idx, { operator: e.target.value })}
                                    >
                                        <option value=">">{">"}</option>
                                        <option value=">=">{"≥"}</option>
                                        <option value="<">{"<"}</option>
                                        <option value="<=">{"≤"}</option>
                                        <option value="=">{"="}</option>
                                    </select>
                                    <select
                                        className="px-1 py-0.5 text-[10px] font-mono border border-gray-600 rounded bg-gray-800 text-white focus:outline-none w-12"
                                        value={branch.condition}
                                        onChange={e => updateBranch(idx, { condition: e.target.value })}
                                    >
                                        <option value="">—</option>
                                        {Array.from({ length: 21 }, (_, i) => i * 5).map(v => (
                                            <option key={v} value={String(v)}>{v}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                            {selectedOption.branches.length === 0 && criteria !== "aq_range" && (
                                <input
                                    className="px-1.5 py-0.5 text-[10px] font-mono border border-gray-600 rounded bg-gray-800 text-white focus:outline-none w-20"
                                    placeholder="value"
                                    value={branch.condition}
                                    onChange={e => updateBranch(idx, { condition: e.target.value })}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => removeBranch(idx)}
                                className="p-0.5 text-gray-400 hover:text-red-400 font-bold text-xs leading-none"
                            >×</button>
                        </div>
                    );

                    return (
                        <Collapsible
                            key={idx}
                            heading={
                                <input
                                    className="bg-transparent text-white text-xs font-bold w-full focus:outline-none placeholder-gray-500"
                                    placeholder="Branch label..."
                                    value={branch.label}
                                    onChange={e => updateBranch(idx, { label: e.target.value })}
                                    onClick={e => e.stopPropagation()}
                                />
                            }
                            headingExtra={conditionBadge ?? undefined}
                            controls={branchControls}
                            borderColor="border-gray-600"
                            defaultOpen={idx === 0}
                        >
                            <div className="p-2 bg-white">
                                <RichTextEditor
                                    value={branch.content}
                                    onChange={val => updateBranch(idx, { content: val })}
                                    placeholder="Message shown when this branch matches..."
                                    heightClass="h-[180px]"
                                    variant="simple"
                                />
                            </div>
                        </Collapsible>
                    );
                })}
                <button
                    type="button"
                    onClick={addBranch}
                    className="w-full py-1.5 text-[11px] font-bold text-sky-700 border-2 border-dashed border-sky-300 rounded-lg hover:bg-sky-100 transition-colors"
                >
                    + Add Branch
                </button>
            </div>
        </div>
    );
}

// ─── Image config panel (needs its own state for asset picker popup) ─────────// ─── Image config panel (needs its own state for asset picker popup) ─────────

function ImageConfigPanel({
    cfg,
    update,
    inputCls,
    labelCls,
}: {
    cfg: Record<string, any>;
    update: (patch: Record<string, any>) => void;
    inputCls: string;
    labelCls: string;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-2">

            {/* Preview + asset picker trigger */}
            <div className="flex items-start gap-2">
                <div className="flex-1">
                    <p className={labelCls}>Image URL</p>
                    <input
                        className={inputCls}
                        placeholder="https://example.com/image.jpg"
                        value={cfg.src || ""}
                        onChange={e => update({ src: e.target.value })}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    title="Browse asset library"
                    className="mt-4 shrink-0 px-3 py-1.5 text-xs font-bold bg-black text-white rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                    📂 Assets
                </button>
            </div>

            {/* Thumbnail preview */}
            {cfg.src && (
                <div className="w-full h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={cfg.src} alt="" className="w-full h-full object-cover" />
                </div>
            )}

            <p className={labelCls}>Alt text</p>
            <input
                className={inputCls}
                placeholder="Describe the image..."
                value={cfg.alt || ""}
                onChange={e => update({ alt: e.target.value })}
            />

            <p className={labelCls}>Link URL (optional)</p>
            <input
                className={inputCls}
                placeholder="https://... (wraps image in a link)"
                value={cfg.href || ""}
                onChange={e => update({ href: e.target.value })}
            />

            <div className="flex items-center gap-2 mt-1">
                <p className={labelCls + " mb-0"}>Object fit</p>
                <select
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                    value={cfg.fit || "cover"}
                    onChange={e => update({ fit: e.target.value })}
                >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                </select>
            </div>

            {pickerOpen && (
                <AssetPickerModal
                    onSelect={url => update({ src: url })}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </div>
    );
}

function ConfigPanel({
    moduleId,
    content,
    onContentChange,
}: {
    moduleId: string;
    content: string | undefined;
    onContentChange: (val: string) => void;
}) {
    const cfg = parseContent(content);

    function update(patch: Record<string, any>) {
        onContentChange(JSON.stringify({ ...cfg, ...patch }));
    }

    const inputCls = "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-black";
    const labelCls = "block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1";

    switch (moduleId) {
        case "level_up_hero":
            return (
                <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200 flex flex-col gap-2">
                    <p className={labelCls}>Custom subheading (optional)</p>
                    <input
                        className={inputCls}
                        placeholder="e.g. You crushed it!"
                        value={cfg.subheading || ""}
                        onChange={e => update({ subheading: e.target.value })}
                    />
                    <p className={labelCls}>Custom body message (optional — overrides tier message)</p>
                    <textarea
                        className={inputCls + " resize-none"}
                        rows={3}
                        placeholder="Leave blank to use the tier message configured above"
                        value={cfg.body || ""}
                        onChange={e => update({ body: e.target.value })}
                    />
                </div>
            );

        case "izzy":
            return <IzzyConfigPanel cfg={cfg} update={update} inputCls={inputCls} labelCls={labelCls} />;

        case "awareness_assessment":
            return (
                <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200 flex flex-col gap-2">
                    <p className={labelCls}>Assessment content (HTML supported)</p>
                    <textarea
                        className={inputCls + " resize-none font-mono text-[11px]"}
                        rows={5}
                        placeholder="<p>Your awareness assessment breakdown...</p>"
                        value={cfg.html || ""}
                        onChange={e => update({ html: e.target.value })}
                    />
                </div>
            );

        case "conditional_content":
            return <ConditionalContentPanel cfg={cfg} update={update} inputCls={inputCls} labelCls={labelCls} />;

        case "scoring_groups":
            return (
                <div className="mt-2 flex flex-col gap-1.5">
                    <Collapsible
                        heading="🏆 Group A (Top)"
                        borderColor="border-green-700"
                        controls={
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <span className="text-[10px] text-gray-400">min</span>
                                <input
                                    type="number"
                                    className="w-14 px-1.5 py-0.5 text-[10px] border border-gray-600 rounded bg-gray-800 text-white font-mono focus:outline-none"
                                    placeholder="90"
                                    value={cfg.tier_a_min ?? 90}
                                    onChange={e => update({ tier_a_min: Number(e.target.value) })}
                                />
                            </div>
                        }
                        defaultOpen={true}
                    >
                        <div className="bg-white">
                            <RichTextEditor
                                value={cfg.tier_a_message || ""}
                                onChange={val => update({ tier_a_message: val })}
                                placeholder="Group A feedback message..."
                                heightClass="h-[180px]"
                                variant="simple"
                            />
                        </div>
                    </Collapsible>
                    <Collapsible
                        heading="⭐ Group B (Mid)"
                        borderColor="border-yellow-700"
                        controls={
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <span className="text-[10px] text-gray-400">min</span>
                                <input
                                    type="number"
                                    className="w-14 px-1.5 py-0.5 text-[10px] border border-gray-600 rounded bg-gray-800 text-white font-mono focus:outline-none"
                                    placeholder="70"
                                    value={cfg.tier_b_min ?? 70}
                                    onChange={e => update({ tier_b_min: Number(e.target.value) })}
                                />
                            </div>
                        }
                        defaultOpen={false}
                    >
                        <div className="bg-white">
                            <RichTextEditor
                                value={cfg.tier_b_message || ""}
                                onChange={val => update({ tier_b_message: val })}
                                placeholder="Group B feedback message..."
                                heightClass="h-[180px]"
                                variant="simple"
                            />
                        </div>
                    </Collapsible>
                    <Collapsible
                        heading="🤔 Group C (Low)"
                        borderColor="border-gray-600"
                        headingExtra="below B"
                        defaultOpen={false}
                    >
                        <div className="bg-white">
                            <RichTextEditor
                                value={cfg.tier_c_message || ""}
                                onChange={val => update({ tier_c_message: val })}
                                placeholder="Group C feedback message..."
                                heightClass="h-[180px]"
                                variant="simple"
                            />
                        </div>
                    </Collapsible>
                </div>
            );

        case "poll":
            return (
                <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200 flex flex-col gap-2">
                    <p className={labelCls}>Poll source</p>
                    <select
                        className={inputCls}
                        value={cfg.pollSource || "current"}
                        onChange={e => update({ pollSource: e.target.value, pollId: "" })}
                    >
                        <option value="current">Current Poll</option>
                        <option value="previous">Previous Poll</option>
                        <option value="specific">Specific Poll ID</option>
                    </select>
                    {cfg.pollSource === "specific" && (
                        <input
                            className={inputCls}
                            placeholder="Poll ID"
                            value={cfg.pollId || ""}
                            onChange={e => update({ pollId: e.target.value })}
                        />
                    )}
                </div>
            );

        case "tip":
            return (
                <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200 flex flex-col gap-2">
                    <p className={labelCls}>Tip title (optional)</p>
                    <input
                        className={inputCls}
                        placeholder="e.g. Did you know?"
                        value={cfg.title || ""}
                        onChange={e => update({ title: e.target.value })}
                    />
                    <p className={labelCls}>Tip content</p>
                    <textarea
                        className={inputCls + " resize-none"}
                        rows={3}
                        placeholder="Enter your helpful tip here..."
                        value={cfg.body || ""}
                        onChange={e => update({ body: e.target.value })}
                    />
                </div>
            );

        case "rich_text":
            return (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 flex flex-col gap-2">
                    <p className={labelCls}>Content (HTML supported)</p>
                    <textarea
                        className={inputCls + " resize-none font-mono text-[11px]"}
                        rows={4}
                        placeholder="<p>Your content here...</p>"
                        value={cfg.html || ""}
                        onChange={e => update({ html: e.target.value })}
                    />
                </div>
            );

        case "quest":
            return (
                <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200 flex flex-col gap-2">
                    <p className={labelCls}>Quest title</p>
                    <input
                        className={inputCls}
                        placeholder="e.g. The Alignment Challenge"
                        value={cfg.title || ""}
                        onChange={e => update({ title: e.target.value })}
                    />
                    <p className={labelCls}>Description</p>
                    <textarea
                        className={inputCls + " resize-none"}
                        rows={2}
                        placeholder="What must the player do?"
                        value={cfg.description || ""}
                        onChange={e => update({ description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className={labelCls}>Reward (pts)</p>
                            <input
                                type="number"
                                className={inputCls}
                                placeholder="50"
                                value={cfg.reward || ""}
                                onChange={e => update({ reward: e.target.value })}
                            />
                        </div>
                        <div>
                            <p className={labelCls}>Reward label</p>
                            <input
                                className={inputCls}
                                placeholder="e.g. Bonus XP"
                                value={cfg.rewardLabel || ""}
                                onChange={e => update({ rewardLabel: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            );

        case "image":
            return <ImageConfigPanel cfg={cfg} update={update} inputCls={inputCls} labelCls={labelCls} />;

        case "video":
            return (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-2">
                    <p className={labelCls}>Video URL</p>
                    <input
                        className={inputCls}
                        placeholder="YouTube or Vimeo URL"
                        value={cfg.url || ""}
                        onChange={e => update({ url: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 leading-snug">Supports youtube.com, youtu.be, and vimeo.com links.</p>
                    <p className={labelCls}>Caption (optional)</p>
                    <input
                        className={inputCls}
                        placeholder="Optional caption below video"
                        value={cfg.caption || ""}
                        onChange={e => update({ caption: e.target.value })}
                    />
                </div>
            );

        default:
            return null;
    }
}

// ─── Collapsible section ─────────────────────────────────────────────────────

function Collapsible({
    heading,
    defaultOpen = true,
    controls,
    children,
    borderColor = "border-gray-700",
    headingExtra,
}: {
    heading: React.ReactNode;
    defaultOpen?: boolean;
    controls?: React.ReactNode;
    children: React.ReactNode;
    borderColor?: string;
    headingExtra?: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`rounded-xl border overflow-hidden ${borderColor}`}>
            {/* Dark header row */}
            <div
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 cursor-pointer select-none"
                onClick={() => setOpen(o => !o)}
            >
                <span className="text-gray-400 text-[10px] shrink-0 transition-transform duration-150"
                    style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                <span className="flex-1 text-xs font-bold text-white truncate">{heading}</span>
                {headingExtra && <span className="shrink-0 text-gray-400 text-[10px]">{headingExtra}</span>}
                {controls && (
                    <span className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {controls}
                    </span>
                )}
            </div>
            {/* Body — transparent */}
            {open && (
                <div className="bg-transparent">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Palette chip ─────────────────────────────────────────────────────────────

function DraggableChip({ moduleId, dimmed, customLabel, customEmoji }: { moduleId: string; dimmed?: boolean; customLabel?: string; customEmoji?: string }) {
    const meta = getModuleMeta(moduleId);
    const label = customLabel ?? meta?.label ?? moduleId;
    const emoji = customEmoji ?? meta?.emoji ?? "📦";
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `palette:${moduleId}`,
        data: { type: "palette", moduleId },
    });

    return (
        <div className="relative">
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-bold cursor-grab active:cursor-grabbing shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all select-none"
            >
                <span>{emoji}</span>
                <span>{label}</span>
            </div>
            {dimmed && (
                <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-black text-green-700 uppercase tracking-wider">placed ✓</span>
                </div>
            )}
        </div>
    );
}

// ─── Slot module chip (placed) ────────────────────────────────────────────────

function DraggableSlotModule({ moduleId, slotId, modIndex, customModules, reorderControls }: {
    moduleId: string; slotId: string; modIndex: number;
    customModules?: CustomModule[]; reorderControls?: React.ReactNode;
}) {
    const isCustom = moduleId.startsWith(CUSTOM_MODULE_PREFIX);
    const customMod = isCustom ? customModules?.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === moduleId) : null;
    const meta = isCustom
        ? { emoji: customMod?.emoji || "📦", label: customMod?.name || "Custom Module" }
        : getModuleMeta(moduleId);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `slot:${slotId}:${modIndex}`,
        data: { type: "slot", moduleId, slotId, modIndex },
    });

    return (
        <div
            style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white border-b border-gray-100"
        >
            {/* Drag handle */}
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                className="flex items-center gap-1.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
                title="Drag to move to another column"
            >
                <span className="text-gray-300 text-xs shrink-0">⠿</span>
                <span className="text-sm shrink-0">{meta?.emoji}</span>
                <span className="flex-1 text-xs font-bold text-gray-700 truncate">{meta?.label ?? moduleId}</span>
            </div>
            {/* Reorder / remove controls */}
            {reorderControls && (
                <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {reorderControls}
                </div>
            )}
        </div>
    );
}

// ─── Droppable slot (drop zone only — modules rendered inline above) ──────────

function DroppableSlot({
    slotId,
    isEmpty,
    customModules,
}: {
    slotId: string;
    isEmpty: boolean;
    customModules: CustomModule[];
}) {
    const { isOver, setNodeRef } = useDroppable({ id: slotId, data: { type: "slot", slotId } });

    return (
        <div
            ref={setNodeRef}
            className={`flex items-center justify-center rounded-lg border-2 transition-all ${
                isOver
                    ? "border-black bg-yellow-100 scale-[1.02] min-h-[48px]"
                    : isEmpty
                        ? "border-dashed border-gray-300 bg-gray-50/50 min-h-[48px]"
                        : "border-dashed border-gray-200 min-h-[32px]"
            }`}
        >
            <p className="text-xs text-gray-400 font-medium pointer-events-none select-none">
                {isOver ? "Drop here" : isEmpty ? "Drop module" : "+ drop another"}
            </p>
        </div>
    );
}

// ─── Drag overlay ─────────────────────────────────────────────────────────────

function OverlayChip({ moduleId }: { moduleId: string }) {
    const meta = getModuleMeta(moduleId);
    if (!meta) return null;
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-xl text-sm font-bold shadow-xl rotate-2 cursor-grabbing select-none">
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LayoutBuilderProps {
    value: LayoutConfig;
    onChange: (config: LayoutConfig) => void;
    onSavePage?: () => void;
    isSavingPage?: boolean;
}

export default function LayoutBuilder({ value, onChange, onSavePage, isSavingPage }: LayoutBuilderProps) {
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [paletteTab, setPaletteTab] = useState<"modules" | "variables">("modules");
    const [copiedVar, setCopiedVar] = useState<string | null>(null);

    const [customModules, setCustomModules] = useState<CustomModule[]>([]);
    const [savingSlot, setSavingSlot] = useState<{ moduleId: string; content: string | undefined; existingCustomModule?: CustomModule } | null>(null);
    const supabase = createClient();

    // Load custom modules from Supabase on mount
    useEffect(() => {
        supabase
            .from("custom_modules")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => { if (data) setCustomModules(data as CustomModule[]); });
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const rows = value.rows ?? [];

    const placedAppModules = new Set(
        rows.flatMap(r =>
            (r.columns ?? []).flatMap(c =>
                migrateColumn(c).modules
                    .map(m => m.moduleId)
                    .filter((id): id is string => !!id && !CONTENT_BLOCK_IDS.has(id))
            )
        )
    );

    // Group app modules by category for display
    const categories = Array.from(new Set(APP_MODULES.map(m => m.category)));

    async function deleteCustomModule(mod: CustomModule) {
        if (!confirm(`Delete custom module "${mod.name}"? It will be removed from the palette but won't affect already-placed instances.`)) return;
        await supabase.from("custom_modules").delete().eq("id", mod.id);
        setCustomModules(prev => prev.filter(m => m.id !== mod.id));
    }

    function parseSlotId(slotId: string) {
        const [r, c] = slotId.split(":").map(Number);
        return { rowIndex: r, colIndex: c };
    }

    function addModuleToSlot(rowIndex: number, colIndex: number, moduleId: string, prefillContent?: string) {
        const newRows = rows.map((row, ri) => ri !== rowIndex ? row : ({
            ...row,
            columns: row.columns.map((col, ci) => {
                if (ci !== colIndex) return col;
                const existing = migrateColumn(col).modules;
                return { ...col, modules: [...existing, { moduleId, content: prefillContent }] };
            }),
        }));
        onChange({ rows: newRows });
    }

    function removeModuleFromSlot(rowIndex: number, colIndex: number, moduleIndex: number) {
        const newRows = rows.map((row, ri) => ri !== rowIndex ? row : ({
            ...row,
            columns: row.columns.map((col, ci) => {
                if (ci !== colIndex) return col;
                const existing = migrateColumn(col).modules;
                return { ...col, modules: existing.filter((_, mi) => mi !== moduleIndex) };
            }),
        }));
        onChange({ rows: newRows });
    }

    function updateModuleContent(rowIndex: number, colIndex: number, moduleIndex: number, content: string) {
        const newRows = rows.map((row, ri) => ri !== rowIndex ? row : ({
            ...row,
            columns: row.columns.map((col, ci) => {
                if (ci !== colIndex) return col;
                const existing = migrateColumn(col).modules;
                return { ...col, modules: existing.map((m, mi) => mi !== moduleIndex ? m : { ...m, content }) };
            }),
        }));
        onChange({ rows: newRows });
    }

    function addRow(preset: typeof ROW_PRESETS[0]) {
        const newRow: LayoutRow = { id: generateId(), columns: preset.columns.map(width => ({ width, modules: [] })) };
        onChange({ rows: [...rows, newRow] });
    }

    function removeRow(rowIndex: number) {
        onChange({ rows: rows.filter((_, i) => i !== rowIndex) });
    }

    function removeColumn(rowIndex: number, colIndex: number) {
        const row = rows[rowIndex];
        const remaining = row.columns.filter((_, ci) => ci !== colIndex);
        if (remaining.length === 0) { removeRow(rowIndex); return; }

        // Redistribute widths evenly in sixths
        const sixthsMap: Record<ColumnWidth, number> = {
            "1/1": 6, "1/2": 3, "1/3": 2, "2/3": 4,
            "1/6": 1, "2/6": 2, "4/6": 4, "5/6": 5,
        };
        const sixthsToWidth: Record<number, ColumnWidth> = {
            6: "1/1", 5: "5/6", 4: "4/6", 3: "1/2", 2: "1/3", 1: "1/6",
        };
        const totalSixths = 6;
        const perCol = Math.floor(totalSixths / remaining.length);
        const remainder = totalSixths % remaining.length;
        const newColumns = remaining.map((col, i) => ({
            ...col,
            width: sixthsToWidth[perCol + (i < remainder ? 1 : 0)] ?? "1/1" as ColumnWidth,
        }));

        const newRows = rows.map((r, ri) => ri !== rowIndex ? r : { ...r, columns: newColumns });
        onChange({ rows: newRows });
    }

    function moveRow(rowIndex: number, direction: -1 | 1) {
        const newRows = [...rows];
        const swap = rowIndex + direction;
        if (swap < 0 || swap >= newRows.length) return;
        [newRows[rowIndex], newRows[swap]] = [newRows[swap], newRows[rowIndex]];
        onChange({ rows: newRows });
    }

    function handleDragStart(event: DragStartEvent) {
        setActiveModuleId(event.active.data.current?.moduleId ?? null);
    }

    function handleDragEnd(event: DragEndEvent) {
        setActiveModuleId(null);
        const { active, over } = event;
        if (!over) return;

        const sourceData = active.data.current;
        const targetData = over.data.current;
        if (!targetData || targetData.type !== "slot") return;

        const { rowIndex: targetRow, colIndex: targetCol } = parseSlotId(targetData.slotId);
        const draggedModuleId: string = sourceData?.moduleId;
        if (!draggedModuleId) return;

        if (sourceData.type === "palette") {
            const isCustomDrop = draggedModuleId.startsWith(CUSTOM_MODULE_PREFIX);
            const isContentBlock = CONTENT_BLOCK_IDS.has(draggedModuleId);
            const isSingleton = !isContentBlock && !isCustomDrop;
            const customMod = isCustomDrop
                ? customModules.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === draggedModuleId)
                : null;

            // For singletons, remove from any other slot first
            let workRows = isSingleton
                ? rows.map(r => ({
                    ...r,
                    columns: r.columns.map(col => ({
                        ...col,
                        modules: migrateColumn(col).modules.filter(m => m.moduleId !== draggedModuleId),
                    })),
                }))
                : rows.map(r => ({ ...r }));

            // Append to target column's module stack
            // For column_stack custom modules, expand the saved stack
            let modulesToAdd: ColumnModule[];
            if (customMod?.base_module_id === "column_stack" && customMod.content) {
                try {
                    const parsed = JSON.parse(customMod.content);
                    modulesToAdd = parsed.stack ?? [parsed];
                } catch {
                    modulesToAdd = [{ moduleId: draggedModuleId, content: customMod.content }];
                }
            } else {
                modulesToAdd = [{ moduleId: draggedModuleId, content: customMod?.content }];
            }
            workRows = workRows.map((row, ri) => ri !== targetRow ? row : ({
                ...row,
                columns: row.columns.map((col, ci) => {
                    if (ci !== targetCol) return col;
                    const existing = migrateColumn(col).modules;
                    return { ...col, modules: [...existing, ...modulesToAdd] };
                }),
            }));
            onChange({ rows: workRows });
        } else if (sourceData.type === "slot") {
            const { rowIndex: srcRow, colIndex: srcCol } = parseSlotId(sourceData.slotId);
            const srcModIndex: number = sourceData.modIndex ?? 0;
            if (srcRow === targetRow && srcCol === targetCol) return;

            // Pick out the specific module being dragged
            const srcColMods = migrateColumn(rows[srcRow]?.columns[srcCol]).modules;
            const movingMod = srcColMods[srcModIndex];
            if (!movingMod) return;

            // Remove from source column, append to target column
            const newRows = rows.map((row, ri) => ({
                ...row,
                columns: row.columns.map((col, ci) => {
                    if (ri === srcRow && ci === srcCol) {
                        return { ...col, modules: migrateColumn(col).modules.filter((_, mi) => mi !== srcModIndex) };
                    }
                    if (ri === targetRow && ci === targetCol) {
                        return { ...col, modules: [...migrateColumn(col).modules, movingMod] };
                    }
                    return col;
                }),
            }));
            onChange({ rows: newRows });
        }
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 items-start">

                {/* ── LEFT: Canvas ─── */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">

                {/* ── Canvas rows ─── */}
                {rows.length === 0 && (
                    <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 font-medium">
                        No rows yet — add a preset below
                    </div>
                )}
                {rows.map((row, rowIndex) => {
                    const moduleLabels = row.columns
                        .flatMap(c => migrateColumn(c).modules)
                        .map(m => {
                            const isCustom = m.moduleId.startsWith(CUSTOM_MODULE_PREFIX);
                            if (isCustom) return customModules.find(x => `${CUSTOM_MODULE_PREFIX}${x.id}` === m.moduleId)?.name ?? "Custom";
                            return getModuleMeta(m.moduleId)?.label ?? m.moduleId;
                        });
                    const rowHeading = moduleLabels.length
                        ? moduleLabels.join(" · ")
                        : `Row ${rowIndex + 1} — ${row.columns.map(c => c.width).join(" + ")}`;

                    const rowControls = (
                        <div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}
                                className="p-1 text-gray-400 hover:text-white disabled:opacity-20 text-xs leading-none">↑</button>
                            <button type="button" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === rows.length - 1}
                                className="p-1 text-gray-400 hover:text-white disabled:opacity-20 text-xs leading-none">↓</button>
                            <button type="button" onClick={() => removeRow(rowIndex)}
                                className="p-1 text-gray-400 hover:text-red-400 text-xs font-bold leading-none">✕</button>
                        </div>
                    );

                    return (
                        <Collapsible
                            key={row.id}
                            heading={rowHeading}
                            headingExtra={`${row.columns.map(c => c.width).join(" + ")}`}
                            controls={rowControls}
                            borderColor="border-gray-700"
                        >
                            <div className="grid grid-cols-6 gap-2 p-3">
                                {row.columns.map((col, colIndex) => {
                                    const colMods = migrateColumn(col).modules;
                                    const colLabel = colMods.length > 0
                                        ? colMods.map(m => {
                                            const isC = m.moduleId.startsWith(CUSTOM_MODULE_PREFIX);
                                            return isC ? (customModules.find(x => `${CUSTOM_MODULE_PREFIX}${x.id}` === m.moduleId)?.name ?? "Custom") : (getModuleMeta(m.moduleId)?.label ?? m.moduleId);
                                        }).join(" + ")
                                        : null;
                                    const colControls = row.columns.length > 1 ? (
                                        <button type="button" onClick={() => removeColumn(rowIndex, colIndex)}
                                            title="Remove this column"
                                            className="p-1 text-gray-400 hover:text-red-400 text-xs font-bold leading-none">✕</button>
                                    ) : null;

                                    return (
                                        <div key={colIndex} className={colSpanClass(col.width)}>
                                            <Collapsible
                                                heading={colLabel ?? `${col.width} slot`}
                                                headingExtra={col.width}
                                                controls={colControls}
                                                borderColor="border-gray-600"
                                                defaultOpen={true}
                                            >
                                                <div className="p-2 flex flex-col gap-2">
                                                    {colMods.map((mod, modIndex) => {
                                                        const isCustom = mod.moduleId.startsWith(CUSTOM_MODULE_PREFIX);
                                                        const baseModuleId = isCustom
                                                            ? (customModules.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === mod.moduleId)?.base_module_id ?? null)
                                                            : mod.moduleId;
                                                        const existingMod = isCustom ? customModules.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === mod.moduleId) : undefined;
                                                        const isConfigurable = baseModuleId ? CONFIGURABLE_IDS.has(baseModuleId) : false;
                                                        const meta = isCustom
                                                            ? { emoji: existingMod?.emoji ?? "📦", label: existingMod?.name ?? "Custom" }
                                                            : getModuleMeta(mod.moduleId);
                                                        const slotId = `${rowIndex}:${colIndex}`;
                                                        return (
                                                            <div key={modIndex} className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                                                                <DraggableSlotModule
                                                                    moduleId={mod.moduleId}
                                                                    slotId={slotId}
                                                                    modIndex={modIndex}
                                                                    customModules={customModules}
                                                                    reorderControls={<>
                                                                        {modIndex > 0 && (
                                                                            <button type="button" title="Move up" onClick={() => {
                                                                                const next = [...colMods];
                                                                                [next[modIndex-1], next[modIndex]] = [next[modIndex], next[modIndex-1]];
                                                                                const nr = rows.map((r, ri) => ri !== rowIndex ? r : ({ ...r, columns: r.columns.map((c, ci) => ci !== colIndex ? c : { ...c, modules: next }) }));
                                                                                onChange({ rows: nr });
                                                                            }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">↑</button>
                                                                        )}
                                                                        {modIndex < colMods.length - 1 && (
                                                                            <button type="button" title="Move down" onClick={() => {
                                                                                const next = [...colMods];
                                                                                [next[modIndex], next[modIndex+1]] = [next[modIndex+1], next[modIndex]];
                                                                                const nr = rows.map((r, ri) => ri !== rowIndex ? r : ({ ...r, columns: r.columns.map((c, ci) => ci !== colIndex ? c : { ...c, modules: next }) }));
                                                                                onChange({ rows: nr });
                                                                            }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">↓</button>
                                                                        )}
                                                                        <button type="button" title="Remove module"
                                                                            onClick={() => removeModuleFromSlot(rowIndex, colIndex, modIndex)}
                                                                            className="text-gray-300 hover:text-red-500 font-bold text-sm leading-none">×</button>
                                                                    </>}
                                                                />

                                                                {isConfigurable && baseModuleId && (
                                                                    <div className="px-2 pb-2">
                                                                        <ConfigPanel
                                                                            moduleId={baseModuleId}
                                                                            content={mod.content}
                                                                            onContentChange={val => updateModuleContent(rowIndex, colIndex, modIndex, val)}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    <DroppableSlot
                                                        slotId={`${rowIndex}:${colIndex}`}
                                                        isEmpty={colMods.length === 0}
                                                        customModules={customModules}
                                                    />
                                                    {/* Single save button for the whole column stack */}
                                                    {colMods.length > 0 && (() => {
                                                        const isSingleCustom = colMods.length === 1 && colMods[0].moduleId.startsWith(CUSTOM_MODULE_PREFIX);
                                                        const existingColMod = isSingleCustom
                                                            ? customModules.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === colMods[0].moduleId)
                                                            : undefined;
                                                        const colContent = JSON.stringify(colMods.length === 1 ? colMods[0] : { stack: colMods });
                                                        const baseId = colMods.length === 1
                                                            ? (colMods[0].moduleId.startsWith(CUSTOM_MODULE_PREFIX)
                                                                ? (customModules.find(m => `${CUSTOM_MODULE_PREFIX}${m.id}` === colMods[0].moduleId)?.base_module_id ?? colMods[0].moduleId)
                                                                : colMods[0].moduleId)
                                                            : "column_stack";
                                                        return (
                                                            <button type="button"
                                                                onClick={() => setSavingSlot({ moduleId: baseId, content: colContent, existingCustomModule: existingColMod })}
                                                                className={`w-full py-1 text-[10px] font-bold border border-dashed rounded-lg transition-all ${isSingleCustom ? "text-amber-600 hover:text-amber-800 border-amber-300 bg-amber-50" : "text-gray-400 hover:text-black border-gray-200 hover:border-gray-400"}`}>
                                                                {isSingleCustom ? "💾 Update Custom Module" : "💾 Save as Custom Module"}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </Collapsible>
                                        </div>
                                    );
                                })}
                            </div>
                        </Collapsible>
                    );
                })}

                {/* ── Add Row ─── */}
                <Collapsible heading="Add Row" defaultOpen={true} borderColor="border-gray-600">
                    <div className="p-3 flex flex-wrap items-center gap-2">
                        {ROW_PRESETS.map(preset => (
                            <button key={preset.label} type="button" onClick={() => addRow(preset)}
                                className="px-3 py-2 text-xs font-bold bg-white border-2 border-black rounded-lg hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                                {preset.label}
                            </button>
                        ))}
                        {onSavePage && (
                            <button
                                type="button"
                                onClick={onSavePage}
                                disabled={isSavingPage}
                                className="ml-auto px-4 py-2 text-xs font-bold bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                                {isSavingPage ? "Saving…" : "💾 Save Page"}
                            </button>
                        )}
                    </div>
                </Collapsible>

                </div>{/* ── END LEFT CANVAS ─── */}

                {/* ── RIGHT: Module Palette + Variables ─── */}
                <div className="w-56 shrink-0 flex flex-col rounded-xl border border-gray-700 overflow-hidden">

                    {/* Tab bar */}
                    <div className="flex shrink-0 bg-gray-900">
                        <button
                            type="button"
                            onClick={() => setPaletteTab("modules")}
                            className={`flex-1 py-2 text-xs font-bold tracking-wide transition-colors border-b-2 ${paletteTab === "modules" ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                        >Modules</button>
                        <button
                            type="button"
                            onClick={() => setPaletteTab("variables")}
                            className={`flex-1 py-2 text-xs font-bold tracking-wide transition-colors border-b-2 ${paletteTab === "variables" ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                        >Variables</button>
                    </div>

                    {/* Variables tab */}
                    {paletteTab === "variables" && (
                        <div className="flex-1 overflow-y-auto bg-gray-900 p-2 flex flex-col gap-3">
                            {PALETTE_VARIABLE_GROUPS.map(group => (
                                <div key={group.label}>
                                    <p className="text-[9px] font-black uppercase tracking-widest px-2 py-1 mb-1"
                                        style={{ color: group.color === "#854d0e" ? "#fbbf24" : group.color === "#1e40af" ? "#93c5fd" : group.color === "#166534" ? "#86efac" : "#c4b5fd" }}>
                                        {group.label}
                                    </p>
                                    {group.note && (
                                        <p className="text-[9px] text-gray-500 px-2 mb-1.5 leading-snug italic">{group.note}</p>
                                    )}
                                    {group.vars.map(v => (
                                        <button
                                            key={v.value}
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText(v.value); setCopiedVar(v.value); setTimeout(() => setCopiedVar(null), 1500); }}
                                            className="group flex items-center justify-between w-full px-2 py-1.5 hover:bg-gray-800 rounded-lg text-left transition-colors"
                                            title={v.desc}
                                        >
                                            <div className="min-w-0">
                                                <div className="font-mono font-bold text-[11px] text-gray-100 truncate">{v.value}</div>
                                                <div className="text-[10px] text-gray-500 leading-tight">{v.desc}</div>
                                            </div>
                                            <span className="text-gray-600 group-hover:text-gray-300 ml-1.5 text-[10px] shrink-0">
                                                {copiedVar === v.value ? "✓" : "⎘"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                            <div className="pt-2 border-t border-gray-800">
                                <a href="/admin/documentation/variables" target="_blank"
                                    className="flex items-center justify-between text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1">
                                    <span>Full Documentation</span><span>↗</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Modules tab */}
                    {paletteTab === "modules" && (
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2">

                {/* ── Palette: App Modules ─── */}
                <Collapsible heading="App Modules" headingExtra="placed once each" defaultOpen={true} borderColor="border-gray-600">
                    <div className="p-3 flex flex-col gap-4">
                        {categories.map(cat => (
                            <div key={cat}>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                                <div className="flex flex-wrap gap-2">
                                    {APP_MODULES.filter(m => m.category === cat).map(mod => (
                                        <DraggableChip key={mod.id} moduleId={mod.id} dimmed={placedAppModules.has(mod.id)} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Collapsible>

                {/* ── Palette: Content Blocks ─── */}
                <Collapsible heading="Content Blocks" headingExtra="can repeat" defaultOpen={true} borderColor="border-gray-600">
                    <div className="p-3 flex flex-wrap gap-2">
                        {CONTENT_BLOCKS.map(mod => (
                            <DraggableChip key={mod.id} moduleId={mod.id} />
                        ))}
                    </div>
                </Collapsible>

                {/* ── Palette: Saved Custom Modules ─── */}
                <Collapsible heading="Saved Modules" headingExtra="can repeat" defaultOpen={true} borderColor="border-amber-700">
                    <div className="p-3">
                        {customModules.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No saved modules yet. Configure any module slot and click "Save as Custom Module".</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {customModules.map(mod => (
                                    <div key={mod.id} className="relative group">
                                        <DraggableChip moduleId={`${CUSTOM_MODULE_PREFIX}${mod.id}`} customLabel={mod.name} customEmoji={mod.emoji} />
                                        <button
                                            type="button"
                                            onClick={() => deleteCustomModule(mod)}
                                            title="Delete this saved module"
                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 leading-none"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Collapsible>

                    </div>
                    )}{/* end modules tab */}

                </div>{/* ── END RIGHT PALETTE ─── */}

            </div>{/* ── END MAIN FLEX ─── */}

            {savingSlot && (
                <SaveAsModuleModal
                    moduleId={savingSlot.moduleId}
                    content={savingSlot.content}
                    existingModules={customModules}
                    existingCustomModule={savingSlot.existingCustomModule}
                    onSave={mod => setCustomModules(prev => {
                        const idx = prev.findIndex(m => m.id === mod.id);
                        return idx >= 0 ? prev.map(m => m.id === mod.id ? mod : m) : [mod, ...prev];
                    })}
                    onClose={() => setSavingSlot(null)}
                />
            )}

            <DragOverlay dropAnimation={null}>
                {activeModuleId ? <OverlayChip moduleId={activeModuleId} /> : null}
            </DragOverlay>
        </DndContext>
    );
}

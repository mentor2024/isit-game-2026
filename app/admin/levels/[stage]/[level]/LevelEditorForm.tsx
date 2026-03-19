"use client";

import { useState } from "react";
import { formatStage } from "@/lib/formatters";
import { saveLevelConfig } from "@/app/admin/levels/actions";
import dynamic from "next/dynamic";
import type { LayoutConfig } from "@/components/LayoutBuilder";

const LayoutBuilder = dynamic(() => import("@/components/LayoutBuilder"), { ssr: false });

type PathConfig = {
    instructions: string;
    path1: { label: string; url: string; };
    path2: { label: string; url: string; };
};

type LevelConfig = {
    instructions: string;
    enabled_modules: string[];
    layout_config?: LayoutConfig;
    path_selector_config?: PathConfig;
    is_linked?: boolean;
    show_interstitial?: boolean;
    score_tiers?: {
        tier?: string;
        title?: string;
        min_score: number;
        message: string;
    }[];
};

const AVAILABLE_MODULES = [
    { id: "is_it_rails", label: "IS IT Rails" },
    { id: "level_scores", label: "Level Scores (Left Rail)" },
    { id: "your_metrics", label: "Your Metrics (Right Rail)" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "aggregate_results", label: "Aggregate Poll Results" },
    { id: "path_selector", label: "Path Selector" },
    { id: "discussion_forum", label: "Discussion Forum" },
];

export default function LevelEditorForm({
    stage,
    level,
    initialConfig,
    pollCount
}: {
    stage: number;
    level: number;
    initialConfig?: LevelConfig;
    pollCount: number;
}) {
    // Aggressive client-side cleanup
    const cleanClientHtml = (html: string | undefined | null) => {
        if (!html) return "";
        return html
            // Remove NBSP variants
            .replace(/&nbsp;/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/&amp;nbsp;/g, ' ')
            // Remove newlines/spaces between tags causing "extra line breaks"
            // Be careful not to merge words: only match > whitespace <
            .replace(/>\s+</g, '><')
            // Optional: trim extra whitespace
            .trim();
    };

    const [loading, setLoading] = useState(false);
    const [isSavingPage, setIsSavingPage] = useState(false);
    const [message, setMessage] = useState("");
    const [pageMessage, setPageMessage] = useState("");

    // Rich Text State (Cleaned on Init)
    const [instructions, setInstructions] = useState(cleanClientHtml(initialConfig?.instructions));
    // Ensure we parse by Tier Letter instead of array index to prevent shifting

    // Path Selector State
    const savedPathConfig = initialConfig?.path_selector_config;
    const [pathConfig, setPathConfig] = useState<PathConfig>({
        instructions: savedPathConfig?.instructions || "Choose your path...",
        path1: savedPathConfig?.path1?.label ? savedPathConfig.path1 : { label: "Next Level", url: `/stage/${stage}/level/${level + 1}` },
        path2: savedPathConfig?.path2?.label ? savedPathConfig.path2 : { label: "Bonus Image Level", url: `/stage/${stage + 1}/level/1` }
    });

    // Layout config (source of truth for modules)
    const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(
        (() => { const lc = initialConfig?.layout_config; return (lc && Array.isArray(lc.rows)) ? lc : { rows: [] }; })()
    );

    // Derived: which modules are currently placed (for path selector visibility)
    const enabledModules = (layoutConfig?.rows ?? [])
        .flatMap((r: any) => (r.columns ?? []).map((c: any) => c.moduleId))
        .filter((id): id is string => Boolean(id));

    const isPathSelectorEnabled = enabledModules.includes("path_selector");


    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setMessage("");

        // Clean again on save just in case
        formData.set("instructions", cleanClientHtml(instructions));

        // Sync layout_config from React state
        formData.set("layout_config", JSON.stringify(layoutConfig));
        // Remove any stale module checkboxes (layout_config is source of truth)
        formData.delete("modules");

        const result = await saveLevelConfig(stage, level, formData);

        if (result.success) {
            setMessage("Configuration saved successfully! ✅");
        } else {
            setMessage(`Error: ${result.error} ❌`);
        }
        setLoading(false);
    }

    async function saveLayout() {
        setIsSavingPage(true);
        setPageMessage("");
        const fd = new FormData();
        fd.set("layout_config", JSON.stringify(layoutConfig));
        fd.delete("modules");
        const result = await saveLevelConfig(stage, level, fd);
        setPageMessage(result.success ? "Page saved ✅" : `Error: ${result.error} ❌`);
        setTimeout(() => setPageMessage(""), 3000);
        setIsSavingPage(false);
    }

    return (
        <form action={handleSubmit} className="text-left flex flex-col gap-6">

            {/* Page Builder — has its own internal left/right split (canvas + palette) */}
            <div>
                <input type="hidden" name="layout_config" value={JSON.stringify(layoutConfig)} />
                <LayoutBuilder value={layoutConfig} onChange={setLayoutConfig} onSavePage={saveLayout} isSavingPage={isSavingPage} />
                {pageMessage && (
                    <div className={`text-center text-sm font-bold p-3 rounded-xl ${pageMessage.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{pageMessage}</div>
                )}
            </div>

            {/* Level Flow & Linking — constrained to match the canvas width (not the full page) */}
            <div className="flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                    <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                        <h3 className="font-black text-xl mb-4 text-blue-900 flex items-center gap-2">
                            🔗 Level Flow & Linking
                        </h3>
                        <div className="flex flex-col gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="is_linked"
                                    defaultChecked={initialConfig?.is_linked}
                                    className="w-6 h-6 accent-blue-600"
                                />
                                <div>
                                    <span className="font-bold text-blue-900 block">Link polls in this level as a series?</span>
                                    <span className="text-sm text-blue-700">Accumulate score across all polls before showing results.</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="show_interstitial"
                                    defaultChecked={initialConfig?.show_interstitial ?? true}
                                    className="w-6 h-6 accent-blue-600"
                                />
                                <div>
                                    <span className="font-bold text-blue-900 block">Show Interstitial Level-Up Page?</span>
                                    <span className="text-sm text-blue-700">
                                        If unchecked, users stay on the main screen instead of going to the transition page.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
                {/* Spacer matching the w-56 palette column in LayoutBuilder */}
                <div className="w-56 shrink-0" />
            </div>

            {/* Path Selector Config */}
            {isPathSelectorEnabled && (
                <div className="flex gap-4 items-start">
                    <div className="flex-1 min-w-0">
                        <div className="p-6 bg-gray-50 border-2 border-black rounded-xl animate-in fade-in slide-in-from-top-4">
                            <h3 className="font-black text-xl mb-4 flex items-center gap-2">
                                🔀 Path Selector Configuration
                            </h3>
                            <input type="hidden" name="path_selector_config" value={JSON.stringify(pathConfig)} />
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block font-bold text-sm mb-1">Selector Instructions</label>
                                    <textarea
                                        value={pathConfig.instructions}
                                        onChange={(e) => setPathConfig({ ...pathConfig, instructions: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                                        <h4 className="font-bold mb-2">Path 1 (Left)</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Button Label</label>
                                                <input value={pathConfig.path1.label}
                                                    onChange={(e) => setPathConfig({ ...pathConfig, path1: { ...pathConfig.path1, label: e.target.value } })}
                                                    className="w-full p-2 border border-gray-300 rounded" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Destination URL</label>
                                                <input value={pathConfig.path1.url}
                                                    onChange={(e) => setPathConfig({ ...pathConfig, path1: { ...pathConfig.path1, url: e.target.value } })}
                                                    className="w-full p-2 border border-gray-300 rounded font-mono text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                                        <h4 className="font-bold mb-2">Path 2 (Right)</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Button Label</label>
                                                <input value={pathConfig.path2.label}
                                                    onChange={(e) => setPathConfig({ ...pathConfig, path2: { ...pathConfig.path2, label: e.target.value } })}
                                                    className="w-full p-2 border border-gray-300 rounded" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Destination URL</label>
                                                <input value={pathConfig.path2.url}
                                                    onChange={(e) => setPathConfig({ ...pathConfig, path2: { ...pathConfig.path2, url: e.target.value } })}
                                                    className="w-full p-2 border border-gray-300 rounded font-mono text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-56 shrink-0" />
                </div>
            )}

            {/* Save — also constrained to canvas width */}
            <div className="flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-black text-white font-bold py-4 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? "Saving..." : "Change Settings"}
                    </button>
                    {message && (
                        <div className={`mt-4 text-center font-bold p-4 rounded-xl ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {message}
                        </div>
                    )}
                </div>
                <div className="w-56 shrink-0" />
            </div>

        </form>
    );
}

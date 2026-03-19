"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { bulkUpdateLevelModules } from "@/app/admin/levels/actions";
import { createClient } from "@/lib/supabaseClient";


// Define the modules matching the LevelEditorForm constants
const AVAILABLE_MODULES = [
    { id: "is_it_rails", label: "IS IT Rails" },
    { id: "level_scores", label: "Level Scores (Left Rail)" },
    { id: "your_metrics", label: "Your Metrics (Right Rail)" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "aggregate_results", label: "Aggregate Poll Results" },
    { id: "path_selector", label: "Path Selector" },
    { id: "discussion_forum", label: "Discussion Forum" },
];

type LevelRow = {
    stage: number;
    level: number;
    enabled_modules: string[];
    // We treat disabled modules as toggled if modified, but tracking the exact state is easier:
    currentModules: Set<string>;
};

export default function LevelBulkEditorPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Master data
    const [levels, setLevels] = useState<LevelRow[]>([]);

    // Filters
    const [stageFilter, setStageFilter] = useState<number | "all">("all");
    const [levelFilter, setLevelFilter] = useState<number | "all">("all");

    // UI Selection State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const supabase = createClient();

        // Fetch all configurations
        const { data: configs, error: configError } = await supabase
            .from('level_configurations')
            .select('stage, level, enabled_modules');

        // Fetch all polls to know what levels exist
        const { data: polls, error: pollError } = await supabase
            .from('polls')
            .select('stage, level');

        if (configError) {
            setMessage("Error loading configs: " + configError.message);
            setLoading(false);
            return;
        }

        if (pollError) {
            setMessage("Error loading polls: " + pollError.message);
            setLoading(false);
            return;
        }

        const levelsMap = new Map<string, LevelRow>();

        // Process configs first
        configs?.forEach(c => {
            const key = `${c.stage}-${c.level}`;
            levelsMap.set(key, {
                stage: c.stage,
                level: c.level,
                enabled_modules: Array.isArray(c.enabled_modules) ? c.enabled_modules : [],
                currentModules: new Set<string>(Array.isArray(c.enabled_modules) ? c.enabled_modules : [])
            });
        });

        // Overlay missing levels from polls
        polls?.forEach(p => {
            const s = p.stage !== undefined && p.stage !== null ? p.stage : 1;
            const l = p.level || 1;
            const key = `${s}-${l}`;
            if (!levelsMap.has(key)) {
                levelsMap.set(key, {
                    stage: s,
                    level: l,
                    enabled_modules: [],
                    currentModules: new Set<string>()
                });
            }
        });

        // Convert to array and sort
        const sorted = Array.from(levelsMap.values()).sort((a, b) => {
            if (a.stage !== b.stage) return a.stage - b.stage;
            return a.level - b.level;
        });

        setLevels(sorted);
        setLoading(false);
    };

    // Filter logic
    const filteredLevels = levels.filter(lvl => {
        if (stageFilter !== "all" && lvl.stage !== stageFilter) return false;
        if (levelFilter !== "all" && lvl.level !== levelFilter) return false;
        return true;
    });

    const getRowKey = (stage: number, level: number) => `S${stage}-L${level}`;

    // --- Selection Handlers ---
    const toggleRowSelection = (key: string) => {
        const next = new Set(selectedRows);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedRows(next);
    };

    const toggleSelectAllFiltered = () => {
        if (selectedRows.size === filteredLevels.length && filteredLevels.length > 0) {
            setSelectedRows(new Set()); // Deselect all
        } else {
            const next = new Set<string>();
            filteredLevels.forEach(l => next.add(getRowKey(l.stage, l.level)));
            setSelectedRows(next);
        }
    };

    // --- Module Toggle Handlers ---
    const toggleModuleValue = (stage: number, level: number, moduleId: string) => {
        setLevels(prev => prev.map(lvl => {
            if (lvl.stage === stage && lvl.level === level) {
                const nextModules = new Set(lvl.currentModules);
                if (nextModules.has(moduleId)) nextModules.delete(moduleId);
                else nextModules.add(moduleId);
                return { ...lvl, currentModules: nextModules };
            }
            return lvl;
        }));
    };

    const toggleColumnForSelected = (moduleId: string, forceState?: boolean) => {
        const targetKeys = selectedRows.size > 0
            ? selectedRows
            : new Set(filteredLevels.map(l => getRowKey(l.stage, l.level)));

        if (targetKeys.size === 0) return;

        setLevels(prev => prev.map(lvl => {
            const key = getRowKey(lvl.stage, lvl.level);
            if (targetKeys.has(key)) {
                const nextModules = new Set(lvl.currentModules);

                // If forceState is not provided, we toggle based on whether ANY selected row is missing it
                // Actually, standard behavior for a column master checkbox: 
                // If all selected have it -> uncheck all. Otherwise -> check all.
                let targetState = forceState;
                if (targetState === undefined) {
                    const allTargetHaveIt = Array.from(targetKeys).every(selectedKey => {
                        const targetLvl = prev.find(p => getRowKey(p.stage, p.level) === selectedKey);
                        return targetLvl?.currentModules.has(moduleId);
                    });
                    targetState = !allTargetHaveIt;
                }

                if (targetState) {
                    nextModules.add(moduleId);
                } else {
                    nextModules.delete(moduleId);
                }
                return { ...lvl, currentModules: nextModules };
            }
            return lvl;
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");

        // Find modified records
        const updates = levels.filter(lvl => {
            // Check if currentModules differs from original enabled_modules
            if (lvl.enabled_modules.length !== lvl.currentModules.size) return true;
            for (const mod of lvl.enabled_modules) {
                if (!lvl.currentModules.has(mod)) return true;
            }
            return false;
        }).map(lvl => ({
            stage: lvl.stage,
            level: lvl.level,
            enabled_modules: Array.from(lvl.currentModules)
        }));

        if (updates.length === 0) {
            setMessage("No changes to save.");
            setSaving(false);
            return;
        }

        const result = await bulkUpdateLevelModules(updates);
        if (result.success) {
            setMessage(`Successfully updated ${updates.length} level(s). ✅`);
            // Update baseline
            setLevels(prev => prev.map(lvl => ({
                ...lvl,
                enabled_modules: Array.from(lvl.currentModules)
            })));
        } else {
            setMessage(`Error saving: ${result.error} ❌`);
        }
        setSaving(false);
    };

    const targetKeysList = selectedRows.size > 0 ? Array.from(selectedRows) : filteredLevels.map(l => getRowKey(l.stage, l.level));

    return (
        <div className="max-w-[95%] mx-auto p-8 mb-12">
            <Link href="/admin/levels" className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 font-bold w-fit">
                <ArrowLeft size={20} />
                Back to Levels
            </Link>

            <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
                <div>
                    <h1 className="text-3xl font-black">Bulk Module Editor</h1>
                    <p className="text-gray-500 mt-2">Toggle modules across multiple levels quickly.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border-2 border-gray-200">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase">Stage</label>
                            <select
                                value={stageFilter}
                                onChange={e => setStageFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                                className="bg-transparent font-bold outline-none cursor-pointer"
                            >
                                <option value="all">All</option>
                                {[0, 1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Stage {s}</option>)}
                            </select>
                        </div>
                        <div className="w-px h-8 bg-gray-300"></div>
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase">Level</label>
                            <select
                                value={levelFilter}
                                onChange={e => setLevelFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                                className="bg-transparent font-bold outline-none cursor-pointer"
                            >
                                <option value="all">All</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>Level {s}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-black text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-gray-800 transition disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </header>

            {message && (
                <div className={`p-4 rounded-xl font-bold text-center mb-8 border-2 ${message.includes("Error") ? "bg-red-100 text-red-700 border-red-200" : (message.includes("No") ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-800 border-green-200")}`}>
                    {message}
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b-4 border-black border-collapse">
                            {/* Checkbox Column */}
                            <th className="p-4 w-12 border-r-2 border-gray-200 sticky left-0 bg-gray-50 z-10">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-black cursor-pointer"
                                    checked={filteredLevels.length > 0 && selectedRows.size === filteredLevels.length}
                                    onChange={toggleSelectAllFiltered}
                                    title="Select all filtered rows"
                                />
                            </th>

                            {/* Label Column */}
                            <th className="p-4 font-black border-r-2 border-gray-200 sticky left-[64px] bg-gray-50 z-10 whitespace-nowrap min-w-[100px]">
                                Level
                            </th>

                            {/* Module Columns */}
                            {AVAILABLE_MODULES.map(mod => (
                                <th key={mod.id} className="p-4 border-r-2 border-gray-200 text-center min-w-[120px]">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="font-bold leading-tight break-words" title={mod.label}>{mod.label}</span>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-blue-600 cursor-pointer"
                                            onChange={(e) => toggleColumnForSelected(mod.id, e.target.checked)}
                                            checked={targetKeysList.length > 0 && targetKeysList.every(selectedKey => {
                                                const targetLvl = filteredLevels.find(p => getRowKey(p.stage, p.level) === selectedKey);
                                                return targetLvl?.currentModules.has(mod.id);
                                            })}
                                            title="Check to toggle this module for targeted rows"
                                        />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={AVAILABLE_MODULES.length + 2} className="p-12 text-center text-gray-500 font-bold">
                                    Loading level configurations...
                                </td>
                            </tr>
                        ) : filteredLevels.length === 0 ? (
                            <tr>
                                <td colSpan={AVAILABLE_MODULES.length + 2} className="p-12 text-center text-gray-500 font-bold">
                                    No levels match the current filters.
                                </td>
                            </tr>
                        ) : (
                            filteredLevels.map((lvl) => {
                                const key = getRowKey(lvl.stage, lvl.level);
                                const isSelected = selectedRows.has(key);
                                // A row is "dirty" if its current modules don't match its saved modules.
                                const isDirty = lvl.enabled_modules.length !== lvl.currentModules.size ||
                                    !lvl.enabled_modules.every(m => lvl.currentModules.has(m));

                                return (
                                    <tr
                                        key={key}
                                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <td className="p-4 border-r-2 border-gray-200 sticky left-0 bg-white z-10">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-black cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleRowSelection(key)}
                                            />
                                        </td>
                                        <td className="p-4 font-black border-r-2 border-gray-200 sticky left-[64px] bg-white z-10 whitespace-nowrap">
                                            {lvl.stage}-{lvl.level}
                                            {isDirty && <span className="ml-2 w-2 h-2 inline-block bg-orange-500 rounded-full" title="Unsaved changes"></span>}
                                        </td>

                                        {AVAILABLE_MODULES.map(mod => (
                                            <td key={mod.id} className="p-4 border-r-2 border-gray-200 text-center hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => toggleModuleValue(lvl.stage, lvl.level, mod.id)}>
                                                <input
                                                    type="checkbox"
                                                    className="w-6 h-6 accent-blue-600 pointer-events-none"
                                                    checked={lvl.currentModules.has(mod.id)}
                                                    readOnly
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


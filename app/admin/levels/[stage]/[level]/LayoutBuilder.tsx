"use client";

import React, { useState } from "react";
import { Plus, Trash2, GripHorizontal, LayoutTemplate } from "lucide-react";

export type LayoutColumn = {
    id: string;
    width: string;
    moduleId: string | null;
};

export type LayoutRow = {
    id: string;
    template: string;
    columns: LayoutColumn[];
};

export const AVAILABLE_MODULES = [
    { id: "main_content", label: "Main Content (Title & Intro)" },
    { id: "izzy_image", label: "Izzy Image Area" },
    { id: "is_it_rails", label: "IS IT Rails" },
    { id: "level_scores", label: "Level Scores (Left Rail)" },
    { id: "your_metrics", label: "Your Metrics (Right Rail)" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "aggregate_results", label: "Aggregate Poll Results" },
    { id: "path_selector", label: "Path Selector" },
    { id: "discussion_forum", label: "Discussion Forum" },
];

export const TEMPLATES = [
    { id: "100", label: "100%", widths: ["w-full"] },
    { id: "50-50", label: "50% / 50%", widths: ["w-1/2", "w-1/2"] },
    { id: "33-66", label: "33% / 66%", widths: ["w-1/3", "w-2/3"] },
    { id: "66-33", label: "66% / 33%", widths: ["w-2/3", "w-1/3"] },
    { id: "33-33-33", label: "33% / 33% / 33%", widths: ["w-1/3", "w-1/3", "w-1/3"] },
];

export default function LayoutBuilder({
    initialLayout,
    onLayoutChange,
}: {
    initialLayout: LayoutRow[];
    onLayoutChange: (layout: LayoutRow[]) => void;
}) {
    const [layout, setLayout] = useState<LayoutRow[]>(initialLayout || []);

    const handleAddRow = (templateId: string) => {
        const template = TEMPLATES.find(t => t.id === templateId);
        if (!template) return;

        const newRow: LayoutRow = {
            id: `row_${Date.now()}`,
            template: template.id,
            columns: template.widths.map((w, i) => ({
                id: `col_${Date.now()}_${i}`,
                width: w,
                moduleId: null,
            })),
        };

        const newLayout = [...layout, newRow];
        setLayout(newLayout);
        onLayoutChange(newLayout);
    };

    const handleRemoveRow = (rowId: string) => {
        const newLayout = layout.filter(r => r.id !== rowId);
        setLayout(newLayout);
        onLayoutChange(newLayout);
    };

    const handleDragStart = (e: React.DragEvent, moduleId: string, sourceColId?: string) => {
        e.dataTransfer.setData("moduleId", moduleId);
        if (sourceColId) {
            e.dataTransfer.setData("sourceColId", sourceColId);
        }
    };

    const handleDrop = (e: React.DragEvent, targetRowId: string, targetColId: string) => {
        e.preventDefault();
        const moduleId = e.dataTransfer.getData("moduleId");
        const sourceColId = e.dataTransfer.getData("sourceColId");

        if (!moduleId) return;

        const newLayout = [...layout];

        // If moving from another column, clear the source
        if (sourceColId) {
            newLayout.forEach(row => {
                row.columns.forEach(col => {
                    if (col.id === sourceColId) {
                        col.moduleId = null;
                    }
                });
            });
        }

        // Add to target column (overwrite whatever is there)
        newLayout.forEach(row => {
            if (row.id === targetRowId) {
                row.columns.forEach(col => {
                    if (col.id === targetColId) {
                        col.moduleId = moduleId;
                    }
                });
            }
        });

        setLayout(newLayout);
        onLayoutChange(newLayout);
    };

    const handleRemoveModule = (rowId: string, colId: string) => {
        const newLayout = [...layout];
        newLayout.forEach(row => {
            if (row.id === rowId) {
                row.columns.forEach(col => {
                    if (col.id === colId) {
                        col.moduleId = null;
                    }
                });
            }
        });
        setLayout(newLayout);
        onLayoutChange(newLayout);
    };

    const getAssignedModuleIds = () => {
        const ids = new Set<string>();
        layout.forEach(r => r.columns.forEach(c => {
            if (c.moduleId) ids.add(c.moduleId);
        }));
        return ids;
    };

    const assignedIds = getAssignedModuleIds();

    return (
        <div className="flex flex-col md:flex-row gap-8 bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
            {/* Left: Palette */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <h4 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                    <GripHorizontal className="w-5 h-5 text-gray-400" />
                    Available Modules
                </h4>
                <p className="text-sm text-gray-500 mb-2">Drag these items into the layout grid.</p>
                <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 pb-4">
                    {AVAILABLE_MODULES.map(mod => {
                        const isAssigned = assignedIds.has(mod.id);
                        return (
                            <div
                                key={mod.id}
                                draggable={!isAssigned}
                                onDragStart={(e) => handleDragStart(e, mod.id)}
                                className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                                    isAssigned 
                                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" 
                                    : "bg-white border-blue-200 text-blue-900 cursor-grab hover:bg-blue-50 active:cursor-grabbing hover:border-blue-400 shadow-sm"
                                }`}
                            >
                                <span className="font-bold text-sm truncate mr-2">{mod.label}</span>
                                <GripHorizontal className={`w-4 h-4 shrink-0 ${isAssigned ? "opacity-30" : "opacity-50"}`} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right: Layout Canvas */}
            <div className="w-full md:w-2/3 flex flex-col gap-6">
                <h4 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5 text-blue-500" />
                    Layout Canvas
                </h4>
                
                <div className="flex flex-col gap-4 min-h-[300px]">
                    {layout.map((row) => (
                        <div key={row.id} className="relative group bg-white p-3 rounded-xl border-2 border-gray-200 shadow-sm transition-all hover:border-blue-300">
                            <button
                                type="button"
                                onClick={() => handleRemoveRow(row.id)}
                                className="absolute -right-3 -top-3 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded-full p-2 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                                title="Remove Row"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            
                            <div className="flex flex-wrap md:flex-nowrap gap-3">
                                {row.columns.map((col) => {
                                    const modInfo = col.moduleId ? AVAILABLE_MODULES.find(m => m.id === col.moduleId) : null;
                                    
                                    return (
                                        <div
                                            key={col.id}
                                            className={`${col.width} min-w-[200px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[120px] flex flex-col items-center justify-center transition-all hover:bg-slate-100`}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, row.id, col.id)}
                                        >
                                            {modInfo ? (
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, modInfo.id, col.id)}
                                                    className="w-full bg-blue-100 border-2 border-blue-400 text-blue-900 font-bold p-4 rounded-lg flex items-center justify-between cursor-grab shadow-sm animate-in zoom-in duration-200"
                                                >
                                                    <span className="text-sm truncate mr-2">{modInfo.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <GripHorizontal className="w-4 h-4 opacity-50 shrink-0" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveModule(row.id, col.id)}
                                                            className="text-blue-500 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-medium text-sm">Drop Module Here</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {layout.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl">
                            <LayoutTemplate className="w-12 h-12 text-blue-300 mb-4" />
                            <p className="text-blue-500 font-bold text-lg mb-2">Canvas is empty</p>
                            <p className="text-blue-400 text-sm">Add a row using the templates below</p>
                        </div>
                    )}
                </div>

                {/* Add Row Controls */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Row Template
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {TEMPLATES.map(temp => (
                            <button
                                key={temp.id}
                                type="button"
                                onClick={() => handleAddRow(temp.id)}
                                className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 hover:border-black hover:bg-gray-50 transition-all font-bold text-sm shadow-sm flex items-center gap-2"
                            >
                                <span className="opacity-50">[{temp.label}]</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}


"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
    Image as ImageIcon, Film, Music, Upload, Search, X,
    Trash2, Tag, Copy, Check, Grid3X3, List, ExternalLink,
    ChevronRight, Pencil, Info, Square, CheckSquare, MinusSquare,
} from "lucide-react";

export const dynamic = "force-dynamic";

type AssetType = "image" | "video" | "audio";

type Asset = {
    id: string;
    title: string;
    filename: string;
    storage_path: string;
    public_url: string;
    asset_type: AssetType;
    mime_type: string;
    file_size: number;
    tags: string[];
    description: string | null;
    attribution: string | null;
    created_at: string;
};

const BUCKET = "assets";

const TABS: { value: AssetType | "all"; label: string; icon: React.ElementType; accept: string }[] = [
    { value: "all",   label: "All",    icon: Grid3X3,  accept: "image/*,video/*,audio/*" },
    { value: "image", label: "Images", icon: ImageIcon, accept: "image/*" },
    { value: "video", label: "Videos", icon: Film,      accept: "video/*" },
    { value: "audio", label: "Audio",  icon: Music,     accept: "audio/*" },
];

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function assetTypeFromMime(mime: string): AssetType {
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "image";
}

function InlineEdit({ value, placeholder, onSave, multiline = false, className = "" }: {
    value: string | null; placeholder: string; onSave: (v: string) => void;
    multiline?: boolean; className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value ?? "");
    function commit() { setEditing(false); if (val !== (value ?? "")) onSave(val); }
    if (!editing) return (
        <span className={`cursor-pointer group/ie flex items-start gap-1 ${className}`} onClick={() => setEditing(true)}>
            <span className={value ? "" : "text-gray-400 italic"}>{value || placeholder}</span>
            <Pencil className="w-3 h-3 text-gray-300 group-hover/ie:text-gray-500 shrink-0 mt-0.5 transition-colors" />
        </span>
    );
    const cls = "w-full border border-black rounded px-1.5 py-0.5 text-sm focus:outline-none bg-white";
    return multiline
        ? <textarea autoFocus className={cls + " resize-none"} rows={3} value={val}
            onChange={e => setVal(e.target.value)} onBlur={commit} />
        : <input autoFocus className={cls} value={val} onChange={e => setVal(e.target.value)}
            onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()} />;
}

function AssetDetailPanel({ asset, onClose, onUpdate, onDelete }: {
    asset: Asset; onClose: () => void;
    onUpdate: (patch: Partial<Asset>) => void; onDelete: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const labelCls = "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1";

    function copyUrl() {
        navigator.clipboard.writeText(asset.public_url);
        setCopied(true); setTimeout(() => setCopied(false), 1800);
    }
    function addTag(e: React.KeyboardEvent) {
        if (e.key !== "Enter" && e.key !== ",") return;
        e.preventDefault();
        const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (tag && !asset.tags.includes(tag)) onUpdate({ tags: [...asset.tags, tag] });
        setTagInput("");
    }

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white border-l border-gray-200 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 sticky top-0 z-10">
                <h3 className="font-black text-sm truncate pr-4">{asset.title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-100 border-b border-gray-200 flex items-center justify-center" style={{ minHeight: 200 }}>
                {asset.asset_type === "image" && <img src={asset.public_url} alt={asset.title} className="max-h-64 w-full object-contain" />}
                {asset.asset_type === "video" && <video src={asset.public_url} controls className="max-h-64 w-full" />}
                {asset.asset_type === "audio" && <div className="p-6 w-full"><Music className="w-10 h-10 text-gray-300 mx-auto mb-3" /><audio src={asset.public_url} controls className="w-full" /></div>}
            </div>
            <div className="p-5 flex flex-col gap-5 flex-1">
                <div><p className={labelCls}>Title</p>
                    <InlineEdit value={asset.title} placeholder="Add a title..." onSave={v => onUpdate({ title: v || asset.filename })} className="text-sm font-semibold" /></div>
                <div><p className={labelCls}>Description / Caption</p>
                    <InlineEdit value={asset.description} placeholder="Add a description or caption..." onSave={v => onUpdate({ description: v || null })} multiline className="text-sm text-gray-600" /></div>
                <div><p className={labelCls}>Attribution / Credit</p>
                    <InlineEdit value={asset.attribution} placeholder="e.g. Photo by Jane Doe / Unsplash" onSave={v => onUpdate({ attribution: v || null })} className="text-sm text-gray-600" /></div>
                <div>
                    <p className={labelCls}>Tags</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {asset.tags.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                                {t}<button onClick={() => onUpdate({ tags: asset.tags.filter(x => x !== t) })} className="text-gray-400 hover:text-red-500">x</button>
                            </span>
                        ))}
                    </div>
                    <input className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                        placeholder="Add tag, press Enter or comma" value={tagInput}
                        onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />
                </div>
                <div className="pt-3 border-t border-gray-100">
                    <p className={labelCls}>File info</p>
                    <div className="text-xs text-gray-500 space-y-1">
                        <p className="truncate"><span className="text-gray-400">Name:</span> {asset.filename}</p>
                        <p><span className="text-gray-400">Type:</span> {asset.mime_type}</p>
                        <p><span className="text-gray-400">Size:</span> {formatBytes(asset.file_size)}</p>
                        <p><span className="text-gray-400">Added:</span> {new Date(asset.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div>
                    <p className={labelCls}>Public URL</p>
                    <div className="flex gap-2">
                        <input readOnly value={asset.public_url} className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-500 truncate" />
                        <button onClick={copyUrl} className="shrink-0 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-800 flex items-center gap-1.5">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                </div>
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex gap-2 sticky bottom-0">
                <a href={asset.public_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold border-2 border-gray-200 rounded-xl hover:bg-gray-100">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
                <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
            </div>
        </div>
    );
}

function Checkbox({ checked, indeterminate, onChange, className = "" }: {
    checked: boolean; indeterminate?: boolean; onChange: (e: React.MouseEvent) => void; className?: string;
}) {
    const Icon = indeterminate ? MinusSquare : checked ? CheckSquare : Square;
    return (
        <span
            onClick={onChange}
            className={`cursor-pointer transition-colors ${checked || indeterminate ? "text-black" : "text-gray-500 hover:text-gray-800"} ${className}`}
        >
            <Icon className="w-4 h-4" />
        </span>
    );
}

function AssetThumb({ asset, viewMode, onClick, isSelected, checked, onCheck }: {
    asset: Asset; viewMode: "grid" | "list"; onClick: () => void; isSelected: boolean;
    checked: boolean; onCheck: (e: React.MouseEvent) => void;
}) {
    if (viewMode === "list") return (
        <div
            className={`flex items-center gap-3 p-3 bg-white border rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group ${checked ? "border-black bg-blue-50/30" : isSelected ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-200"}`}>
            <Checkbox checked={checked} onChange={e => { e.stopPropagation(); onCheck(e); }} className="shrink-0" />
            <div onClick={onClick} className="flex flex-1 items-center gap-4 cursor-pointer min-w-0">
            <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                {asset.asset_type === "image" ? <img src={asset.public_url} alt={asset.title} className="w-full h-full object-cover" />
                    : asset.asset_type === "video" ? <Film className="w-5 h-5 text-gray-400" />
                    : <Music className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{asset.title}</p>
                {asset.description && <p className="text-xs text-gray-500 truncate">{asset.description}</p>}
                {asset.attribution && <p className="text-[10px] text-gray-400 truncate italic">{asset.attribution}</p>}
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{formatBytes(asset.file_size)}</span>
                    {asset.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-medium text-gray-500">{t}</span>)}
                </div>
            </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
            </div>
        </div>
    );

    return (
        <div className={`group relative bg-white border rounded-2xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all ${checked ? "border-black ring-2 ring-black ring-offset-1 bg-blue-50/20" : isSelected ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-200"}`}>
            {/* Checkbox — top-left, visible on hover or when checked */}
            <div className={`absolute top-2 left-2 z-10 transition-opacity ${checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <Checkbox checked={checked} onChange={e => { e.stopPropagation(); onCheck(e); }}
                    className="bg-white/90 rounded p-0.5 shadow-sm" />
            </div>
            <div onClick={onClick} className="cursor-pointer">
            <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                {asset.asset_type === "image" ? <img src={asset.public_url} alt={asset.title} className="w-full h-full object-cover" />
                    : asset.asset_type === "video" ? <div className="flex flex-col items-center gap-1 text-gray-300"><Film className="w-8 h-8" /><span className="text-[10px] font-medium text-gray-400">Video</span></div>
                    : <div className="flex flex-col items-center gap-1 text-gray-300"><Music className="w-8 h-8" /><span className="text-[10px] font-medium text-gray-400">Audio</span></div>}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                <div className="absolute top-2 right-2 flex gap-1">
                    {asset.description && <span className="w-4 h-4 rounded-full bg-blue-500/80 flex items-center justify-center"><Info className="w-2.5 h-2.5 text-white" /></span>}
                    {asset.attribution && <span className="w-4 h-4 rounded-full bg-amber-500/80 flex items-center justify-center text-white text-[8px] font-black">c</span>}
                </div>
            </div>
            <div className="p-2.5">
                <p className="text-xs font-bold truncate">{asset.title}</p>
                {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {asset.tags.slice(0, 3).map(t => <span key={t} className="px-1 py-0.5 bg-gray-100 rounded text-[9px] text-gray-500">{t}</span>)}
                        {asset.tags.length > 3 && <span className="text-[9px] text-gray-400">+{asset.tags.length - 3}</span>}
                    </div>
                )}
            </div>
            </div>{/* end click wrapper */}
        </div>
    );
}

function UploadZone({ accept, onUploaded }: { accept: string; onUploaded: (asset: Asset) => void }) {
    const [dragging, setDragging] = useState(false);
    const [uploads, setUploads] = useState<{ name: string; status: "uploading" | "done" | "error"; msg?: string }[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    async function uploadFiles(files: FileList | File[]) {
        const arr = Array.from(files);
        if (!arr.length) return;
        setUploads(arr.map(f => ({ name: f.name, status: "uploading" as const })));
        for (let i = 0; i < arr.length; i++) {
            const file = arr[i];
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(safeName, file, { contentType: file.type, upsert: false });
            if (upErr) { setUploads(p => p.map((u, j) => j === i ? { ...u, status: "error" as const, msg: upErr.message } : u)); continue; }
            const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(safeName);
            const { data: row } = await supabase.from("assets").insert({
                title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
                filename: file.name, storage_path: safeName, public_url: publicUrl,
                asset_type: assetTypeFromMime(file.type), mime_type: file.type,
                file_size: file.size, tags: [], description: null, attribution: null,
            }).select().single();
            if (row) { onUploaded(row as Asset); setUploads(p => p.map((u, j) => j === i ? { ...u, status: "done" as const } : u)); }
            else setUploads(p => p.map((u, j) => j === i ? { ...u, status: "error" as const, msg: "DB error" } : u));
        }
        setTimeout(() => setUploads([]), 2500);
    }

    return (
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
            className={`border-2 border-dashed rounded-2xl transition-all ${dragging ? "border-black bg-yellow-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"}`}>
            <input ref={fileRef} type="file" multiple accept={accept} className="hidden"
                onChange={e => e.target.files && uploadFiles(e.target.files)} />
            {uploads.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 cursor-pointer" onClick={() => fileRef.current?.click()}>
                    <Upload className={`w-8 h-8 ${dragging ? "text-black" : "text-gray-400"}`} />
                    <div className="text-center">
                        <p className="font-bold text-sm text-gray-700">Drop files here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-0.5">Multiple files supported</p>
                    </div>
                </div>
            ) : (
                <div className="p-4 space-y-1.5">
                    {uploads.map((u, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={u.status === "uploading" ? "animate-spin" : u.status === "done" ? "text-green-500" : "text-red-500"}>
                                {u.status === "uploading" ? "\u23f3" : u.status === "done" ? "\u2705" : "\u274c"}
                            </span>
                            <span className="truncate font-medium text-gray-700">{u.name}</span>
                            {u.msg && <span className="text-red-500 shrink-0">{u.msg}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function RepositoryPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<AssetType | "all">("image");
    const [search, setSearch] = useState("");
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [showUpload, setShowUpload] = useState(false);
    const [selected, setSelected] = useState<Asset | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [bulkTagInput, setBulkTagInput] = useState("");
    const [bulkTagMode, setBulkTagMode] = useState<"add" | "remove" | null>(null);
    const supabase = createClient();

    useEffect(() => {
        supabase.from("assets").select("*").order("created_at", { ascending: false })
            .then(({ data }) => { setAssets((data as Asset[]) ?? []); setLoading(false); });
    }, []);

    const counts = {
        all: assets.length,
        image: assets.filter(a => a.asset_type === "image").length,
        video: assets.filter(a => a.asset_type === "video").length,
        audio: assets.filter(a => a.asset_type === "audio").length,
    };

    const tabAssets = activeTab === "all" ? assets : assets.filter(a => a.asset_type === activeTab);
    const allTags = Array.from(new Set(tabAssets.flatMap(a => a.tags))).sort();

    const filtered = tabAssets.filter(a => {
        if (tagFilter && !a.tags.includes(tagFilter)) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.filename.toLowerCase().includes(q) ||
            (a.description ?? "").toLowerCase().includes(q) ||
            (a.attribution ?? "").toLowerCase().includes(q) ||
            a.tags.some(t => t.includes(q));
    });

    async function handleUpdate(id: string, patch: Partial<Asset>) {
        await supabase.from("assets").update(patch).eq("id", id);
        setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
        setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    }

    async function handleDelete(asset: Asset) {
        if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return;
        await supabase.storage.from(BUCKET).remove([asset.storage_path]);
        await supabase.from("assets").delete().eq("id", asset.id);
        setAssets(prev => prev.filter(a => a.id !== asset.id));
        if (selected?.id === asset.id) setSelected(null);
    }

    // ── Bulk helpers ─────────────────────────────────────────────────────────
    function toggleCheck(id: string) {
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    const allFilteredChecked = filtered.length > 0 && filtered.every(a => checkedIds.has(a.id));
    const someFilteredChecked = filtered.some(a => checkedIds.has(a.id));

    function toggleSelectAll() {
        if (allFilteredChecked) {
            // Deselect all filtered
            setCheckedIds(prev => {
                const next = new Set(prev);
                filtered.forEach(a => next.delete(a.id));
                return next;
            });
        } else {
            // Select all filtered
            setCheckedIds(prev => {
                const next = new Set(prev);
                filtered.forEach(a => next.add(a.id));
                return next;
            });
        }
    }

    async function bulkAddTag(tag: string) {
        const clean = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!clean) return;
        const targets = assets.filter(a => checkedIds.has(a.id));
        for (const a of targets) {
            if (!a.tags.includes(clean)) {
                await handleUpdate(a.id, { tags: [...a.tags, clean] });
            }
        }
        setBulkTagInput("");
        setBulkTagMode(null);
    }

    async function bulkRemoveTag(tag: string) {
        const clean = tag.trim().toLowerCase();
        if (!clean) return;
        const targets = assets.filter(a => checkedIds.has(a.id));
        for (const a of targets) {
            if (a.tags.includes(clean)) {
                await handleUpdate(a.id, { tags: a.tags.filter(t => t !== clean) });
            }
        }
        setBulkTagInput("");
        setBulkTagMode(null);
    }

    async function bulkDelete() {
        const targets = assets.filter(a => checkedIds.has(a.id));
        if (!confirm(`Delete ${targets.length} asset${targets.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
        for (const a of targets) {
            await supabase.storage.from(BUCKET).remove([a.storage_path]);
            await supabase.from("assets").delete().eq("id", a.id);
        }
        const deletedIds = new Set(targets.map(a => a.id));
        setAssets(prev => prev.filter(a => !deletedIds.has(a.id)));
        setCheckedIds(new Set());
        if (selected && deletedIds.has(selected.id)) setSelected(null);
    }

    const currentTab = TABS.find(t => t.value === activeTab)!;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Asset Repository</h1>
                    <p className="text-gray-400 text-sm mt-0.5">{assets.length} asset{assets.length !== 1 ? "s" : ""} total</p>
                </div>
                <button onClick={() => setShowUpload(v => !v)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${showUpload ? "bg-white text-gray-700 border-gray-300" : "bg-black text-white border-black hover:bg-gray-800"}`}>
                    <Upload className="w-4 h-4" />{showUpload ? "Hide Upload" : "Upload Files"}
                </button>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-8">
                <div className="flex">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.value;
                        return (
                            <button key={tab.value} onClick={() => { setActiveTab(tab.value); setTagFilter(null); }}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${isActive ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}>
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive ? "bg-black text-white" : "bg-gray-100 text-gray-500"}`}>{counts[tab.value]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 flex">
                <div className={`flex-1 flex flex-col min-w-0 ${selected ? "mr-96" : ""}`}>
                    {showUpload && (
                        <div className="px-8 pt-6">
                            <UploadZone accept={currentTab.accept} onUploaded={asset => {
                                setAssets(prev => [asset, ...prev]);
                                if (activeTab !== "all" && asset.asset_type !== activeTab) setActiveTab(asset.asset_type);
                            }} />
                        </div>
                    )}

                    {/* Bulk action bar — slides in when items checked */}
                    {someFilteredChecked && (
                        <div className="px-8 py-2.5 bg-black text-white flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold shrink-0">{checkedIds.size} selected</span>
                            <div className="w-px h-4 bg-white/20 shrink-0" />

                            {/* Add tag */}
                            {bulkTagMode === "add" ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        className="px-2.5 py-1 text-xs rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:border-white w-36"
                                        placeholder="tag name, Enter"
                                        value={bulkTagInput}
                                        onChange={e => setBulkTagInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") bulkAddTag(bulkTagInput); if (e.key === "Escape") setBulkTagMode(null); }}
                                    />
                                    <button onClick={() => bulkAddTag(bulkTagInput)}
                                        className="px-2.5 py-1 text-xs font-bold bg-white text-black rounded-lg hover:bg-gray-100">Add</button>
                                    <button onClick={() => { setBulkTagMode(null); setBulkTagInput(""); }}
                                        className="text-white/60 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ) : bulkTagMode === "remove" ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        className="px-2.5 py-1 text-xs rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:border-white w-36"
                                        placeholder="tag to remove, Enter"
                                        value={bulkTagInput}
                                        onChange={e => setBulkTagInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") bulkRemoveTag(bulkTagInput); if (e.key === "Escape") setBulkTagMode(null); }}
                                    />
                                    <button onClick={() => bulkRemoveTag(bulkTagInput)}
                                        className="px-2.5 py-1 text-xs font-bold bg-white text-black rounded-lg hover:bg-gray-100">Remove</button>
                                    <button onClick={() => { setBulkTagMode(null); setBulkTagInput(""); }}
                                        className="text-white/60 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => setBulkTagMode("add")}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                                        <Tag className="w-3.5 h-3.5" /> Add Tag
                                    </button>
                                    <button onClick={() => setBulkTagMode("remove")}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                                        <Tag className="w-3.5 h-3.5" /> Remove Tag
                                    </button>
                                    <button onClick={bulkDelete}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </>
                            )}

                            <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-white/60 hover:text-white text-xs underline shrink-0">
                                Clear selection
                            </button>
                        </div>
                    )}

                    {/* Filters bar */}
                    <div className="px-8 py-4 flex flex-wrap items-center gap-3">
                        {/* Global checkbox */}
                        <Checkbox
                            checked={allFilteredChecked}
                            indeterminate={!allFilteredChecked && someFilteredChecked}
                            onChange={e => { e.stopPropagation(); toggleSelectAll(); }}
                            className="shrink-0"
                        />
                        <span className="text-xs text-gray-400 mr-1">
                            {someFilteredChecked ? `${checkedIds.size} selected` : "Select all"}
                        </span>
                        <div className="w-px h-4 bg-gray-200 shrink-0" />

                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-black bg-white"
                                placeholder={`Search ${activeTab === "all" ? "all assets" : activeTab + "s"}\u2026`}
                                value={search} onChange={e => setSearch(e.target.value)} />
                            {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><X className="w-3.5 h-3.5" /></button>}
                        </div>
                        {allTags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                {allTags.map(tag => (
                                    <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${tagFilter === tag ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="ml-auto flex rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <button onClick={() => setViewMode("grid")} className={`p-2 transition-colors ${viewMode === "grid" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}><Grid3X3 className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}><List className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-8 pb-8">
                        {loading ? (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading\u2026</div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                                <div className="text-4xl opacity-30">{activeTab === "image" ? "\uD83D\uDDBC\uFE0F" : activeTab === "video" ? "\uD83C\uDFAC" : activeTab === "audio" ? "\uD83C\uDFB5" : "\uD83D\uDDC2\uFE0F"}</div>
                                <p className="text-sm font-medium">{search || tagFilter ? "No assets match your filters" : `No ${activeTab === "all" ? "" : activeTab + " "}assets yet`}</p>
                                {(search || tagFilter) && <button onClick={() => { setSearch(""); setTagFilter(null); }} className="text-xs underline text-gray-500 hover:text-black">Clear filters</button>}
                                {!search && !tagFilter && <button onClick={() => setShowUpload(true)} className="text-xs underline text-black">Upload your first {activeTab === "all" ? "asset" : activeTab}</button>}
                            </div>
                        ) : viewMode === "grid" ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filtered.map(a => <AssetThumb key={a.id} asset={a} viewMode="grid" isSelected={selected?.id === a.id} checked={checkedIds.has(a.id)} onCheck={e => { e.stopPropagation(); toggleCheck(a.id); }} onClick={() => setSelected(selected?.id === a.id ? null : a)} />)}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filtered.map(a => <AssetThumb key={a.id} asset={a} viewMode="list" isSelected={selected?.id === a.id} checked={checkedIds.has(a.id)} onCheck={e => { e.stopPropagation(); toggleCheck(a.id); }} onClick={() => setSelected(selected?.id === a.id ? null : a)} />)}
                            </div>
                        )}
                        {!loading && filtered.length > 0 && (
                            <p className="text-xs text-gray-400 text-center mt-6">{filtered.length} of {tabAssets.length} {activeTab === "all" ? "assets" : activeTab + "s"}</p>
                        )}
                    </div>
                </div>

                {selected && (
                    <AssetDetailPanel asset={selected} onClose={() => setSelected(null)}
                        onUpdate={patch => handleUpdate(selected.id, patch)}
                        onDelete={() => handleDelete(selected)} />
                )}
            </div>
        </div>
    );
}

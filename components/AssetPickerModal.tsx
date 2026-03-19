"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import { Search, Upload, X, Image as ImageIcon, Check } from "lucide-react";

const BUCKET = "assets";

type Asset = {
    id: string;
    title: string;
    filename: string;
    storage_path: string;
    public_url: string;
    asset_type: "image" | "video" | "audio";
    mime_type: string;
    file_size: number;
    tags: string[];
};

export default function AssetPickerModal({
    onSelect,
    onClose,
    typeFilter = "image",
    defaultTag,
}: {
    onSelect: (url: string) => void;
    onClose: () => void;
    typeFilter?: "image" | "video" | "audio" | "all";
    defaultTag?: string;
}) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState(defaultTag ?? "");
    const [selected, setSelected] = useState<string | null>(null);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    async function load() {
        setLoading(true);
        let query = supabase.from("assets").select("*").order("created_at", { ascending: false });
        if (typeFilter !== "all") query = query.eq("asset_type", typeFilter);
        const { data, error: dbErr } = await query;
        if (dbErr) setError("Could not load assets: " + dbErr.message);
        else setAssets((data ?? []) as Asset[]);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError("");

        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(safeName, file, { contentType: file.type, upsert: false });

        if (upErr) { setError("Upload failed: " + upErr.message); setUploading(false); return; }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(safeName);

        const assetType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "audio";

        const { data: row, error: dbErr } = await supabase.from("assets").insert({
            title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
            filename: file.name,
            storage_path: safeName,
            public_url: publicUrl,
            asset_type: assetType,
            mime_type: file.type,
            file_size: file.size,
            tags: [],
        }).select().single();

        if (dbErr || !row) { setError("DB error saving asset"); }
        else { setAssets(prev => [row as Asset, ...prev]); }

        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
    }

    const filtered = assets.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) ||
            a.filename.toLowerCase().includes(q) ||
            a.tags.some(t => t.includes(q));
    });

    function handleSelect(asset: Asset) {
        setSelected(asset.id);
        setTimeout(() => { onSelect(asset.public_url); onClose(); }, 180);
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                    <div>
                        <h3 className="font-black text-lg">\uD83D\uDDC2\uFE0F Asset Repository</h3>
                        {(typeFilter !== "all" || defaultTag) && <p className="text-xs text-gray-400">{[typeFilter !== "all" && `${typeFilter}s`, defaultTag && `#${defaultTag}`].filter(Boolean).join(" · ")}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-black font-bold text-xl leading-none">\u2715</button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 px-6 py-3 border-b bg-gray-50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                            placeholder="Search by name or tag..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><X className="w-3 h-3" /></button>}
                    </div>
                    <label className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all border-2 shrink-0 ${
                        uploading ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-black text-white border-black hover:bg-gray-800"
                    }`}>
                        {uploading ? "Uploading\u2026" : <><Upload className="w-3.5 h-3.5" /> Upload New</>}
                        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>

                {/* Error */}
                {error && <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading\u2026</div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                            <ImageIcon className="w-8 h-8 opacity-40" />
                            <p className="text-sm">{search ? "No assets match your search" : "No assets yet \u2014 upload one above"}</p>
                            <a href="/admin/repository" target="_blank" className="text-xs text-black underline">Open Repository \u2192</a>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {filtered.map(asset => (
                                <button
                                    key={asset.id}
                                    type="button"
                                    onClick={() => handleSelect(asset)}
                                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-gray-100 shadow-sm hover:shadow-md ${
                                        selected === asset.id ? "border-black scale-95" : "border-transparent hover:border-black"
                                    }`}
                                    title={asset.title}
                                >
                                    {asset.asset_type === "image" ? (
                                        <img src={asset.public_url} alt={asset.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">
                                            {asset.asset_type}
                                        </div>
                                    )}
                                    {selected === asset.id && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Check className="w-6 h-6 text-white" />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-black/0 group-hover:bg-black/50 transition-all">
                                        <p className="w-full px-2 py-1 text-[9px] font-bold text-white truncate opacity-0 group-hover:opacity-100">
                                            {asset.title}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        {!loading && `${filtered.length} asset${filtered.length !== 1 ? "s" : ""}${search ? " matching" : ""}`}
                    </p>
                    <a href="/admin/repository" target="_blank" className="text-xs text-gray-500 hover:text-black underline">
                        Manage all assets \u2192
                    </a>
                </div>
            </div>
        </div>
    );
}

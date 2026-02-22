"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STAGE_NAMES, LEVEL_LETTERS } from "@/lib/formatters";
import RichTextEditor from "@/components/RichTextEditor";
import { bulkCreatePolls } from "@/app/admin/poll-actions";

export default function BulkImportPage() {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [resultCount, setResultCount] = useState<number | null>(null);

    const [pollType, setPollType] = useState("isit_text");
    const [stage, setStage] = useState(1);
    const [level, setLevel] = useState(1);
    const [instructions, setInstructions] = useState("");
    const [bulkData, setBulkData] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");
        setResultCount(null);

        try {
            const formData = new FormData();
            formData.set('type', pollType);
            formData.set('stage', stage.toString());
            formData.set('level', level.toString());
            formData.set('instructions', instructions);
            formData.set('bulk_data', bulkData);

            const result = await bulkCreatePolls(formData);

            if (result.success) {
                setMsg("Bulk import successful! ✅");
                setResultCount(result.count);
                setBulkData(""); // Clear input on success
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err: any) {
            setMsg("Error: " + err.message + " ❌");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 mb-12">
            <Link href="/admin/polls" className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 font-bold w-fit">
                <ArrowLeft size={20} />
                Back to Polls
            </Link>

            <h1 className="text-4xl font-black mb-2">Bulk Add Polls</h1>
            <p className="text-gray-500 mb-8">Quickly generate multiple polls by pasting pairs of words.</p>

            {msg && (
                <div className={`p-4 rounded-xl font-bold text-center mb-8 border-2 ${msg.includes("Error") ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                    {msg}
                    {resultCount !== null && <div className="text-sm font-medium mt-1">Successfully created {resultCount} polls.</div>}
                </div>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Poll Type</label>
                            <select
                                value={pollType}
                                onChange={(e) => setPollType(e.target.value)}
                                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-black transition-all outline-none font-bold appearance-none"
                            >
                                <option value="isit_text">ISIT Text (Standard)</option>
                                <option value="isit_text_plus">ISIT Text Plus (Consensus)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Target Stage</label>
                            <select
                                value={stage}
                                onChange={(e) => setStage(parseInt(e.target.value))}
                                className="border-2 border-black p-4 rounded-xl bg-white font-bold"
                            >
                                <option value="0">Zero</option>
                                {STAGE_NAMES.map((name, i) => (
                                    <option key={i} value={i + 1}>{name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Target Level</label>
                            <select
                                value={level}
                                onChange={(e) => setLevel(parseInt(e.target.value))}
                                className="border-2 border-black p-4 rounded-xl bg-white font-bold"
                            >
                                {LEVEL_LETTERS.map((char, i) => (
                                    <option key={i} value={i + 1}>{char}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="font-bold">Global Instructions (Applies to all generated polls)</label>
                        <RichTextEditor
                            value={instructions}
                            onChange={setInstructions}
                            placeholder="e.g. Determine the correct association for these concepts."
                            heightClass="h-24"
                        />
                    </div>

                    <div className="flex flex-col gap-2 mt-4">
                        <div className="flex items-center justify-between mb-1">
                            <label className="font-bold">Bulk Poll Data</label>
                            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">Format: word1 | word2</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Paste one poll per line. Use the pipe character <code>|</code> to separate the left and right words.</p>
                        <textarea
                            value={bulkData}
                            onChange={(e) => setBulkData(e.target.value)}
                            required
                            placeholder={`capitalism | socialism\neast | west\norder | chaos`}
                            className="w-full h-64 p-4 font-mono text-sm border-2 border-black rounded-xl focus:ring-4 focus:ring-black/5 outline-none resize-y"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !bulkData.trim()}
                        className="bg-black text-white py-4 rounded-full font-bold hover:scale-105 transition-transform shadow-lg disabled:opacity-50 mt-4 text-lg"
                    >
                        {loading ? "Generating Polls..." : "Generate Bulk Polls"}
                    </button>
                </form>
            </div>
        </div>
    );
}

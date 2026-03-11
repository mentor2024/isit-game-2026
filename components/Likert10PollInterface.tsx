"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { castLikertVote } from "@/app/(main)/poll/actions";

export default function Likert10PollInterface({
    poll,
    userId,
    nextPollId,
    currentStageScore = 0
}: {
    poll: any;
    userId: string;
    nextPollId?: string;
    currentStageScore?: number;
}) {
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const router = useRouter();

    // 10-Point Likert scale options
    const likertOptions = [
        { value: 1, color: "bg-red-600", activeColor: "ring-red-600 bg-red-50" },
        { value: 2, color: "bg-red-500", activeColor: "ring-red-500 bg-red-50" },
        { value: 3, color: "bg-orange-500", activeColor: "ring-orange-500 bg-orange-50" },
        { value: 4, color: "bg-orange-400", activeColor: "ring-orange-400 bg-orange-50" },
        { value: 5, color: "bg-amber-400", activeColor: "ring-amber-400 bg-amber-50" },
        { value: 6, color: "bg-lime-400", activeColor: "ring-lime-400 bg-lime-50" },
        { value: 7, color: "bg-green-400", activeColor: "ring-green-400 bg-green-50" },
        { value: 8, color: "bg-green-500", activeColor: "ring-green-500 bg-green-50" },
        { value: 9, color: "bg-emerald-500", activeColor: "ring-emerald-500 bg-emerald-50" },
        { value: 10, color: "bg-emerald-600", activeColor: "ring-emerald-600 bg-emerald-50" },
    ];

    const targetObject = poll.poll_objects?.[0]; // Likert only has one object

    if (!targetObject) {
        return <div className="p-8 text-center text-red-500 font-bold">Error: Poll has no objects defined.</div>;
    }

    const handleSubmit = async () => {
        if (!rating) return;
        setIsSubmitting(true);
        setPageError(null);

        try {
            const result = await castLikertVote(poll.id, targetObject.id, rating);

            if (!result.success) throw new Error(result.error || "Submission failed");

            // Standard poll level up handling
            if (result.levelUp) {
                await new Promise(r => setTimeout(r, 800)); // Brief pause for visual feedback

                if (!result.showInterstitial || result.stage === 0) {
                    window.location.href = '/poll';
                } else {
                    window.location.href = `/levelup?stage=${result.stage}&level=${result.level}&bonus=${result.bonus || 0}&dq=${result.dq || 0}&correct=${result.correctPolls || 0}&total=${result.totalPolls || 0}&points=${result.points || 0}`;
                }
                return;
            }

            // Immediately fetch next poll
            router.refresh();

            // Reset state in case we are in Preview Mode and the component doesn't unmount
            setRating(null);

        } catch (error: any) {
            console.error("Failed to cast Likert vote:", error);
            setPageError(error.message || "An unknown error occurred while voting.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative pb-24 md:pb-0">
            {/* Header / Score Area */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="text-gray-500 font-bold text-sm tracking-widest uppercase">
                    Stage Score: <span className="text-black">{currentStageScore}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col p-6 md:p-12 max-w-4xl mx-auto w-full">

                {/* Object Display Area */}
                <div className="w-full flex flex-col items-center justify-center mb-12 bg-gray-50 rounded-3xl p-8 border-2 border-gray-100 overflow-hidden relative">
                    {targetObject.image_url && (
                        <div className="w-full flex items-center justify-center mb-6">
                            {targetObject.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video
                                    src={targetObject.image_url}
                                    controls
                                    className="max-w-full max-h-[300px] rounded-xl shadow-sm border border-gray-200"
                                />
                            ) : targetObject.image_url.match(/\.(mp3|wav|ogg)$/i) ? (
                                <audio
                                    src={targetObject.image_url}
                                    controls
                                    className="w-full max-w-md mt-4"
                                />
                            ) : (
                                <img
                                    src={targetObject.image_url}
                                    alt={targetObject.text || "Poll Object"}
                                    className="max-w-full max-h-[300px] object-contain rounded-xl shadow-sm border border-gray-200"
                                />
                            )}
                        </div>
                    )}

                    {targetObject.text && (
                        <h2 className="text-3xl md:text-5xl font-black text-center leading-tight tracking-tight text-gray-900">
                            {targetObject.text}
                        </h2>
                    )}
                </div>

                {/* Likert Scale Area */}
                <div className="w-full flex flex-col items-center justify-center mb-8">

                    {/* Anchors labels above the grid */}
                    <div className="w-full max-w-[600px] flex justify-between px-2 mb-4">
                        <span className="text-red-600 font-bold text-sm md:text-base">Highly ITistic (1)</span>
                        <span className="text-emerald-600 font-bold text-sm md:text-base">Highly ISish (10)</span>
                    </div>

                    <div className="w-full max-w-[600px] grid grid-cols-5 md:grid-cols-10 gap-2 md:gap-3">
                        {likertOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setRating(option.value)}
                                className={`relative aspect-square w-full rounded-2xl flex items-center justify-center text-2xl font-black border-4 transition-all duration-200 ease-out focus:outline-none ${rating === option.value
                                    ? `${option.color} text-white border-white scale-110 shadow-lg z-10`
                                    : `bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600 hover:scale-105 shadow-sm`
                                    }`}
                            >
                                {option.value}
                            </button>
                        ))}
                    </div>

                </div>

                {pageError && (
                    <div className="w-full max-w-3xl mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-center font-bold">
                        Error: {pageError}
                    </div>
                )}

                {/* Fixed Bottom Submit Button Area (Mobile) / Regular below content (Desktop) */}
                <div className="fixed bottom-0 left-0 w-full p-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 md:static md:bg-transparent md:border-none md:p-0 mt-auto flex justify-center z-50">
                    <button
                        onClick={handleSubmit}
                        disabled={!rating || isSubmitting}
                        className={`w-full max-w-sm py-4 rounded-full font-black text-xl transition-all duration-300 ${!rating
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed hidden md:block'
                            : isSubmitting
                                ? 'bg-gray-400 text-white cursor-wait scale-[0.98]'
                                : 'bg-black text-white hover:scale-105 shadow-xl hover:shadow-2xl translate-y-0 hover:-translate-y-1'
                            }`}
                        // Use inline style to enforce black background effectively
                        style={{ backgroundColor: rating ? '#000' : undefined }}
                    >
                        {isSubmitting ? 'Voting...' : 'Vote'}
                    </button>
                </div>
            </div>
        </div>
    );
}

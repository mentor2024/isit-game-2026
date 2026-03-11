"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { castLikertVote } from "@/app/(main)/poll/actions";
import { ChevronRight } from "lucide-react";

export default function LikertPollInterface({
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

    // Likert scale options
    const likertOptions = [
        { value: 1, label: "Highly ITistic", color: "bg-red-500", hoverColor: "hover:bg-red-600", activeColor: "ring-red-500 bg-red-50" },
        { value: 2, label: "Somewhat ITistic", color: "bg-orange-400", hoverColor: "hover:bg-orange-500", activeColor: "ring-orange-400 bg-orange-50" },
        { value: 3, label: "Balanced", color: "bg-gray-400", hoverColor: "hover:bg-gray-500", activeColor: "ring-gray-400 bg-gray-50" },
        { value: 4, label: "Somewhat ISish", color: "bg-green-400", hoverColor: "hover:bg-green-500", activeColor: "ring-green-400 bg-green-50" },
        { value: 5, label: "Highly ISish", color: "bg-emerald-600", hoverColor: "hover:bg-emerald-700", activeColor: "ring-emerald-600 bg-emerald-50" },
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
                <div className="w-full flex justify-center mb-8">
                    <div className="w-full max-w-3xl">

                        {/* Mobile Stacked View */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {likertOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setRating(option.value)}
                                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-lg border-2 transition-all ${rating === option.value
                                        ? `${option.activeColor} ring-2 ring-offset-2 ${option.color.replace('bg-', 'ring-')} border-transparent shadow-md transform scale-[1.02]`
                                        : `bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50`
                                        }`}
                                >
                                    <span>{option.label}</span>
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-white ${rating === option.value ? option.color : 'bg-gray-200 text-gray-500'
                                        }`}>
                                        {option.value}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Desktop Horizontal View */}
                        <div className="hidden md:flex flex-col">
                            {/* Numbered Row */}
                            <div className="flex justify-between relative mb-8">
                                {/* Connecting Line */}
                                <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>

                                {likertOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setRating(option.value)}
                                        className={`relative w-16 h-16 rounded-full flex items-center justify-center text-xl font-black border-4 transition-all duration-300 ease-out focus:outline-none ${rating === option.value
                                            ? `${option.color} text-white border-white scale-110 shadow-[0_0_0_4px_rgba(0,0,0,0.1)] z-10`
                                            : `bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600 hover:scale-105 hover:bg-gray-50`
                                            }`}
                                    >
                                        {option.value}
                                    </button>
                                ))}
                            </div>

                            {/* Labels Row */}
                            <div className="flex justify-between px-2">
                                {likertOptions.map((option) => (
                                    <div
                                        key={`label-${option.value}`}
                                        className={`text-center w-24 -ml-4 -mr-4 text-sm font-bold leading-tight transition-colors duration-300 ${rating === option.value ? option.color.replace('bg-', 'text-') : 'text-gray-400'
                                            }`}
                                    >
                                        {option.label}
                                    </div>
                                ))}
                            </div>
                        </div>
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

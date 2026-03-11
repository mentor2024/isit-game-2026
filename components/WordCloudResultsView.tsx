"use client";

import React, { useMemo } from 'react';
import { ArrowRight, Trophy, BarChart3, Cloud, TrendingUp } from 'lucide-react';

export type WordCloudResultsProps = {
    pollId: string;
    pointsEarned: number;
    globalTop5: { id: string; word: string; weight: number }[];
    metrics: { aq: number; overallDq: number; rawScore: number };
    onContinue: () => void;
};

export default function WordCloudResultsView({
    pollId,
    pointsEarned,
    globalTop5,
    metrics,
    onContinue
}: WordCloudResultsProps) {

    // Determine color and message based on the deviance points earned for this single poll
    const devianceResult = useMemo(() => {
        if (pointsEarned >= 10) {
            return {
                title: "Mind Reader! 🎯",
                message: "Your word cloud is perfectly aligned with the consensus.",
                color: "text-green-600",
                bg: "bg-green-50",
                border: "border-green-200"
            };
        } else if (pointsEarned >= 5) {
            return {
                title: "Great Intuition! ✨",
                message: "You captured many of the top global descriptors.",
                color: "text-blue-600",
                bg: "bg-blue-50",
                border: "border-blue-200"
            };
        } else if (pointsEarned > 0) {
            return {
                title: "On the Board! 👍",
                message: "You share some thinking with the crowd.",
                color: "text-purple-600",
                bg: "bg-purple-50",
                border: "border-purple-200"
            };
        } else {
            return {
                title: "Independent Thinker 🧠",
                message: "Your descriptors were highly unique compared to the global cloud.",
                color: "text-orange-600",
                bg: "bg-orange-50",
                border: "border-orange-200"
            };
        }
    }, [pointsEarned]);

    // Calculate maximum weight to normalize font sizes for the visual cloud
    const maxWeight = useMemo(() => {
        if (!globalTop5 || globalTop5.length === 0) return 1;
        return Math.max(...globalTop5.map(w => w.weight));
    }, [globalTop5]);

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header / Points Earned */}
            <div className={`rounded-3xl p-8 border-4 text-center shadow-xl ${devianceResult.bg} ${devianceResult.border}`}>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-md mb-4">
                    <Trophy className={`w-8 h-8 ${devianceResult.color}`} />
                </div>
                <h1 className={`text-3xl md:text-5xl font-black mb-2 tracking-tight ${devianceResult.color}`}>
                    +{pointsEarned} Points
                </h1>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{devianceResult.title}</h2>
                <p className="text-gray-600 font-medium text-lg">{devianceResult.message}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Visual Word Cloud (Global Consensus) */}
                <div className="bg-white rounded-3xl p-8 border-2 border-gray-200 shadow-lg flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-6 border-b-2 border-gray-100 pb-4">
                        <Cloud className="w-6 h-6 text-purple-600" />
                        <h3 className="text-xl font-black uppercase text-gray-800 tracking-wider">Global Consensus Cloud</h3>
                    </div>

                    <div className="flex-1 flex flex-wrap items-center justify-center gap-4 content-center min-h-[250px] p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        {globalTop5 && globalTop5.length > 0 ? (
                            globalTop5.map((item, index) => {
                                // Calculate a relative size between 1rem and 2.5rem based on weight relative to maxWeight
                                const relativeSize = Math.max(0.4, item.weight / maxWeight);
                                const fontSize = `${1 + (relativeSize * 1.5)}rem`;
                                const opacity = Math.max(0.6, relativeSize + 0.2); // Faint for lower rank

                                // Cycle through brand colors based on rank
                                const colors = [
                                    'text-purple-600 drop-shadow-md',
                                    'text-blue-600',
                                    'text-indigo-600',
                                    'text-pink-600',
                                    'text-fuchsia-600'
                                ];

                                return (
                                    <span
                                        key={item.id}
                                        className={`font-black tracking-tight leading-none ${colors[index % colors.length]}`}
                                        style={{
                                            fontSize,
                                            opacity,
                                            transform: `scale(${relativeSize < 0.8 ? 1 : 1.1}) rotate(${index % 2 === 0 ? -2 : 2}deg)`
                                        }}
                                        title={`Rank ${index + 1} (Weight: ${item.weight})`}
                                    >
                                        {item.word}
                                    </span>
                                );
                            })
                        ) : (
                            <p className="text-gray-400 font-bold italic">Not enough data to form a cloud yet.</p>
                        )}
                    </div>
                </div>

                {/* Updated Player Metrics */}
                <div className="bg-white rounded-3xl p-8 border-2 border-gray-200 shadow-lg flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-6 border-b-2 border-gray-100 pb-4">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        <h3 className="text-xl font-black uppercase text-gray-800 tracking-wider">Your Updated Metrics</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-6">
                        {/* AQ */}
                        <div className="bg-blue-50 rounded-2xl p-5 border-2 border-blue-100 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black uppercase text-blue-600 tracking-widest block mb-1">Awareness Quotient (AQ)</span>
                                <div className="text-3xl font-black text-blue-900">{metrics.aq}%</div>
                            </div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500 font-bold">
                                AQ
                            </div>
                        </div>

                        {/* DQ */}
                        <div className="bg-orange-50 rounded-2xl p-5 border-2 border-orange-100 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black uppercase text-orange-600 tracking-widest block mb-1">Deviance Quotient (DQ)</span>
                                <div className="text-3xl font-black text-orange-900">{(metrics.overallDq * 100).toFixed(0)}%</div>
                            </div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-orange-500 font-bold">
                                DQ
                            </div>
                        </div>

                        {/* Total Score */}
                        <div className="bg-gray-100 rounded-2xl p-5 border-2 border-gray-200 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black uppercase text-gray-500 tracking-widest block mb-1">Total Score</span>
                                <div className="text-3xl font-black text-gray-900">
                                    {metrics.rawScore.toLocaleString()}
                                </div>
                            </div>
                            <TrendingUp className="w-8 h-8 text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Row */}
            <div className="flex justify-center mt-4">
                <button
                    onClick={onContinue}
                    className="flexItems-center justify-center gap-3 px-10 py-5 bg-black text-white rounded-full font-black text-xl hover:scale-105 transition-transform shadow-[0_6px_0_0_rgba(100,20,200,1)] hover:shadow-[0_2px_0_0_rgba(100,20,200,1)] hover:translate-y-1"
                >
                    Continue Journey
                    <ArrowRight className="w-6 h-6" />
                </button>
            </div>

        </div>
    );
}

"use client";

import React from "react";

export default function YourMetrics({
    stageName,
    levelLetter,
    awarenessQuotient,
    overallDq
}: {
    stageName: string;
    levelLetter: string;
    awarenessQuotient: number;
    overallDq: number;
}) {
    return (
        <div className="w-full min-h-[260px] flex flex-col justify-start bg-black/40 rounded-[2rem] p-4 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md">
            <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-2">Your Metrics</h3>

            <div className="flex flex-col gap-4">
                {/* Status */}
                <div>
                    <div className="text-lg font-black text-white leading-none mb-1">
                        Stage {stageName} • Level {levelLetter}
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Status</div>
                </div>

                {/* Awareness Quotient (Total Score) */}
                <div>
                    <div className="text-5xl font-black text-yellow-400 leading-none mb-1">{awarenessQuotient}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                </div>

                {/* DQ - Overall */}
                <div>
                    <div className={`text-3xl font-black leading-none mb-1 ${overallDq < 0.2 ? "text-green-400" : overallDq < 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                        {overallDq.toFixed(2)}
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                </div>
            </div>
        </div>
    );
}

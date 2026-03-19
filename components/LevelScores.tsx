"use client";

import React from "react";

export default function LevelScores({
    correctCount,
    totalCount,
    concurrencePct,
    pollPoints,
    bonusNum,
    awarenessQuotient,
    dqNum
}: {
    correctCount: number;
    totalCount: number;
    concurrencePct: number;
    pollPoints: number;
    bonusNum: number;
    awarenessQuotient: number;
    dqNum: number;
}) {
    return (
        <div className="w-full h-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md">
            <h3 className="text-xl font-black mb-8 uppercase tracking-wider text-white border-b border-white/20 pb-4">Level Scores</h3>

            <div className="flex flex-col gap-10">
                {/* 1. Concurrence */}
                <div>
                    <div className="text-5xl font-black text-white leading-none mb-2">
                        {correctCount}/{totalCount} <span className="text-2xl text-gray-400">({concurrencePct}%)</span>
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Concurrence</div>
                </div>

                {/* 2 & 3. Points Row */}
                <div className="flex flex-row justify-center items-center gap-6 border-t border-b border-white/10 py-6">
                    {/* Poll Pts */}
                    <div>
                        <div className="text-3xl font-black text-yellow-300 leading-none mb-2">
                            +{pollPoints} Pts
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Poll Pts</div>
                    </div>

                    {/* Bonus Pts */}
                    {bonusNum > 0 && (
                        <div className="pl-6 border-l border-white/10">
                            <div className="text-3xl font-black text-yellow-300 leading-none mb-2">
                                +{bonusNum} Pts
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Bonus Pts</div>
                        </div>
                    )}
                </div>

                {/* 4. AQ & DQ Row */}
                <div className="flex flex-col gap-8">
                    {/* AQ (Green) */}
                    <div>
                        <div className="text-6xl font-black text-green-400 leading-none mb-2">
                            {awarenessQuotient}
                        </div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                    </div>

                    {/* DQ (Red) */}
                    <div>
                        <div className="text-6xl font-black text-red-400 leading-none mb-2">
                            {dqNum.toFixed(2)}
                        </div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

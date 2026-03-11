"use client";

import { useState } from "react";
import { formatHtmlForDisplay } from "@/lib/formatters";

interface LevelIntroScreenProps {
    stage: number;
    level: number;
    introContent: string;
    izzyImage: string | null;
    onStartLevel: () => void;
}

export default function LevelIntroScreen({
    stage,
    level,
    introContent,
    izzyImage,
    onStartLevel
}: LevelIntroScreenProps) {
    const [loading, setLoading] = useState(false);

    const handleStart = () => {
        setLoading(true);
        onStartLevel();
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-black p-6 relative overflow-x-hidden">
            <div className="relative z-10 w-full animate-in zoom-in duration-500 max-w-7xl mx-auto">

                {/* 1/3 Left (Izzy) and 2/3 Right (Content) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

                    {/* 1/3 Left - Izzy Image */}
                    <div className="md:col-span-1 flex flex-col justify-end items-center">
                        {izzyImage ? (
                            <img src={izzyImage} alt="Izzy Introduction" className="object-contain max-h-[600px] w-auto h-auto drop-shadow-xl" />
                        ) : (
                            <div className="h-[400px] w-full flex items-center justify-center bg-gray-200 rounded-2xl text-gray-500 italic">
                                Missing Izzy Image
                            </div>
                        )}
                    </div>

                    {/* 2/3 Right - Intro Content */}
                    <div className="md:col-span-2 flex flex-col items-center md:items-start justify-center bg-white rounded-[2rem] p-10 md:p-16 border border-gray-100 shadow-2xl">

                        <div className="mb-2">
                            <span className="bg-black text-white text-sm font-bold px-4 py-1 rounded-full uppercase tracking-widest">
                                Stage {stage} • Level {level}
                            </span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-black mb-8 tracking-tight text-left">
                            Welcome to Level {level}
                        </h1>

                        <div className="rich-text text-xl md:text-2xl text-gray-700 leading-relaxed mb-12 w-full text-left font-medium max-w-3xl">
                            {introContent ? (
                                <div dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(introContent) }} />
                            ) : (
                                <p>Get ready for the next set of challenges.</p>
                            )}
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={loading}
                            className="bg-black text-white text-2xl font-black py-5 px-12 rounded-full shadow-[0_6px_0_0_rgba(0,0,0,0.2)] hover:scale-105 transition-transform disabled:opacity-50"
                        >
                            {loading ? "Loading..." : "Start Level"}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

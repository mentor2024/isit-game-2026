"use client";

import React from "react";

export default function LevelRailsLayout({
    leftRail,
    rightRail,
    children,
    hideRails = false
}: {
    leftRail?: React.ReactNode;
    rightRail?: React.ReactNode;
    children: React.ReactNode;
    hideRails?: boolean;
}) {
    // If rails are explicitly hidden or neither rail exists, just render children centered
    if (hideRails || (!leftRail && !rightRail)) {
        return (
            <div className="w-full flex justify-center items-start animate-in fade-in duration-700">
                <div className="w-full max-w-3xl flex flex-col items-center">
                    {children}
                </div>
            </div>
        );
    }

    // Default height shim matching the modules (approx height)
    // Ensures the layout doesn't collapse or shift if one side is missing
    const PlaceholderContent = () => (
        <div className="w-full min-h-[260px] flex flex-col justify-start bg-transparent rounded-[2rem] p-4 border-4 border-transparent text-center invisible">
            <h3 className="text-sm font-black mb-4 border-b pb-2">Placeholder</h3>
            <div className="flex flex-col gap-4">
                <div><div className="text-lg mb-1">Stage One • Level A</div><div className="text-[9px]">Text</div></div>
                <div><div className="text-5xl mb-1">0</div><div className="text-[9px]">Text</div></div>
                <div><div className="text-3xl mb-1">0.00</div><div className="text-[9px]">Text</div></div>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col md:flex-row justify-center items-start gap-8 relative z-10 animate-in fade-in duration-700 max-w-7xl mx-auto">
            {/* Left Column (Rail) */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 flex flex-col gap-4 order-2 md:order-1">
                {leftRail || <PlaceholderContent />}
            </div>

            {/* Main Content (Center) */}
            <div className="flex-1 w-full max-w-3xl order-1 md:order-2 flex flex-col items-center">
                {children}
            </div>

            {/* Right Column (Rail) */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 flex flex-col gap-4 order-3 md:order-3">
                {rightRail || <PlaceholderContent />}
            </div>
        </div>
    );
}

"use client";

import { useState, useRef, useEffect } from "react";

interface Definition {
    partOfSpeech: string;
    definition: string;
    example?: string;
}

interface DictionaryResult {
    word: string;
    phonetic?: string;
    definitions: Definition[];
}

async function fetchDefinition(word: string): Promise<DictionaryResult | null> {
    // Strip punctuation for the API lookup
    const clean = word.replace(/[^a-zA-Z'-]/g, "").toLowerCase();
    if (!clean || clean.length < 2) return null;

    try {
        const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${clean}`
        );
        if (!res.ok) return null;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const entry = data[0];

        // Collect up to 3 definitions across all meanings
        const definitions: Definition[] = [];
        for (const meaning of entry.meanings || []) {
            for (const def of meaning.definitions || []) {
                if (definitions.length >= 3) break;
                definitions.push({
                    partOfSpeech: meaning.partOfSpeech,
                    definition: def.definition,
                    example: def.example,
                });
            }
            if (definitions.length >= 3) break;
        }

        return {
            word: entry.word,
            phonetic: entry.phonetic,
            definitions,
        };
    } catch {
        return null;
    }
}

export default function WordWithDefinition({ word }: { word: string }) {
    const [tooltip, setTooltip] = useState<DictionaryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchedRef = useRef(false);

    // Clean word for display — preserve original for rendering
    const isSymbol = word === "|";

    const handleMouseEnter = async () => {
        if (isSymbol) return;

        // Show tooltip immediately (with loading state if needed)
        setVisible(true);

        // Only fetch once per mount
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            setLoading(true);
            const result = await fetchDefinition(word);
            setLoading(false);
            if (result && result.definitions.length > 0) {
                setTooltip(result);
            } else {
                setNotFound(true);
            }
        }
    };

    const handleMouseLeave = () => {
        // Small delay so tooltip doesn't flicker when moving mouse
        timeoutRef.current = setTimeout(() => setVisible(false), 150);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    if (isSymbol) {
        return <span className="mx-2 text-gray-400">|</span>;
    }

    return (
        <span className="relative inline-block group">
            <span
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="cursor-help border-b-2 border-dotted border-gray-400 hover:border-purple-500 hover:text-purple-700 transition-colors duration-150"
            >
                {word}
            </span>

            {/* Tooltip */}
            {visible && (
                <span
                    onMouseEnter={() => {
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    }}
                    onMouseLeave={handleMouseLeave}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 bg-white border-2 border-purple-200 rounded-2xl shadow-2xl p-4 z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                    {/* Arrow */}
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-purple-200 rotate-45 block" />

                    {loading && (
                        <span className="text-sm text-gray-400 italic">
                            Looking up "{word}"...
                        </span>
                    )}

                    {notFound && !loading && (
                        <span className="text-sm text-gray-400 italic">
                            No definition found for "{word}"
                        </span>
                    )}

                    {tooltip && !loading && (
                        <>
                            <span className="block font-black text-lg text-gray-900 leading-tight">
                                {tooltip.word}
                                {tooltip.phonetic && (
                                    <span className="ml-2 text-sm font-normal text-gray-400">
                                        {tooltip.phonetic}
                                    </span>
                                )}
                            </span>

                            <span className="block mt-2 space-y-2">
                                {tooltip.definitions.map((def, i) => (
                                    <span key={i} className="block text-sm">
                                        <span className="inline text-xs font-bold text-purple-600 uppercase tracking-wide mr-1">
                                            {def.partOfSpeech}
                                        </span>
                                        <span className="text-gray-700">
                                            {def.definition}
                                        </span>
                                        {def.example && (
                                            <span className="block mt-0.5 text-xs text-gray-400 italic">
                                                "{def.example}"
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </span>
                        </>
                    )}
                </span>
            )}
        </span>
    );
}

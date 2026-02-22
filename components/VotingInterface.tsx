"use client";

import { useState, useId } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragEndEvent,
} from "@dnd-kit/core";

// --- Types ---
type PollObject = {
    id: string;
    text: string;
    image_url?: string | null;
};

type VotingInterfaceProps = {
    pollId: string;
    objects: PollObject[];
    sides: ("IS" | "IT")[];
    pollType?: string;
    feedbackMajority?: string;
    feedbackMinority?: string;
    izzyImage?: string | null;
    izzyQuote?: string | null;
};

type AssignmentMap = Record<string, "IS" | "IT" | null>;

// --- Draggable Word ---
function DraggableWord({ id, text, imageUrl }: { id: string; text: string; imageUrl?: string | null }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { text, imageUrl },
    });

    const baseClasses = `flex items-center justify-center bg-white shadow-[0_2px_0_0_rgba(0,0,0,1)] border-2 border-black z-10 overflow-hidden relative`;
    const sizeClasses = imageUrl
        ? "w-[200px] h-[200px] rounded-xl"
        : "min-w-[120px] h-[60px] rounded-2xl px-6";

    const content = imageUrl ? (
        <img src={imageUrl} alt={text} className="w-full h-full object-cover pointer-events-none select-none" />
    ) : (
        <span className="text-xl font-bold text-black pointer-events-none select-none">{text}</span>
    );

    if (isDragging) {
        return <div ref={setNodeRef} className={`${baseClasses} ${sizeClasses} opacity-50`}>{content}</div>;
    }

    return (
        <div ref={setNodeRef} {...listeners} {...attributes}
            className={`${baseClasses} ${sizeClasses} cursor-grab active:cursor-grabbing hover:shadow-[0_4px_0_0_rgba(0,0,0,1)] transition-all`}>
            {content}
        </div>
    );
}

// --- Drop Zone ---
function DropZone({ side, assignedWord, hasImages }: { side: "IS" | "IT"; assignedWord?: PollObject; hasImages: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: side });

    return (
        <div ref={setNodeRef} className="flex flex-col items-center h-full justify-between relative min-w-[160px]">
            <div className={`w-full flex justify-center items-start ${hasImages ? "h-[200px]" : "h-[60px]"}`}>
                {assignedWord && (
                    <div className="z-10">
                        <DraggableWord id={assignedWord.id} text={assignedWord.text} imageUrl={assignedWord.image_url} />
                    </div>
                )}
            </div>
            <div className={`w-[2px] bg-black transition-all duration-300 ${assignedWord ? "opacity-100 flex-grow" : "opacity-0 flex-grow"}`} />
            <div className={`w-[160px] h-[160px] md:w-[180px] md:h-[180px] rounded-full border-2 bg-white flex items-center justify-center transition-all duration-100 z-0 mb-2 ${isOver ? "border-black scale-105" : "border-black"}`}>
                <img src={side === "IS" ? "/is.png" : "/it.png"} alt={side} className="w-24 h-24 object-contain select-none pointer-events-none" />
            </div>
        </div>
    );
}

// --- Consensus Result Display (isit_text_plus only) ---
function ConsensusResult({
    isMajority,
    isVotes,
    itVotes,
    pointsAwarded,
    stageMultiplier,
    feedback,
    majoritySide,
}: {
    isMajority: boolean;
    isVotes: number;
    itVotes: number;
    pointsAwarded: number;
    stageMultiplier: number;
    feedback: string;
    majoritySide: string | null;
}) {
    const total = isVotes + itVotes;
    const isPct = total > 0 ? Math.round((isVotes / total) * 100) : 50;
    const itPct = 100 - isPct;

    return (
        <div className="mt-6 w-full max-w-sm mx-auto animate-in fade-in zoom-in duration-300">
            {/* Points badge */}
            <div className={`text-center mb-4 px-6 py-3 rounded-2xl font-black text-lg border-2 ${isMajority
                ? "bg-green-500 text-white border-green-700"
                : majoritySide === null
                    ? "bg-gray-200 text-gray-700 border-gray-400"
                    : "bg-orange-100 text-orange-800 border-orange-300"
                }`}>
                {majoritySide === null
                    ? "🤝 Complete disagreement — no points"
                    : isMajority
                        ? `✅ With the majority! +${pointsAwarded} point${pointsAwarded !== 1 ? 's' : ''}${stageMultiplier > 1 ? ` (×${stageMultiplier})` : ''}`
                        : "🔀 With the minority — 0 points"
                }
            </div>

            {/* Vote bar */}
            <div className="mb-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>IS {isPct}%</span>
                    <span>{itPct}% IT</span>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden border border-gray-300">
                    <div className="bg-blue-500 transition-all duration-700" style={{ width: `${isPct}%` }} />
                    <div className="bg-red-400 transition-all duration-700" style={{ width: `${itPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{isVotes} votes</span>
                    <span>{itVotes} votes</span>
                </div>
            </div>

            {/* Feedback message */}
            {feedback && (
                <div className="text-center text-sm text-gray-600 italic px-4"
                    dangerouslySetInnerHTML={{ __html: feedback }} />
            )}
        </div>
    );
}

// --- Izzy Dialogue Overlay ---
function IzzyDialogue({ image, quote }: { image: string, quote: string }) {
    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8 w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="relative order-2 md:order-1 flex-1 max-w-sm">
                <div className="bg-white border-4 border-purple-500 rounded-3xl p-6 shadow-xl relative z-10">
                    <div
                        className="text-lg md:text-xl font-bold text-gray-800 [&>p]:mb-2 last:[&>p]:mb-0 [&_strong]:text-purple-700"
                        dangerouslySetInnerHTML={{ __html: quote }}
                    />
                </div>
                {/* Speech Bubble Tail */}
                <div className="absolute -bottom-4 left-1/2 md:top-1/2 md:-right-5 md:left-auto md:-translate-y-1/2 -translate-x-1/2 md:translate-x-0 w-8 h-8 bg-white border-b-4 border-r-4 md:border-b-0 md:border-t-4 md:border-r-4 border-purple-500 rotate-45 z-0" />
            </div>

            <div className="order-1 md:order-2 shrink-0">
                <img
                    src={`/images/izzy/${image}`}
                    alt="Izzy"
                    className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />
            </div>
        </div>
    );
}

// --- Main Interface ---
export default function VotingInterface({
    pollId,
    objects,
    sides,
    pollType = "isit_text",
    feedbackMajority,
    feedbackMinority,
    izzyImage,
    izzyQuote
}: VotingInterfaceProps) {
    const router = useRouter();
    const hasImages = objects.some(obj => obj.image_url);
    const isPlus = pollType === "isit_text_plus";

    const [assignments, setAssignments] = useState<AssignmentMap>(() =>
        objects.reduce((acc, obj) => ({ ...acc, [obj.id]: null }), {} as AssignmentMap)
    );

    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggedText, setDraggedText] = useState("");
    const [draggedImage, setDraggedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // isit_text_plus result state
    const [consensusResult, setConsensusResult] = useState<{
        isMajority: boolean;
        isVotes: number;
        itVotes: number;
        pointsAwarded: number;
        stageMultiplier: number;
        feedback: string;
        majoritySide: string | null;
    } | null>(null);

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
        setDraggedText(event.active.data.current?.text || "");
        setDraggedImage(event.active.data.current?.imageUrl || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setDraggedText("");
        setDraggedImage(null);
        if (!over) return;

        const droppedObjectId = active.id as string;
        const targetSide = over.id as "IS" | "IT";
        const otherObject = objects.find(o => o.id !== droppedObjectId);
        const otherSide = targetSide === "IS" ? "IT" : "IS";

        setAssignments(prev => ({
            ...prev,
            [droppedObjectId]: targetSide,
            ...(otherObject ? { [otherObject.id]: otherSide } : {}),
        }));
    };

    const handleReset = () => {
        setAssignments(objects.reduce((acc, obj) => ({ ...acc, [obj.id]: null }), {} as AssignmentMap));
        setMessage("");
        setConsensusResult(null);
    };

    const unassignedObjects = objects.filter(o => !assignments[o.id]);
    const allAssigned = unassignedObjects.length === 0;

    const handleSubmit = async () => {
        setLoading(true);
        setMessage("");
        const supabase = createClient();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const { error: authError } = await supabase.auth.signInAnonymously();
                if (authError) throw new Error("Could not sign in.");
            }

            const isObject = objects.find(o => assignments[o.id] === "IS");
            const itObject = objects.find(o => assignments[o.id] === "IT");
            if (!isObject || !itObject) throw new Error("Please assign both words.");

            const { submitVote } = await import("@/app/(main)/poll/actions");
            const chosenSide = assignments[isObject.id] === "IS" ? "IS" : "IT";

            const result = await submitVote(pollId, isObject.id, itObject.id, chosenSide);

            if (!result.success) throw new Error(result.error || "Submission failed");

            // Handle isit_text_plus consensus result
            if (isPlus && result.pollType === "isit_text_plus") {
                setConsensusResult({
                    isMajority: result.is_majority ?? false,
                    isVotes: result.is_votes ?? 0,
                    itVotes: result.it_votes ?? 0,
                    pointsAwarded: result.points_awarded ?? 0,
                    stageMultiplier: result.stage_multiplier ?? 1,
                    feedback: result.feedback || "",
                    majoritySide: result.majority_side ?? null,
                });

                // Still handle level up after a short delay to show result
                if (result.levelUp) {
                    await new Promise(r => setTimeout(r, 2500));
                    if (!result.showInterstitial || result.stage === 0) {
                        window.location.href = '/poll';
                    } else {
                        window.location.href = `/levelup?stage=${result.stage}&level=${result.level}&bonus=${result.bonus || 0}&dq=${result.dq || 0}&correct=${result.correctPolls || 0}&total=${result.totalPolls || 0}&points=${result.points || 0}`;
                    }
                }
                return;
            }

            // Standard poll level up handling
            if (result.levelUp) {
                setMessage("Level Complete! 🎉");
                await new Promise(r => setTimeout(r, 1000));
                if (!result.showInterstitial) {
                    window.location.href = '/poll';
                    return;
                }
                if (result.stage === 0) {
                    window.location.href = '/poll';
                } else {
                    window.location.href = `/levelup?stage=${result.stage}&level=${result.level}&bonus=${result.bonus || 0}&dq=${result.dq || 0}&correct=${result.correctPolls || 0}&total=${result.totalPolls || 0}&points=${result.points || 0}`;
                }
                return;
            }

            setMessage("");
            router.refresh();

        } catch (e: any) {
            console.error("Submit Error:", e);
            setMessage(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const dndId = useId();

    return (
        <DndContext id={dndId} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col items-center w-full pb-8">
                {izzyImage && izzyQuote && (
                    <IzzyDialogue image={izzyImage} quote={izzyQuote} />
                )}

                {/* Plus badge */}
                {isPlus && (
                    <div className="mb-3 inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        ✨ Consensus Round — no definitive answer
                    </div>
                )}

                {/* 3-Column Grid */}
                <div className={`grid grid-cols-[1fr_auto_1fr] gap-2 w-fit mx-auto items-stretch mb-8 px-4 ${hasImages ? "h-[450px]" : "h-[350px]"}`}>
                    <div className="h-full">
                        <DropZone side={sides[0]} assignedWord={objects.find(o => assignments[o.id] === sides[0])} hasImages={hasImages} />
                    </div>
                    <div className="flex gap-4 items-start min-w-[100px] justify-center">
                        {unassignedObjects.map(obj => (
                            <div key={obj.id} className="z-20">
                                <DraggableWord id={obj.id} text={obj.text} imageUrl={obj.image_url} />
                            </div>
                        ))}
                    </div>
                    <div className="h-full">
                        <DropZone side={sides[1]} assignedWord={objects.find(o => assignments[o.id] === sides[1])} hasImages={hasImages} />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 items-center">
                    <button onClick={handleReset} className="px-8 py-3 bg-white text-black border-2 border-black rounded-full text-lg font-bold hover:bg-black hover:text-white transition-colors">
                        Reset
                    </button>
                    {allAssigned && !consensusResult && !message && (
                        <button onClick={handleSubmit} disabled={loading}
                            className="px-8 py-3 bg-black text-white text-lg font-bold rounded-full shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:scale-105 transition-transform disabled:opacity-50">
                            {loading ? "Confirming..." : "Confirm"}
                        </button>
                    )}
                </div>

                {/* Consensus Result */}
                {consensusResult && (
                    <ConsensusResult {...consensusResult} />
                )}

                {/* Standard message */}
                {message && !consensusResult && (
                    <div className={`mt-6 px-6 py-3 rounded-xl font-bold border-2 border-black animate-in fade-in zoom-in duration-300
                        ${message.includes("Error") ? "bg-red-50 text-red-600 border-red-500" :
                            message.includes("Incorrect") ? "bg-red-500 text-white border-red-700" :
                                message.includes("Correct") ? "bg-green-500 text-white border-green-700" :
                                    "bg-black text-white"}`}>
                        {message}
                    </div>
                )}
            </div>

            <DragOverlay>
                {activeId ? (
                    draggedImage ? (
                        <div className="w-[200px] h-[200px] bg-white rounded-xl shadow-[0_4px_0_0_rgba(0,0,0,1)] border-2 border-black rotate-3 scale-105 cursor-grabbing overflow-hidden">
                            <img src={draggedImage} alt={draggedText} className="w-full h-full object-cover pointer-events-none select-none" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center min-w-[120px] h-[60px] bg-white rounded-2xl shadow-[0_4px_0_0_rgba(0,0,0,1)] border-2 border-black rotate-3 scale-105 cursor-grabbing px-6">
                            <span className="text-xl font-bold text-black">{draggedText}</span>
                        </div>
                    )
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

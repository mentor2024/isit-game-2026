"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragEndEvent,
} from "@dnd-kit/core";
import { addDescriptor, getDescriptors, castWordCloudVote } from "@/app/(main)/poll/actions";
import WordCloudResultsView from "@/components/WordCloudResultsView";

// --- Types ---
type PollObject = {
    id: string;
    text: string;
    image_url?: string | null;
};

type Descriptor = {
    id: string;
    poll_id: string;
    word: string;
};

type WordCloudInterfaceProps = {
    pollId: string;
    baseObject: PollObject;
};

type AssignmentMap = Record<number, Descriptor | null>;
const MAX_RANKS = 5;

// --- Components ---
function DraggableWord({ id, text }: { id: string; text: string }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id,
        data: { text },
    });

    const baseClasses = "relative cursor-grab active:cursor-grabbing hover:scale-105 transition-transform z-10 select-none";

    if (isDragging) {
        return (
            <div ref={setNodeRef} className={`${baseClasses} opacity-30`}>
                <div className="px-4 py-2 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 font-bold text-gray-500">
                    {text}
                </div>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} className={baseClasses}>
            <div className="px-4 py-2 bg-white rounded-full shadow-[0_4px_0_0_rgba(0,0,0,1)] border-2 border-black font-bold text-black transition-colors">
                {text}
            </div>
        </div>
    );
}

function DroppableRankSlot({ rank, assignedItem }: { rank: number, assignedItem: Descriptor | null }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `rank_${rank}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex items-center w-full min-h-[60px] p-2 border-2 rounded-xl transition-colors ${isOver ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-gray-50 flex-1"
                }`}
        >
            <div className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-full font-black text-lg mr-4 flex-shrink-0">
                {rank}
            </div>
            <div className="flex-1 flex items-center">
                {assignedItem ? (
                    <DraggableWord id={assignedItem.id} text={assignedItem.word} />
                ) : (
                    <span className="text-gray-400 font-bold italic text-sm w-full">Drop word here to rank...</span>
                )}
            </div>
        </div>
    );
}

export default function WordCloudInterface({ pollId, baseObject }: WordCloudInterfaceProps) {
    const router = useRouter();
    const dndId = useId();

    const [descriptors, setDescriptors] = useState<Descriptor[]>([]);
    const [assignments, setAssignments] = useState<AssignmentMap>({
        1: null, 2: null, 3: null, 4: null, 5: null
    });

    const [newWord, setNewWord] = useState("");
    const [adding, setAdding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Results State
    const [resultsData, setResultsData] = useState<any>(null);
    const [advanceAction, setAdvanceAction] = useState<() => void>(() => () => { });

    // DND State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggedText, setDraggedText] = useState<string>("");

    // Initial Fetch
    useEffect(() => {
        let mounted = true;
        const fetchInitial = async () => {
            const res = await getDescriptors(pollId);
            if (res.success && mounted && res.data) {
                setDescriptors(res.data);
            }
        };
        fetchInitial();
        return () => { mounted = false; };
    }, [pollId]);

    // Derived State
    const unassignedDescriptors = descriptors.filter(desc => {
        return !Object.values(assignments).some(assigned => assigned?.id === desc.id);
    });

    const handleAddWord = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newWord.trim();
        if (!trimmed) return;

        setAdding(true);
        setMessage("");

        const res = await addDescriptor(pollId, trimmed);
        setAdding(false);

        if (res.success && res.data) {
            setDescriptors(prev => [res.data, ...prev]);
            setNewWord("");
            setMessage(`"${trimmed}" added to pool!`);
            // Automatically assign it to first available slot if possible
            for (let i = 1; i <= MAX_RANKS; i++) {
                if (!assignments[i]) {
                    setAssignments(prev => ({ ...prev, [i]: res.data }));
                    break;
                }
            }
        } else {
            setMessage(res.error || "Error adding word.");
        }
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
        const item = descriptors.find(d => d.id === event.active.id);
        if (item) setDraggedText(item.word);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setDraggedText("");

        if (!over) return; // Dropped outside

        const draggedWordId = active.id as string;
        const targetId = over.id as string;

        const draggedWord = descriptors.find(d => d.id === draggedWordId);
        if (!draggedWord) return;

        // Find where the word came from
        let sourceRank: number | null = null;
        for (const [rankStr, assigned] of Object.entries(assignments)) {
            if (assigned?.id === draggedWordId) {
                sourceRank = parseInt(rankStr);
                break;
            }
        }

        if (targetId.startsWith('rank_')) {
            const destRank = parseInt(targetId.replace('rank_', ''));

            setAssignments(prev => {
                const next = { ...prev };

                // If the target slot already has an item, evict it (it goes back to pool)
                // If moving between slots, we could swap, but simple eviction is fine.
                const existingItem = next[destRank];

                // If dragged from another slot, empty that source slot
                if (sourceRank !== null) {
                    next[sourceRank] = existingItem; // Swap functionality!
                }

                next[destRank] = draggedWord;
                return next;
            });
        } else if (targetId === "pool") {
            // Dropped back into pool to unassign
            if (sourceRank !== null) {
                setAssignments(prev => {
                    const next = { ...prev };
                    next[sourceRank] = null;
                    return next;
                });
            }
        }
    };

    const handleReset = () => {
        setAssignments({ 1: null, 2: null, 3: null, 4: null, 5: null });
        setMessage("");
    };

    const handleSubmitRankings = async () => {
        const rankedItems = Object.entries(assignments)
            .filter(([_, descriptor]) => descriptor !== null)
            .map(([rank, descriptor]) => ({
                id: descriptor!.id,
                word: descriptor!.word,
                rank: parseInt(rank)
            }));

        if (rankedItems.length === 0) {
            setMessage("Please rank at least one word before submitting.");
            return;
        }

        setLoading(true);
        setMessage("");

        const res = await castWordCloudVote(pollId, baseObject.id, rankedItems);

        if (!res.success) {
            setMessage(res.error || "Voting failed.");
            setLoading(false);
            return;
        }

        // Prepare the continuation action
        const doAdvance = () => {
            if (res.levelUp) {
                if (!res.showInterstitial || res.stage === 0) {
                    window.location.href = '/poll';
                    return;
                }
                window.location.href = `/levelup?stage=${res.stage}&level=${res.level}&bonus=${res.bonus || 0}&dq=${res.dq || 0}&correct=${res.correctPolls || 0}&total=${res.totalPolls || 0}&points=${res.points || 0}`;
            } else {
                handleReset();
                setResultsData(null);
                router.refresh();
            }
        };

        if (res.wordCloudData) {
            setAdvanceAction(() => doAdvance);
            setResultsData({
                pointsEarned: res.points || 0,
                globalTop5: res.wordCloudData.top5,
                metrics: res.wordCloudData.metrics
            });
        } else {
            // Fallback if no word cloud data returned
            doAdvance();
        }
    };

    const { setNodeRef: setPoolRef, isOver: isOverPool } = useDroppable({ id: "pool" });

    if (resultsData) {
        return (
            <div className="w-full max-w-6xl mx-auto p-4 py-8">
                <WordCloudResultsView
                    pollId={pollId}
                    pointsEarned={resultsData.pointsEarned}
                    globalTop5={resultsData.globalTop5}
                    metrics={resultsData.metrics}
                    onContinue={advanceAction}
                />
            </div>
        );
    }

    return (
        <DndContext id={dndId} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col lg:flex-row w-full max-w-6xl mx-auto p-4 gap-8">

                {/* Left Pane: Target Object & Ranking Zone */}
                <div className="flex flex-col flex-1 gap-6">
                    {/* Media Object Display */}
                    <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black flex flex-col items-center justify-center">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-wider text-center">Focus Object</h2>
                        {baseObject.image_url ? (
                            <div className="w-full max-w-[400px] aspect-square bg-gray-100 rounded-2xl border-4 border-black overflow-hidden relative">
                                <img src={baseObject.image_url} alt={baseObject.text} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="min-h-[200px] flex items-center justify-center text-4xl font-black text-center break-words bg-gray-100 p-8 rounded-2xl border-4 border-black w-full">
                                {baseObject.text}
                            </div>
                        )}
                    </div>

                    {/* Ranking Zone */}
                    <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
                        <h3 className="text-xl font-black mb-2 uppercase tracking-tight text-center">Your Word Cloud Ranking</h3>
                        <p className="text-sm text-gray-500 font-bold text-center mb-6">
                            Drag your top {MAX_RANKS} descriptors here in order of significance.
                        </p>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4, 5].map(rank => (
                                <DroppableRankSlot key={rank} rank={rank} assignedItem={assignments[rank]} />
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 mt-8">
                            {message && (
                                <div className={`p-3 rounded-xl font-bold text-center border-2 ${message.includes("Error") || message.includes("Please") ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                    {message}
                                </div>
                            )}
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={handleReset}
                                    className="px-6 py-3 font-bold border-2 border-black rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    Clear Ranks
                                </button>
                                <button
                                    onClick={handleSubmitRankings}
                                    disabled={loading}
                                    className="px-8 py-3 bg-black text-white font-bold rounded-full shadow-[0_4px_0_0_rgba(100,20,200,1)] border-2 border-black hover:translate-y-1 hover:shadow-[0_0px_0_0_rgba(100,20,200,1)] transition-all disabled:opacity-50"
                                >
                                    {loading ? "Submitting..." : "Lock in Word Cloud"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Pane: Descriptor Pool */}
                <div className="flex flex-col w-full lg:w-[400px] gap-6">
                    <div className="bg-purple-50 rounded-3xl p-6 shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-purple-900 border-b-8 flex flex-col h-full">
                        <h3 className="text-xl font-black mb-2 uppercase text-purple-900">Descriptor Pool</h3>
                        <p className="text-xs font-bold text-purple-700 mb-6">Create new words or drag existing ones into your rank list.</p>

                        <form onSubmit={handleAddWord} className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newWord}
                                onChange={e => setNewWord(e.target.value)}
                                placeholder="Add a new descriptor..."
                                maxLength={50}
                                disabled={adding}
                                className="flex-1 p-3 rounded-xl border-2 border-purple-300 font-bold focus:border-purple-600 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={adding || !newWord.trim()}
                                className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                Add
                            </button>
                        </form>

                        <div
                            ref={setPoolRef}
                            className={`flex-1 min-h-[300px] border-2 border-dashed rounded-2xl p-4 flex flex-wrap gap-2 content-start transition-colors ${isOverPool ? "border-purple-600 bg-purple-100/50" : "border-purple-200 bg-white"
                                }`}
                        >
                            {unassignedDescriptors.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-purple-300 font-bold italic text-center p-4">
                                    {descriptors.length === 0 ? "No words yet. Be the first to add one!" : "All words ranked!"}
                                </div>
                            ) : (
                                unassignedDescriptors.map(desc => (
                                    <DraggableWord key={desc.id} id={desc.id} text={desc.word} />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeId && (
                    <div className="px-5 py-3 bg-white rounded-full shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black font-black text-black rotate-6 scale-110">
                        {draggedText}
                    </div>
                )}
            </DragOverlay>

        </DndContext>
    );
}

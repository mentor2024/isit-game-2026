"use client";

import { useState } from "react";
import { updatePoll } from "@/app/admin/poll-actions";
import { STAGE_NAMES, LEVEL_LETTERS } from "@/lib/formatters";
import RichTextEditor from "@/components/RichTextEditor";
import VariableCheatSheet from "@/components/VariableCheatSheet";
import VariableActionLabel from "@/components/VariableActionLabel";
import Link from "next/link";

interface PollValues {
    id: string;
    title: string;
    instructions: string;
    feedback_correct?: string;
    feedback_incorrect?: string;
    consensus_1_majority?: string;
    consensus_1_minority?: string;
    consensus_2_majority?: string;
    consensus_2_minority?: string;
    stage: number;
    level: number;
    poll_order: number;
    type: string;
    izzy_image?: string;
    izzy_quote?: string;
    izzy_quote_correct?: string;
    izzy_quote_incorrect?: string;
    show_definitions?: boolean;
    poll_objects: any[];
    quad_scores?: {
        '1-2': number;
        '1-3': number;
        '1-4': number;
    };
}

// Helper component for dynamic feedback fields
function FeedbackEditor({ name, defaultValue, placeholder, variant = "simple", heightClass, label }: { name: string, defaultValue: string, placeholder?: string, variant?: 'default' | 'simple', heightClass?: string, label?: string }) {
    const [value, setValue] = useState(defaultValue);
    return (
        <div>
            {label && <VariableActionLabel label={label} value={value} onUpdate={setValue} className="text-xs text-gray-500 uppercase" />}
            <input type="hidden" name={name} value={value} />
            <RichTextEditor
                value={value}
                onChange={setValue}
                variant={variant}
                heightClass={heightClass}
                placeholder={placeholder}
            />
        </div>
    );
}

export default function EditPollForm({
    poll,
    voteCount = 0
}: {
    poll: PollValues,
    voteCount: number
}) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [instructions, setInstructions] = useState(poll.instructions || "");

    // Izzy Character State
    const [izzyImage, setIzzyImage] = useState(poll.izzy_image || "");
    const [izzyQuote, setIzzyQuote] = useState(poll.izzy_quote || "");
    const [showIzzyModal, setShowIzzyModal] = useState(false);
    // Izzy mode: "this" = single quote for current poll, "previous" = two quotes based on prior result
    const [izzyMode, setIzzyMode] = useState<"this" | "previous">(
        (poll.izzy_quote_correct || poll.izzy_quote_incorrect) ? "previous" : "this"
    );
    const [izzyQuoteCorrect, setIzzyQuoteCorrect] = useState(poll.izzy_quote_correct || "");
    const [izzyQuoteIncorrect, setIzzyQuoteIncorrect] = useState(poll.izzy_quote_incorrect || "");
    const [instructionsCorrect, setInstructionsCorrect] = useState(poll.feedback_correct || "");
    const [instructionsIncorrect, setInstructionsIncorrect] = useState(poll.feedback_incorrect || "");
    const [showDefinitions, setShowDefinitions] = useState(poll.show_definitions || false);
    const [consensus1Majority, setConsensus1Majority] = useState(poll.consensus_1_majority || "");
    const [consensus1Minority, setConsensus1Minority] = useState(poll.consensus_1_minority || "");
    const [consensus2Majority, setConsensus2Majority] = useState(poll.consensus_2_majority || "");
    const [consensus2Minority, setConsensus2Minority] = useState(poll.consensus_2_minority || "");

    // Sort objects by ID (which contains index)
    const objects = poll.poll_objects?.sort((a: any, b: any) => a.id.localeCompare(b.id)) || [];

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setMsg("");

        try {
            await updatePoll(formData);
            setMsg("Poll updated successfully! ✅");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            setMsg("Error updating poll: " + e.message + " ❌");
        }
        setLoading(false);
    }

    return (
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
            {msg && (
                <div className={`p-3 rounded-lg font-bold text-center mb-6 border-2 ${msg.includes("Error") ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                    {msg}
                </div>
            )}

            <VariableCheatSheet />

            <form action={handleSubmit} className="flex flex-col gap-6">
                <input type="hidden" name="pollId" value={poll.id} />

                <div className="flex flex-col gap-2">
                    <label className="font-bold">Title</label>
                    <input name="title" defaultValue={poll.title} required className="border-2 border-black p-3 rounded-xl" />
                </div>

{/* Show Definitions Toggle — ISIT Text and ISIT Text Plus only */}
                {(poll.type === 'isit_text' || poll.type === 'isit_text_plus') && (
                    <div className="flex items-center gap-3">
                        <input type="hidden" name="show_definitions" value={showDefinitions ? "true" : "false"} />
                        <button
                            type="button"
                            onClick={() => setShowDefinitions(v => !v)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showDefinitions ? 'bg-purple-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showDefinitions ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <label className="text-sm font-bold text-gray-700">
                            Show word definitions on hover
                        </label>
                    </div>
                )}
                
                <div className="flex flex-col gap-2">
                    <input type="hidden" name="instructions" value={instructions} />
                    <RichTextEditor
                        label={poll.type === 'multiple_choice' ? 'Question' : 'Instructions (General)'}
                        value={instructions}
                        onChange={setInstructions}
                        placeholder={poll.type === 'multiple_choice' ? "e.g. What is the capital of France?" : "e.g. Assign these words correctly"}
                        heightClass="h-24"
                    />
                </div>

                {poll.type !== 'quad_sorting' && poll.type !== 'multiple_choice' && poll.type !== 'isit_text_plus' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <VariableActionLabel label="Correct Answer Feedback" value={instructionsCorrect} onUpdate={setInstructionsCorrect} className="text-green-700" />
                            <input type="hidden" name="feedback_correct" value={instructionsCorrect} />
                            <RichTextEditor
                                value={instructionsCorrect}
                                onChange={setInstructionsCorrect}
                                placeholder="Message shown when they get it RIGHT"
                                heightClass="h-32"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <VariableActionLabel label="Incorrect Answer Feedback" value={instructionsIncorrect} onUpdate={setInstructionsIncorrect} className="text-red-700" />
                            <input type="hidden" name="feedback_incorrect" value={instructionsIncorrect} />
                            <RichTextEditor
                                value={instructionsIncorrect}
                                onChange={setInstructionsIncorrect}
                                placeholder="Message shown when they get it WRONG"
                                heightClass="h-32"
                            />
                        </div>
                    </div>
                )}

                {poll.type === 'isit_text_plus' && (
                    <div className="space-y-4">
                        <div>
                            <VariableActionLabel label="Left / IS - Majority" value={consensus1Majority} onUpdate={setConsensus1Majority} className="text-green-700" />
                            <input type="hidden" name="consensus_1_majority" value={consensus1Majority} />
                            <RichTextEditor
                                value={consensus1Majority}
                                onChange={setConsensus1Majority}
                                placeholder="If the players votes Obj 1, and the crowd agrees with them."
                                heightClass="h-24"
                            />
                        </div>
                        <div>
                            <VariableActionLabel label="Left / IS - Minority" value={consensus1Minority} onUpdate={setConsensus1Minority} className="text-red-700" />
                            <input type="hidden" name="consensus_1_minority" value={consensus1Minority} />
                            <RichTextEditor
                                value={consensus1Minority}
                                onChange={setConsensus1Minority}
                                placeholder="If the players votes Obj 1, but the crowd disagrees."
                                heightClass="h-24"
                            />
                        </div>
                        <div className="border-t-2 border-gray-100 my-4"></div>
                        <div>
                            <VariableActionLabel label="Right / IT - Majority" value={consensus2Majority} onUpdate={setConsensus2Majority} className="text-green-700" />
                            <input type="hidden" name="consensus_2_majority" value={consensus2Majority} />
                            <RichTextEditor
                                value={consensus2Majority}
                                onChange={setConsensus2Majority}
                                placeholder="If the players votes Obj 2, and the crowd agrees with them."
                                heightClass="h-24"
                            />
                        </div>
                        <div>
                            <VariableActionLabel label="Right / IT - Minority" value={consensus2Minority} onUpdate={setConsensus2Minority} className="text-red-700" />
                            <input type="hidden" name="consensus_2_minority" value={consensus2Minority} />
                            <RichTextEditor
                                value={consensus2Minority}
                                onChange={setConsensus2Minority}
                                placeholder="If the players votes Obj 2, but the crowd disagrees."
                                heightClass="h-24"
                            />
                        </div>
                    </div>
                )}


                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-bold">Stage</label>
                        <select name="stage" defaultValue={poll.stage !== undefined ? poll.stage : 1} required className="border-2 border-black p-3 rounded-xl bg-white">
                            <option value="0">Zero</option>
                            {STAGE_NAMES.map((name, i) => (
                                <option key={i} value={i + 1}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-bold">Level</label>
                        <select name="level" defaultValue={poll.level || 1} required className="border-2 border-black p-3 rounded-xl bg-white">
                            {LEVEL_LETTERS.map((char, i) => (
                                <option key={i} value={i + 1}>{char}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-bold">Order</label>
                        <input
                            name="poll_order"
                            type="number"
                            defaultValue={poll.poll_order || 1}
                            min="1"
                            max="20"
                            required
                            className="border-2 border-black p-3 rounded-xl"
                        />
                    </div>
                </div>

                {/* Objects Editing (Allow if no votes OR if Stage 0) */}
                {voteCount === 0 || poll.stage === 0 ? (
                    <>
                        <hr className="border-black/10" />
                        <div className={`grid gap-6 ${poll.type === 'quad_sorting' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                            {(() => {
                                // Determine number of objects based on type
                                let objectCount = 2;
                                if (poll.type === 'quad_sorting') objectCount = 4;
                                if (poll.type === 'multiple_choice') objectCount = objects.length > 0 ? objects.length : 4;

                                const slots = Array.from({ length: objectCount }, (_, i) => i + 1);

                                // Render simplified list for Multiple Choice
                                if (poll.type === 'multiple_choice') {
                                    return (
                                        <div className="col-span-1 md:col-span-2 flex flex-col gap-3">
                                            {slots.map((num, i) => {
                                                const obj = objects[i];
                                                return (
                                                    <div key={num} className="flex flex-col gap-2 p-4 border-b border-gray-100 last:border-0 bg-gray-50/50 rounded-lg mb-2">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 font-bold text-gray-400 text-sm">#{num}</div>
                                                            <div className="flex-1">
                                                                <input
                                                                    name={`obj${num}_text`}
                                                                    defaultValue={obj?.text}
                                                                    placeholder={`Option ${num}`}
                                                                    required
                                                                    className="w-full border-b border-gray-300 focus:border-black outline-none p-2 bg-transparent font-medium"
                                                                />
                                                                <input type="hidden" name={`obj${num}_id`} value={obj?.id || ""} />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex flex-col items-end">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Points</label>
                                                                    <input
                                                                        type="number"
                                                                        name={`obj${num}_points`}
                                                                        defaultValue={obj?.points ?? 0}
                                                                        min="0"
                                                                        max="20"
                                                                        className="w-16 border border-gray-300 rounded p-1 text-center font-bold"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="pl-12 pr-2">
                                                            <FeedbackEditor
                                                                name={`obj${num}_feedback`}
                                                                defaultValue={obj?.feedback || ""}
                                                                placeholder="Assessment Feedback (Shown if user picks this option)"
                                                                label="Feedback"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                return slots.map((num, i) => {
                                    const obj = objects[i];
                                    return (
                                        <div key={num} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <h3 className="font-bold mb-3">Object {num}</h3>
                                            <div className="flex flex-col gap-3">
                                                {(poll.type === "isit_image" || poll.type === "quad_sorting") && (
                                                    <>
                                                        {obj?.image_url && (
                                                            <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-200 border border-gray-300">
                                                                <img src={obj.image_url} className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <input type="file" name={`obj${num}_image`} accept="image/*" className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-white" />
                                                    </>
                                                )}

                                                <input
                                                    name={`obj${num}_text`}
                                                    defaultValue={obj?.text}
                                                    placeholder={poll.type === "isit_image" ? "Label / Alt Text" : "Word"}
                                                    required
                                                    className="border-2 border-black p-2 rounded-lg"
                                                />

                                                {poll.type !== 'quad_sorting' && (
                                                    <FeedbackEditor
                                                        name={`obj${num}_feedback`}
                                                        defaultValue={obj?.feedback || ""}
                                                        placeholder="Assessment Feedback (Explained when this option is chosen)"
                                                        label="Feedback Message"
                                                    />
                                                )}

                                                {poll.type === 'multiple_choice' ? (
                                                    null // Handled above
                                                ) : (
                                                    poll.type !== 'quad_sorting' && poll.type !== 'isit_text_plus' && (
                                                        <div className="flex gap-4 mt-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="radio" name={`obj${num}_side`} value="IS" defaultChecked={obj?.correct_side === 'IS'} required className="accent-black w-5 h-5" />
                                                                <span className="font-bold">IS</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="radio" name={`obj${num}_side`} value="IT" defaultChecked={obj?.correct_side === 'IT'} required className="accent-black w-5 h-5" />
                                                                <span className="font-bold">IT</span>
                                                            </label>
                                                        </div>
                                                    )
                                                )}
                                                <input type="hidden" name={`obj${num}_id`} value={obj?.id || ""} />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-yellow-800 text-sm">
                        Objects cannot be edited because votes have already been cast.
                    </div>
                )}

                {poll.type === 'quad_sorting' && (
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mt-6">
                        <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <span>Scoring & Feedback Combinations</span>
                            <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Points assigned based on who Object #1 is paired with</span>
                        </h3>
                        <div className="flex flex-col gap-6">
                            {/* Pair 1 & 2 */}
                            <div className="flex flex-col gap-4 p-6 bg-white/50 rounded-xl border border-blue-100">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                                    <label className="text-lg font-bold text-blue-800 uppercase flex items-center gap-2">
                                        Pair 1 & 2
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-blue-600 font-bold uppercase">Points</span>
                                        <input
                                            type="number"
                                            name="score_12"
                                            defaultValue={poll.quad_scores?.['1-2'] ?? 0}
                                            min="0"
                                            className="border-2 border-blue-200 p-2 rounded-lg focus:border-blue-500 outline-none font-bold text-center w-24"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <FeedbackEditor
                                        name="feedback_12"
                                        // @ts-ignore
                                        defaultValue={poll.quad_feedback?.['1-2'] || ""}
                                        placeholder="Feedback for Pair 1&2..."
                                        variant="default"
                                        heightClass="h-32"
                                        label="Feedback"
                                    />
                                </div>
                            </div>

                            {/* Pair 1 & 3 */}
                            <div className="flex flex-col gap-4 p-6 bg-white/50 rounded-xl border border-blue-100">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                                    <label className="text-lg font-bold text-blue-800 uppercase flex items-center gap-2">
                                        Pair 1 & 3
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-blue-600 font-bold uppercase">Points</span>
                                        <input
                                            type="number"
                                            name="score_13"
                                            defaultValue={poll.quad_scores?.['1-3'] ?? 0}
                                            min="0"
                                            className="border-2 border-blue-200 p-2 rounded-lg focus:border-blue-500 outline-none font-bold text-center w-24"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <FeedbackEditor
                                        name="feedback_13"
                                        // @ts-ignore
                                        defaultValue={poll.quad_feedback?.['1-3'] || ""}
                                        placeholder="Feedback for Pair 1&3..."
                                        variant="default"
                                        heightClass="h-32"
                                        label="Feedback"
                                    />
                                </div>
                            </div>

                            {/* Pair 1 & 4 */}
                            <div className="flex flex-col gap-4 p-6 bg-white/50 rounded-xl border border-blue-100">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                                    <label className="text-lg font-bold text-blue-800 uppercase flex items-center gap-2">
                                        Pair 1 & 4
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-blue-600 font-bold uppercase">Points</span>
                                        <input
                                            type="number"
                                            name="score_14"
                                            defaultValue={poll.quad_scores?.['1-4'] ?? 0}
                                            min="0"
                                            className="border-2 border-blue-200 p-2 rounded-lg focus:border-blue-500 outline-none font-bold text-center w-24"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <FeedbackEditor
                                        name="feedback_14"
                                        // @ts-ignore
                                        defaultValue={poll.quad_feedback?.['1-4'] || ""}
                                        placeholder="Feedback for Pair 1&4..."
                                        variant="default"
                                        heightClass="h-32"
                                        label="Feedback"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Izzy Configuration Panel */}
                <div className="bg-purple-50 p-6 rounded-2xl border-2 border-purple-200 shadow-sm mt-8">
                    <h3 className="font-black text-xl text-purple-900 mb-2 flex items-center gap-2">
                        🎭 Izzy Character Overlay
                    </h3>
                    <p className="text-sm text-purple-700 mb-4">
                        Optionally display Izzy alongside this poll with a custom word balloon.
                    </p>

                    {/* Mode toggle */}
                    <div className="flex gap-6 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="izzy_mode"
                                value="this"
                                checked={izzyMode === "this"}
                                onChange={() => setIzzyMode("this")}
                                className="accent-purple-600 w-4 h-4"
                            />
                            <span className="text-sm font-bold text-purple-900">Apply to this poll</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="izzy_mode"
                                value="previous"
                                checked={izzyMode === "previous"}
                                onChange={() => setIzzyMode("previous")}
                                className="accent-purple-600 w-4 h-4"
                            />
                            <span className="text-sm font-bold text-purple-900">Apply to previous poll</span>
                        </label>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Image Selection — same regardless of mode */}
                        <div className="flex flex-col items-start gap-3 w-full md:w-1/3">
                            <label className="block text-sm font-bold text-purple-900 uppercase">Image</label>
                            <input type="hidden" name="izzy_image" value={izzyImage} />

                            {izzyImage ? (
                                <div className="relative w-full h-48 bg-white rounded-xl border-2 border-purple-300 p-2 overflow-hidden flex items-center justify-center">
                                    <img src={`/images/izzy/${izzyImage}`} alt="Izzy Selected" className="max-h-full object-contain" />
                                    <button
                                        type="button"
                                        onClick={() => setIzzyImage("")}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:scale-110"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full h-48 bg-purple-100 rounded-xl border-2 border-dashed border-purple-300 flex items-center justify-center">
                                    <span className="text-purple-400 font-medium">No Image</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setShowIzzyModal(true); }}
                                className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition relative z-0"
                            >
                                Choose Image
                            </button>
                        </div>

                        {/* Quote area — switches based on mode */}
                        <div className="flex-1 flex flex-col gap-4">

                            {izzyMode === "this" ? (
                                /* Single quote for current poll */
                                <div className="flex flex-col gap-2">
                                    <label className="block text-sm font-bold text-purple-900 uppercase">Word Balloon Quote</label>
                                    <input type="hidden" name="izzy_quote" value={izzyQuote} />
                                    {/* Clear the response-aware fields when in "this" mode */}
                                    <input type="hidden" name="izzy_quote_correct" value="" />
                                    <input type="hidden" name="izzy_quote_incorrect" value="" />
                                    <div className="bg-white border-2 border-purple-300 rounded-xl overflow-hidden shadow-inner">
                                        <RichTextEditor
                                            value={izzyQuote}
                                            onChange={setIzzyQuote}
                                            placeholder="Type what Izzy should say here..."
                                            heightClass="min-h-[140px]"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* Two quotes for previous poll result */
                                <>
                                    {/* Clear the single quote when in "previous" mode */}
                                    <input type="hidden" name="izzy_quote" value="" />

                                    <div className="flex flex-col gap-2">
                                        <label className="block text-sm font-bold text-green-800 uppercase flex items-center gap-2">
                                            <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs">✓ Correct / Majority</span>
                                            What Izzy says if they got it right
                                        </label>
                                        <input type="hidden" name="izzy_quote_correct" value={izzyQuoteCorrect} />
                                        <div className="bg-white border-2 border-green-300 rounded-xl overflow-hidden shadow-inner">
                                            <RichTextEditor
                                                value={izzyQuoteCorrect}
                                                onChange={setIzzyQuoteCorrect}
                                                placeholder="e.g. Great instinct! You picked the majority answer..."
                                                heightClass="min-h-[120px]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="block text-sm font-bold text-red-800 uppercase flex items-center gap-2">
                                            <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs">✗ Incorrect / Minority</span>
                                            What Izzy says if they got it wrong
                                        </label>
                                        <input type="hidden" name="izzy_quote_incorrect" value={izzyQuoteIncorrect} />
                                        <div className="bg-white border-2 border-red-300 rounded-xl overflow-hidden shadow-inner">
                                            <RichTextEditor
                                                value={izzyQuoteIncorrect}
                                                onChange={setIzzyQuoteIncorrect}
                                                placeholder="e.g. Interesting choice — you went with the minority..."
                                                heightClass="min-h-[120px]"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {showIzzyModal && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                <h3 className="font-black text-xl">Select Izzy Thumbnail</h3>
                                <button type="button" onClick={() => setShowIzzyModal(false)} className="text-gray-500 hover:text-black font-bold p-2">Close</button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 bg-gray-100">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {['izzy_1_640x960.png', 'izzy_2_640x960.png', 'izzy_3_640x960.png', 'izzy_4_640x960.png', 'izzy_6_640x960.png', 'izzy_7_640x960.png', 'izzy_8_640x960.png', 'izzy_9_640x960.png', 'izzy_11_640x960.png', 'izzy_12_640x960.png', 'izzy_14_640x960.png'].map((img) => (
                                        <button
                                            key={img}
                                            type="button"
                                            onClick={() => {
                                                setIzzyImage(img);
                                                setShowIzzyModal(false);
                                            }}
                                            className={`bg-white rounded-xl p-2 border-4 transition-all hover:scale-105 shadow-sm hover:shadow-md h-40 flex items-center justify-center ${izzyImage === img ? 'border-purple-500 bg-purple-50' : 'border-transparent'}`}
                                        >
                                            <img src={`/images/izzy/${img}`} alt={img} className="max-h-full object-contain drop-shadow-md" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button type="submit" disabled={loading} className="flex-1 bg-black text-white font-bold py-4 rounded-xl hover:scale-105 transition-transform">
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <Link href={`/admin/polls/${poll.id}/delete`} className="flex-none bg-red-100 text-red-600 font-bold px-6 py-4 rounded-xl hover:bg-red-200 transition-colors">
                        Delete
                    </Link>
                </div>
            </form>
        </div>
    );
}

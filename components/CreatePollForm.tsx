"use client";

import { useState, useEffect } from "react";
import { createPoll } from "@/app/admin/poll-actions";
import { STAGE_NAMES, LEVEL_LETTERS } from "@/lib/formatters";
import RichTextEditor from "@/components/RichTextEditor";

export default function CreatePollForm({
    defaultValues
}: {
    defaultValues?: {
        stage?: number;
        level?: number;
        poll_order?: number;
    }
}) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [obj1Side, setObj1Side] = useState("");
    const [obj2Side, setObj2Side] = useState("");

    // New states from diff
    const [title, setTitle] = useState("");
    const [pollType, setPollType] = useState("isit_text");
    const [showDefinitions, setShowDefinitions] = useState(false);
    const [attributeId, setAttributeId] = useState("");

    // Rich Text State
    const [instructions, setInstructions] = useState("");
    const [instructionsCorrect, setInstructionsCorrect] = useState("");
    const [instructionsIncorrect, setInstructionsIncorrect] = useState("");
    const [consensus1Majority, setConsensus1Majority] = useState("");
    const [consensus1Minority, setConsensus1Minority] = useState("");
    const [consensus2Majority, setConsensus2Majority] = useState("");
    const [consensus2Minority, setConsensus2Minority] = useState("");

    // Izzy Character State
    const [izzyImage, setIzzyImage] = useState("");
    const [izzyQuote, setIzzyQuote] = useState("");
    const [showIzzyModal, setShowIzzyModal] = useState(false);

    const handleSideChange = (objNum: 1 | 2, side: "IS" | "IT") => {
        if (objNum === 1) {
            setObj1Side(side);
            setObj2Side(side === "IS" ? "IT" : "IS");
        } else {
            setObj2Side(side);
            setObj1Side(side === "IS" ? "IT" : "IS");
        }
    };
    const [mcResponseCount, setMcResponseCount] = useState(2);
    const [stage, setStage] = useState(defaultValues?.stage !== undefined ? defaultValues.stage : 1);
    const [level, setLevel] = useState(defaultValues?.level || 1);
    const [pollOrder, setPollOrder] = useState(defaultValues?.poll_order || 1);

    useEffect(() => {
        const savedType = localStorage.getItem("lastPollType");
        if (savedType) setPollType(savedType);

        const savedStage = localStorage.getItem("lastStage");
        if (savedStage) {
            setStage(parseInt(savedStage));
        } else if (defaultValues?.stage !== undefined) {
            setStage(defaultValues.stage);
        }

        const savedLevel = localStorage.getItem("lastLevel");
        if (savedLevel) {
            setLevel(parseInt(savedLevel));
        } else if (defaultValues?.level) {
            setLevel(defaultValues.level);
        }
    }, [defaultValues]);

    // handleTypeChange is removed as per diff, onChange directly calls setPollType
    const handleStageChange = (val: string) => {
        const newStage = parseInt(val);
        setStage(newStage);
        localStorage.setItem("lastStage", val);
    };

    const handleLevelChange = (val: string) => {
        const newLevel = parseInt(val);
        setLevel(newLevel);
        localStorage.setItem("lastLevel", val);
    };

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        setMsg("");

        try {
            // Update form data with rich text content
            formData.set("instructions", instructions);
            if (pollType === 'isit_text_plus') {
                formData.append("consensus_1_majority", consensus1Majority);
                formData.append("consensus_1_minority", consensus1Minority);
                formData.append("consensus_2_majority", consensus2Majority);
                formData.append("consensus_2_minority", consensus2Minority);
            } else {
                formData.append("feedback_correct", instructionsCorrect);
                formData.append("feedback_incorrect", instructionsIncorrect);
            }

            await createPoll(formData);
            setMsg("Poll created successfully!");
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const form = document.getElementById("create-poll-form") as HTMLFormElement;
            const setVal = (name: string, val: string) => {
                const el = form.elements.namedItem(name) as HTMLInputElement;
                if (el) el.value = val;
            };

            setVal('title', '');

            // Clear instructions state
            setInstructions("");
            setInstructionsCorrect("");
            setInstructionsIncorrect("");
            setConsensus1Majority("");
            setConsensus1Minority("");
            setConsensus2Majority("");
            setConsensus2Minority("");

            // Clear dynamic inputs logic
            // Because dynamic inputs are controlled by state 'mcResponseCount' but their values are native DOM, they clear if we reset form?
            // Actually, we usually rely on form.reset(), but here we manually clear specific fields.
            // Let's rely on standard clearing for known fields.
            form.reset();

            // Reset dynamic count
            setMcResponseCount(2);

            // Re-apply controlled values to match state
            setPollType(pollType); // This will re-apply the last selected type
            setStage(stage);
            setLevel(level);
            // pollOrder will be updated state, need to reflect in input
            setPollOrder(prev => {
                const next = prev + 1;
                return next <= 20 ? next : 20;
            });
            // We need to wait for render to update input value? No, form.reset clears it to defaultValue. 
            // Controlled inputs: value={pollOrder}.

            // Re-sync specific controlled states:
            setObj1Side("");
            setObj2Side("");

        } catch (e: any) {
            setMsg("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mb-12">
            {msg && (
                <div className={`p-3 rounded-lg font-bold text-center mb-6 border-2 ${msg.includes("Error") ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                    {msg}
                </div>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
                <form id="create-poll-form" action={handleSubmit} className="flex flex-col gap-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Poll Type</label>
                            <select
                                name="type"
                                value={pollType}
                                onChange={(e) => {
                                    setPollType(e.target.value);
                                    localStorage.setItem("lastPollType", e.target.value); // Keep localStorage update
                                }}
                                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-black transition-all outline-none font-bold appearance-none"
                            >
                                <option value="isit_text">ISIT Text</option>
                                <option value="isit_image">ISIT Image</option>
                                <option value="quad_sorting">Quad Sorting</option>
                                <option value="multiple_choice">Multi-choice (points)</option>
                                <option value="isit_text_plus">ISIT Text Plus (Consensus)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Poll Title</label>
                            <input name="title" placeholder="e.g. Hotdog vs Sandwich" required className="border-2 border-black p-3 rounded-xl" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <input type="hidden" name="instructions" value={instructions} />
                        <RichTextEditor
                            label={pollType === 'multiple_choice' ? 'Question' : 'Instructions (General)'}
                            value={instructions}
                            onChange={setInstructions}
                            placeholder={pollType === 'multiple_choice' ? "e.g. What is the capital of France?" : "e.g. Assign these words correctly"}
                        />
                    </div>

                    {pollType !== 'quad_sorting' && pollType !== 'multiple_choice' && pollType !== 'isit_text_plus' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-green-700">Correct Answer Feedback</label>
                                <input type="hidden" name="feedback_correct" value={instructionsCorrect} />
                                <RichTextEditor
                                    value={instructionsCorrect}
                                    onChange={setInstructionsCorrect}
                                    placeholder="Message shown when they get it RIGHT"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-red-700">Incorrect Answer Feedback</label>
                                <input type="hidden" name="feedback_incorrect" value={instructionsIncorrect} />
                                <RichTextEditor
                                    value={instructionsIncorrect}
                                    onChange={setInstructionsIncorrect}
                                    placeholder="Message shown when they get it WRONG"
                                />
                            </div>
                        </div>
                    )}

                    {pollType === 'isit_text_plus' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-2">Left / IS - Majority</label>
                                <div className="bg-white border-2 border-green-500 rounded-xl overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b-2 [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[100px] shadow-sm">
                                    <RichTextEditor value={consensus1Majority} onChange={setConsensus1Majority} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">If the players votes Obj 1, and the crowd agrees with them.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">Left / IS - Minority</label>
                                <div className="bg-white border-2 border-red-500 rounded-xl overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b-2 [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[100px] shadow-sm">
                                    <RichTextEditor value={consensus1Minority} onChange={setConsensus1Minority} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">If the players votes Obj 1, but the crowd disagrees.</p>
                            </div>
                            <div className="border-t-2 border-gray-100 my-4"></div>
                            <div>
                                <label className="block text-sm font-bold mb-2">Right / IT - Majority</label>
                                <div className="bg-white border-2 border-green-500 rounded-xl overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b-2 [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[100px] shadow-sm">
                                    <RichTextEditor value={consensus2Majority} onChange={setConsensus2Majority} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">If the players votes Obj 2, and the crowd agrees with them.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">Right / IT - Minority</label>
                                <div className="bg-white border-2 border-red-500 rounded-xl overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b-2 [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[100px] shadow-sm">
                                    <RichTextEditor value={consensus2Minority} onChange={setConsensus2Minority} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">If the players votes Obj 2, but the crowd disagrees.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Stage</label>
                            <select
                                name="stage"
                                value={stage}
                                onChange={(e) => handleStageChange(e.target.value)}
                                className="border-2 border-black p-3 rounded-xl bg-white"
                            >
                                <option value="0">Zero</option>
                                {STAGE_NAMES.map((name, i) => (
                                    <option key={i} value={i + 1}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="font-bold">Level</label>
                            <select
                                name="level"
                                value={level}
                                onChange={(e) => handleLevelChange(e.target.value)}
                                className="border-2 border-black p-3 rounded-xl bg-white"
                            >
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
                                value={pollOrder}
                                onChange={(e) => {
                                    let val = parseInt(e.target.value);
                                    if (isNaN(val)) val = 1;
                                    setPollOrder(val);
                                }}
                                min="1"
                                max="20"
                                required
                                className="border-2 border-black p-3 rounded-xl"
                                onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                                onBlur={(e) => {
                                    let val = parseInt(e.target.value);
                                    if (val < 1) setPollOrder(1);
                                    if (val > 20) setPollOrder(20);
                                }}
                            />
                        </div>
                    </div>

                    <hr className="border-black/10" />

                    <div className={`grid gap-6 ${pollType === 'quad_sorting' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {pollType === 'quad_sorting' ? (
                            <>
                                {[1, 2, 3, 4].map(num => (
                                    <div key={num} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h3 className="font-bold mb-3">Object {num} (Image)</h3>
                                        <div className="flex flex-col gap-3">
                                            <input type="file" name={`obj${num}_image`} accept="image/*" required className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-white" />
                                            <input name={`obj${num}_text`} placeholder={`Label (e.g. Person ${num})`} required className="border-2 border-black p-2 rounded-lg" />
                                        </div>
                                    </div>
                                ))}
                                <div className="md:col-span-2 mt-4 bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
                                    <h3 className="font-bold text-xl mb-4 text-purple-900">Quad Grouping Scores</h3>
                                    <p className="text-sm text-purple-700 mb-4">Assign points for each pairing combination.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="font-bold text-sm">Obj 1 & 2</label>
                                            <input type="number" name="score_12" defaultValue={0} className="border-2 border-purple-200 p-2 rounded-lg" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="font-bold text-sm">Obj 1 & 3</label>
                                            <input type="number" name="score_13" defaultValue={0} className="border-2 border-purple-200 p-2 rounded-lg" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="font-bold text-sm">Obj 1 & 4</label>
                                            <input type="number" name="score_14" defaultValue={0} className="border-2 border-purple-200 p-2 rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : pollType === 'multiple_choice' ? (
                            <div className="md:col-span-2 flex flex-col gap-4">
                                <div className="flex flex-col gap-3">
                                    {Array.from({ length: mcResponseCount }).map((_, i) => {
                                        const num = i + 1;
                                        return (
                                            <div key={num} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                                <label className="font-bold text-gray-500 w-24 text-sm uppercase">Response {num}</label>
                                                <input
                                                    name={`obj${num}_text`}
                                                    placeholder={`Response Text`}
                                                    required
                                                    className="border-2 border-black p-2 rounded-lg flex-1"
                                                />
                                                <div className="flex flex-col items-end">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Points</label>
                                                    <input
                                                        type="number"
                                                        name={`obj${num}_points`}
                                                        defaultValue={0}
                                                        min="0"
                                                        max="20"
                                                        className="w-16 border border-gray-300 rounded p-1 text-center font-bold"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMcResponseCount(prev => Math.min(prev + 1, 10))}
                                    className="self-start text-sm font-bold text-gray-500 hover:text-black hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors border-2 border-dashed border-gray-300 hover:border-black"
                                >
                                    + Add Response
                                </button>
                                <input type="hidden" name="object_count" value={mcResponseCount} />
                            </div>
                        ) : (
                            <>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h3 className="font-bold mb-3">Object 1 ({pollType === "isit_image" ? "Image" : "Text"})</h3>

                                    <div className="space-y-4">
                                        {pollType === "isit_image" ? (
                                            <>
                                                <input type="file" name="obj1_image" accept="image/*" required className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-white" />
                                                <input name="obj1_text" placeholder="Label / Alt Text" required className="border-2 border-black p-2 rounded-lg" />
                                            </>
                                        ) : (
                                            <input name="obj1_text" placeholder="Word (e.g. Hotdog)" required className="border-2 border-black p-2 rounded-lg" />
                                        )}

                                        {pollType !== "isit_text_plus" && (
                                            <div className="flex gap-4 mt-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="obj1_side"
                                                        value="IS"
                                                        checked={obj1Side === "IS"}
                                                        onChange={() => handleSideChange(1, "IS")}
                                                        required
                                                        className="accent-black w-5 h-5"
                                                    />
                                                    <span className="font-bold">IS</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="obj1_side"
                                                        value="IT"
                                                        checked={obj1Side === "IT"}
                                                        onChange={() => handleSideChange(1, "IT")}
                                                        required
                                                        className="accent-black w-5 h-5"
                                                    />
                                                    <span className="font-bold">IT</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <h3 className="font-bold mb-3">Object 2 ({pollType === "isit_image" ? "Image" : "Text"})</h3>

                                    <div className="space-y-4">
                                        {pollType === "isit_image" ? (
                                            <>
                                                <input type="file" name="obj2_image" accept="image/*" required className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-white" />
                                                <input name="obj2_text" placeholder="Label / Alt Text" required className="border-2 border-black p-2 rounded-lg" />
                                            </>
                                        ) : (
                                            <input name="obj2_text" placeholder="Word (e.g. Sandwich)" required className="border-2 border-black p-2 rounded-lg" />
                                        )}

                                        {pollType !== "isit_text_plus" && (
                                            <div className="flex gap-4 mt-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="obj2_side"
                                                        value="IS"
                                                        checked={obj2Side === "IS"}
                                                        onChange={() => handleSideChange(2, "IS")}
                                                        required
                                                        className="accent-black w-5 h-5"
                                                    />
                                                    <span className="font-bold">IS</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="obj2_side"
                                                        value="IT"
                                                        checked={obj2Side === "IT"}
                                                        onChange={() => handleSideChange(2, "IT")}
                                                        required
                                                        className="accent-black w-5 h-5"
                                                    />
                                                    <span className="font-bold">IT</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Izzy Configuration Panel */}
                    <div className="bg-purple-50 p-6 rounded-2xl border-2 border-purple-200 shadow-sm mt-8">
                        <h3 className="font-black text-xl text-purple-900 mb-2 flex items-center gap-2">
                            🎭 Izzy Character Overlay
                        </h3>
                        <p className="text-sm text-purple-700 mb-6">
                            Optionally display Izzy alongside this poll with a custom word balloon.
                        </p>

                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Image Selection */}
                            <div className="flex flex-col items-start gap-3 w-full md:w-1/3">
                                <label className="block text-sm font-bold text-purple-900 uppercase">Image</label>
                                <input type="hidden" name="izzy_image" value={izzyImage} />

                                {izzyImage ? (
                                    <div className="relative w-full h-48 bg-white rounded-xl border-2 border-purple-300 p-2 overflow-hidden flex items-center justify-center">
                                        {/* Using standard img tag since Next/Image might need explicit w/h which we don't know upfront safely, but we do for static assets so let's use standard img */}
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

                            {/* Quote Input */}
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="block text-sm font-bold text-purple-900 uppercase">Word Balloon Quote</label>
                                <input type="hidden" name="izzy_quote" value={izzyQuote} />
                                <div className="bg-white border-2 border-purple-300 rounded-xl overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b-2 [&_.ql-toolbar]:border-purple-100 [&_.ql-container]:border-none shadow-inner h-full flex flex-col">
                                    <RichTextEditor
                                        value={izzyQuote}
                                        onChange={setIzzyQuote}
                                        placeholder="Type what Izzy should say here..."
                                        heightClass="flex-1 min-h-[140px]"
                                    />
                                </div>
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

                    <button
                        disabled={loading}
                        className="bg-black text-white py-4 rounded-full font-bold hover:scale-105 transition-transform shadow-lg disabled:opacity-50"
                    >
                        {loading ? "Creating..." : "Create Poll"}
                    </button>
                </form>
            </div>
        </div>
    );
}

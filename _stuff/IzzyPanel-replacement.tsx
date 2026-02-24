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

// --- Izzy Dialogue Overlay ---
// Floats fixed in the right margin, outside normal page flow.
// Word bubble sits above Izzy with the tail pointing down toward him.
function IzzyDialogue({ image, quote }: { image: string, quote: string }) {
    return (
        <div className="fixed right-4 bottom-8 z-50 flex flex-col items-center w-44 pointer-events-none select-none animate-in slide-in-from-right-4 fade-in duration-500">

            {/* Word bubble */}
            <div className="relative bg-white border-4 border-purple-500 rounded-3xl px-4 py-3 shadow-xl w-full mb-0">
                <div
                    className="text-xs font-bold text-gray-800 [&>p]:mb-1 last:[&>p]:mb-0 [&_strong]:text-purple-700 leading-snug"
                    dangerouslySetInnerHTML={{ __html: quote }}
                />
                {/* Tail — points downward from bottom-center toward Izzy */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-b-4 border-r-4 border-purple-500 rotate-45 z-0" />
            </div>

            {/* Izzy image */}
            <img
                src={`/images/izzy/${image}`}
                alt="Izzy"
                className="w-32 h-32 object-contain drop-shadow-xl mt-2 hover:scale-105 transition-transform duration-300"
            />
        </div>
    );
}

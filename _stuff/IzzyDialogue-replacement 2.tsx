// --- Izzy Dialogue Overlay ---
// Floats fixed to the right of the main content area, vertically centered.
// Word bubble sits above Izzy with the tail pointing down toward him.
function IzzyDialogue({ image, quote }: { image: string, quote: string }) {
    return (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center w-52 pointer-events-none select-none animate-in slide-in-from-right-4 fade-in duration-500">

            {/* Word bubble */}
            <div className="relative bg-white border-4 border-purple-500 rounded-3xl px-4 py-3 shadow-xl w-full">
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
                className="w-44 h-44 object-contain drop-shadow-xl mt-3 hover:scale-105 transition-transform duration-300"
            />
        </div>
    );
}

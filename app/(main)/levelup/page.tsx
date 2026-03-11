import Link from "next/link";
import { STAGE_NAMES, LEVEL_LETTERS, formatHtmlForDisplay } from "@/lib/formatters";
import { Coins } from "lucide-react";
import { getServerSupabase, getServiceRoleClient } from "@/lib/supabaseServer";
import IsItRails from "@/components/IsItRails";
import { getUserMetrics } from "@/lib/metrics";
import { replaceMessageVariables } from "@/lib/messageUtils";
import { resolveDynamicMessageVariables } from "@/lib/server/messageVariables";

export const dynamic = 'force-dynamic';

export default async function LevelUpPage({
    searchParams,
}: {
    searchParams: Promise<{ stage?: string; level?: string; bonus?: string; dq?: string; correct?: string; total?: string; points?: string; tier?: string }>
}) {
    const { stage, level, bonus, dq, correct, total, points, tier } = await searchParams;

    // Parse stage/level or default to something
    // Parse stage/level or default to something
    const stageNum = stage ? parseInt(stage) : 1;
    const levelNum = level ? parseInt(level) : 1;

    // Points from URL are purely Poll Points
    const pollPoints = points ? parseInt(points) : 0;
    const bonusNum = bonus ? parseInt(bonus) : 0;

    // Use Total Score (Points + Bonus) for Tier Calculation
    const totalScore = pollPoints + bonusNum;

    // --- Message Variables Substitution ---
    // We replace [[AQ]], [[PointTotal]], etc.
    const dqNum = dq ? parseFloat(dq) : 0;
    const correctCount = correct ? parseInt(correct) : 0;
    const totalCount = total ? parseInt(total) : 0;
    const concurrencePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // Formatters
    const stageName = STAGE_NAMES[stageNum - 1] || `Stage ${stageNum}`;
    const levelLetter = LEVEL_LETTERS[levelNum - 1] || `Level ${levelNum}`;

    // Coin Styling Logic
    let coinColorClass = "bg-yellow-400 text-yellow-900"; // Default Gold
    let coinShadowClass = "shadow-[0_0_40px_rgba(250,204,21,0.5)]";

    if (levelNum === 1) { // Level A (Bronze)
        coinColorClass = "bg-orange-400 text-orange-900";
        coinShadowClass = "shadow-[0_0_40px_rgba(251,146,60,0.5)]";
    } else if (levelNum === 2) { // Level B (Silver)
        coinColorClass = "bg-gray-300 text-gray-800";
        coinShadowClass = "shadow-[0_0_40px_rgba(209,213,219,0.5)]";
    }

    // Fetch Level Configuration & User Data
    const supabase = await getServerSupabase();
    const serviceClient = getServiceRoleClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch User Metrics (AQ & Overall DQ) - Real Data
    let awarenessQuotient = 0;
    let overallDq = 0;
    let rawScore = 0;

    if (user) {
        // Pass serviceClient to ensure we can read the profile score
        const metrics = await getUserMetrics(serviceClient, user.id);
        awarenessQuotient = metrics.aq;
        overallDq = metrics.overallDq;
        rawScore = metrics.rawScore;
    }

    // --- Fetch Last Poll Metrics (LastDQ / LastScore) ---
    let lastDq = 0;
    let lastScore = 0;

    if (user) {
        const { data: latestVote } = await supabase
            .from("poll_votes")
            .select("poll_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestVote) {
            const { data: pollVotes } = await supabase
                .from("poll_votes")
                .select("is_correct, points_earned")
                .eq("user_id", user.id)
                .eq("poll_id", latestVote.poll_id);

            const totalVotesForPoll = pollVotes?.length || 0;
            const wrongVotesForPoll = pollVotes?.filter(v => !v.is_correct).length || 0;
            const pointsEarnedForPoll = pollVotes?.reduce((sum, v) => sum + (v.points_earned || 0), 0) || 0;

            lastDq = totalVotesForPoll > 0 ? (wrongVotesForPoll / totalVotesForPoll) : 0;
            lastScore = pointsEarnedForPoll;
        }
    }

    const { data: config } = await supabase
        .from('level_configurations')
        .select('*')
        .eq('stage', stageNum)
        .eq('level', levelNum)
        .single();

    // Default modules if config not found
    const modules = config?.enabled_modules || [];
    const showSideRails = modules.includes('is_it_rails');
    // If any side module is enabled, we use the Rails Layout (3-column)
    const showLayout = showSideRails || modules.includes('level_scores') || modules.includes('your_metrics');

    // Fetch user votes for Rails if enabled
    let railItems: { text: string, side: "IS" | "IT" }[] = [];
    if (showSideRails && user && modules.includes('is_it_rails')) { // Added safety check
        // Fetch ALL votes for this user up to now
        const { data: votes } = await supabase
            .from('poll_votes')
            .select(`
                chosen_side,
                poll_id,
                poll_objects (
                    text
                )
            `)
            .eq('user_id', user.id);

        if (votes) {
            railItems = votes.map((v: any) => ({
                id: v.poll_id || v.id, // Use poll_id or fallback
                side: v.chosen_side,
                text: v.poll_objects?.text || "Unknown"
            }));
        }
    }

    // Custom instructions or default
    let instructionsText = config?.instructions || "Fantastic work! You've mastered this level.";

    // Apply substitution to main instructions
    if (user) {
        try {
            instructionsText = await resolveDynamicMessageVariables(supabase, instructionsText, user.id, { stage: stageNum, level: levelNum });
        } catch (e) {
            console.error("Error substituting Q&A variables for instructions:", e);
        }
    }

    instructionsText = replaceMessageVariables(instructionsText, {
        dq: overallDq,
        aq: awarenessQuotient,
        pointTotal: rawScore,
        lastDq,
        lastScore
    });

    // --- Dynamic Messaging Logic ---
    let computedTier = "C"; // Default fallback
    let matchedTierMessage = "";

    if (config?.score_tiers) {
        // Type definition for safety
        type ScoreTier = { min_score: number; tier: string; title?: string; message: string };
        const tiers = config.score_tiers as unknown as ScoreTier[];

        // Sort descending by min_score
        const sortedTiers = [...tiers].sort((a, b) => b.min_score - a.min_score);

        // Find match using Awareness Quotient (AQ)
        const matched = sortedTiers.find(t => awarenessQuotient >= t.min_score);

        if (matched) {
            computedTier = matched.tier;
            let tMessage = matched.message;

            if (user && tMessage) {
                try {
                    tMessage = await resolveDynamicMessageVariables(supabase, tMessage, user.id, { stage: stageNum, level: levelNum });
                } catch (e) {
                    console.error("Error substituting Q&A for score tier message:", e);
                }
            }

            matchedTierMessage = replaceMessageVariables(tMessage, {
                dq: overallDq,
                aq: awarenessQuotient,
                pointTotal: rawScore,
                lastDq,
                lastScore
            });
        }
    }

    // Override searchParams tier with computed tier if config exists (ensures consistency)
    const displayTier = config?.score_tiers ? computedTier : (tier || 'C');

    // Level Scores Content (Now 1/3 Left Column)
    const LevelScoresContent = modules.includes('level_scores') ? (
        <div key="level-scores" className="w-full h-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md">
            <h3 className="text-xl font-black mb-8 uppercase tracking-wider text-white border-b border-white/20 pb-4">Level Scores</h3>

            <div className="flex flex-col gap-10">
                {/* 1. Concurrence */}
                <div>
                    <div className="text-5xl font-black text-white leading-none mb-2">
                        {correctCount}/{totalCount} <span className="text-2xl text-gray-400">({concurrencePct}%)</span>
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Concurrence</div>
                </div>

                {/* 2 & 3. Points Row */}
                <div className="flex flex-row justify-center items-center gap-6 border-t border-b border-white/10 py-6">
                    {/* Poll Pts */}
                    <div>
                        <div className="text-3xl font-black text-yellow-300 leading-none mb-2">
                            +{pollPoints} Pts
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Poll Pts</div>
                    </div>

                    {/* Bonus Pts */}
                    {bonusNum > 0 && (
                        <div className="pl-6 border-l border-white/10">
                            <div className="text-3xl font-black text-yellow-300 leading-none mb-2">
                                +{bonusNum} Pts
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Bonus Pts</div>
                        </div>
                    )}
                </div>

                {/* 4. AQ & DQ Row */}
                <div className="flex flex-col gap-8">
                    {/* AQ (Green) */}
                    <div>
                        <div className="text-6xl font-black text-green-400 leading-none mb-2">
                            {awarenessQuotient}
                        </div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                    </div>

                    {/* DQ (Red) */}
                    <div>
                        <div className="text-6xl font-black text-red-400 leading-none mb-2">
                            {dqNum.toFixed(2)}
                        </div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    // Metrics Module Content (Right Rail)
    const MetricsContent = modules.includes('your_metrics') ? (
        <div key="metrics-content" className="w-full min-h-[260px] flex flex-col justify-start bg-black/40 rounded-[2rem] p-4 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md">
            <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-2">Your Metrics</h3>

            <div className="flex flex-col gap-4">
                {/* Status */}
                <div>
                    <div className="text-lg font-black text-white leading-none mb-1">
                        Stage {stageName} • Level {levelLetter}
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Status</div>
                </div>

                {/* Awareness Quotient (Total Score) */}
                <div>
                    <div className="text-5xl font-black text-yellow-400 leading-none mb-1">{awarenessQuotient}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                </div>

                {/* DQ - Overall */}
                <div>
                    <div className={`text-3xl font-black leading-none mb-1 ${overallDq < 0.2 ? "text-green-400" : overallDq < 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                        {overallDq.toFixed(2)}
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                </div>
            </div>
        </div>
    ) : null;

    // Default height shim matching the modules (approx height)
    // We can use the same structure with invisible content to ensure exact height match.
    // We add a key here to ensure uniqueness if used, though ideally we should use cloneElement with key if repeated.
    // However, since we defined it as a const, reusing it might be the issue. 
    // Let's make it a Component Function instead so we can instantiate it with keys.
    const PlaceholderContent = (key: string) => (
        <div key={key} className="w-full min-h-[260px] flex flex-col justify-start bg-transparent rounded-[2rem] p-4 border-4 border-transparent text-center invisible">
            <h3 className="text-sm font-black mb-4 border-b pb-2">Placeholder</h3>
            <div className="flex flex-col gap-4">
                <div><div className="text-lg mb-1">Stage One • Level A</div><div className="text-[9px]">Text</div></div>
                <div><div className="text-5xl mb-1">0</div><div className="text-[9px]">Text</div></div>
                <div><div className="text-3xl mb-1">0.00</div><div className="text-[9px]">Text</div></div>
            </div>
        </div>
    );

    // Logic: If one side module is present, force the other side to have a placeholder to maintain alignment.
    let LeftContent = null;
    let RightContent = null;

    if (modules.includes('level_scores')) {
        LeftContent = LevelScoresContent;
    } else if (modules.includes('your_metrics')) {
        LeftContent = PlaceholderContent('left-placeholder');
    }

    if (modules.includes('your_metrics')) {
        RightContent = MetricsContent;
    } else if (modules.includes('level_scores')) {
        RightContent = PlaceholderContent('right-placeholder');
    }

    // Layout Logic
    const showPathSelector = modules.includes('path_selector');
    const pathConfig = config?.path_selector_config || {};

    const MainContent = (
        <div className="relative z-10 w-full animate-in zoom-in duration-500">
            {/* TOP ROW: 1/3 and 2/3 Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch mb-8">

                {/* 1/3 Left - Level Scores */}
                <div className="md:col-span-1 flex flex-col items-stretch">
                    {LeftContent || LevelScoresContent}
                </div>

                {/* 2/3 Right - You Leveled Up / Instructions */}
                <div className="md:col-span-2 flex flex-col items-center justify-center gap-6 bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md">
                    <div className="flex justify-center mb-2">
                        <div className={`${coinColorClass} p-6 rounded-full ${coinShadowClass} animate-bounce`}>
                            <Coins size={64} className="opacity-80" />
                        </div>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-black mb-0 tracking-tighter text-center">YOU LEVELED UP!</h1>
                    <p className="text-xl lg:text-3xl text-gray-400 font-bold mb-4 uppercase tracking-wide text-center">
                        Stage {stageName} • Level {levelLetter} Complete
                    </p>

                    {/* Score Tier Content OR Instructions */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full text-left">
                        <div
                            className="text-lg lg:text-xl font-medium leading-relaxed mb-0 w-full"
                            dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(matchedTierMessage || instructionsText) }}
                        />
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW: Path Selector & Izzy */}
            <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8 max-w-7xl mx-auto w-full bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md">

                {/* Izzy Area */}
                <div className="hidden md:flex flex-col justify-end items-center md:w-1/3">
                    <img src="/images/izzy/izzy_6_640x960.png" alt="Izzy" className="object-contain max-h-[400px] w-auto h-auto drop-shadow-2xl" />
                </div>

                {/* Path Selector / Continue Area */}
                <div className="flex-1 flex flex-col h-full items-center justify-center text-center">
                    {showPathSelector ? (
                        <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Path Selector Instructions */}
                            {pathConfig.instructions && (
                                <div className="bg-[#cceeff] rounded-2xl p-6 mb-8 w-full shadow-lg border-2 border-[#4169E1]">
                                    <p className="text-lg text-black font-medium leading-relaxed">
                                        {pathConfig.instructions}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                <Link href={pathConfig.path1?.url || "#"} className="group relative bg-black/40 hover:bg-white hover:text-black border-2 border-white/20 hover:border-white p-6 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/0 opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">Option 1</span>
                                    <span className="text-2xl font-black leading-tight">{pathConfig.path1?.label || "Path 1"}</span>
                                </Link>
                                <Link href={pathConfig.path2?.url || "#"} className="group relative bg-black/40 hover:bg-yellow-400 hover:text-black border-2 border-white/20 hover:border-white p-6 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
                                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/0 opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">Option 2</span>
                                    <span className="text-2xl font-black leading-tight">{pathConfig.path2?.label || "Path 2"}</span>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <Link
                            href="/poll"
                            className="block w-full max-w-xl mx-auto bg-white text-black py-4 rounded-full text-2xl font-black hover:scale-105 hover:bg-yellow-400 transition-all shadow-xl"
                        >
                            CONTINUE
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 relative overflow-x-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black z-0 opacity-50"></div>

            <div className="relative z-10 w-full">
                {MainContent}
            </div>
        </div>
    );
}


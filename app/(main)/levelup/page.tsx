import Link from "next/link";
import { STAGE_NAMES, formatHtmlForDisplay } from "@/lib/formatters";
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
    const levelLetter = `Level ${levelNum}`;

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
    const showSideRails = modules.includes('is_it_rails') || modules.includes('is_rail') || modules.includes('it_rail');
    // If any side module is enabled, we use the Rails Layout (3-column)
    const showLayout = showSideRails || modules.includes('level_scores') || modules.includes('your_metrics');

    // Fetch user votes for Rails if enabled
    let railItems: { text: string, side: "IS" | "IT" }[] = [];
    if (showSideRails && user) {
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

    // ── Module renderers ────────────────────────────────────────────────────

    const renderModule = (moduleId: string | null, key: string, col_content?: string) => {
        if (!moduleId) return null;
        switch (moduleId) {
            case 'level_scores':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-8 uppercase tracking-wider text-white border-b border-white/20 pb-4">Level Scores</h3>
                        <div className="flex flex-col gap-10">
                            <div>
                                <div className="text-5xl font-black text-white leading-none mb-2">
                                    {correctCount}/{totalCount} <span className="text-2xl text-gray-400">({concurrencePct}%)</span>
                                </div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Concurrence</div>
                            </div>
                            <div className="flex flex-row justify-center items-center gap-6 border-t border-b border-white/10 py-6">
                                <div>
                                    <div className="text-3xl font-black text-yellow-300 leading-none mb-2">+{pollPoints} Pts</div>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Poll Pts</div>
                                </div>
                                {bonusNum > 0 && (
                                    <div className="pl-6 border-l border-white/10">
                                        <div className="text-3xl font-black text-yellow-300 leading-none mb-2">+{bonusNum} Pts</div>
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Bonus Pts</div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-8">
                                <div>
                                    <div className="text-6xl font-black text-green-400 leading-none mb-2">{awarenessQuotient}</div>
                                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                                </div>
                                <div>
                                    <div className="text-6xl font-black text-red-400 leading-none mb-2">{dqNum.toFixed(2)}</div>
                                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'your_metrics':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-4 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md overflow-hidden">
                        <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-2">Your Metrics</h3>
                        <div className="flex flex-col gap-4">
                            <div>
                                <div className="text-lg font-black text-white leading-none mb-1">Stage {stageName} • Level {levelLetter}</div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Status</div>
                            </div>
                            <div>
                                <div className="text-5xl font-black text-yellow-400 leading-none mb-1">{awarenessQuotient}</div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Awareness Quotient</div>
                            </div>
                            <div>
                                <div className={`text-3xl font-black leading-none mb-1 ${overallDq < 0.2 ? "text-green-400" : overallDq < 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                                    {overallDq.toFixed(2)}
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Deviance Quotient</div>
                            </div>
                        </div>
                    </div>
                );

            case 'is_it_rails':
                return (
                    <div key={key} className="w-full w-full overflow-hidden">
                        <IsItRails items={railItems} />
                    </div>
                );

            case 'leaderboard':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-6 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-3">🏆 Leaderboard</h3>
                        <p className="text-gray-400 text-sm">Coming soon</p>
                    </div>
                );

            case 'conditional_content': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                const criteria: string = cfg.criteria || 'scoring_group';
                const branches: { condition: string; operator?: string; label: string; content: string }[] = cfg.branches || [];
                
                // ── Resolve the current value for this criteria ──────────────
                let resolvedValue: string = '';

                switch (criteria) {
                    case 'scoring_group':
                        resolvedValue = computedTier; // 'A' | 'B' | 'C'
                        break;
                    case 'agreed_majority':
                        // correctCount > 0 means they agreed with majority on at least one question
                        resolvedValue = correctCount > 0 ? 'yes' : 'no';
                        break;
                    case 'aq_range': {
                        // Evaluate top-down, first match wins, using the branch's operator
                        const evalOp = (op: string, val: number, aq: number) => {
                            switch (op) {
                                case '>':  return aq > val;
                                case '>=': return aq >= val;
                                case '<':  return aq < val;
                                case '<=': return aq <= val;
                                case '=':  return aq === val;
                                default:   return aq >= val;
                            }
                        };
                        const match = branches.find(b => {
                            if (!b.condition) return false;
                            const val = Number(b.condition);
                            return !isNaN(val) && evalOp(b.operator || '>=', val, awarenessQuotient);
                        });
                        resolvedValue = match?.condition ?? '';
                        break;
                    }
                    case 'concurrence': {
                        // Branches have numeric conditions (min %). Sort descending, first match wins.
                        const sorted = [...branches].sort((a, b) => Number(b.condition) - Number(a.condition));
                        const match = sorted.find(b => {
                            const min = Number(b.condition);
                            return !isNaN(min) && concurrencePct >= min;
                        });
                        resolvedValue = match?.condition ?? '';
                        break;
                    }
                    case 'current_stage':
                        resolvedValue = String(stageNum);
                        break;
                    default:
                        resolvedValue = '';
                }

                // ── Find matching branch ─────────────────────────────────────
                // For aq_range, resolvedValue is the winning branch's condition — match by index
                // For other criteria, match by condition value
                let matchedBranch: typeof branches[0] | undefined;
                if (criteria === 'aq_range') {
                    const evalOp2 = (op: string, val: number, aq: number) => {
                        switch (op) {
                            case '>':  return aq > val;
                            case '>=': return aq >= val;
                            case '<':  return aq < val;
                            case '<=': return aq <= val;
                            case '=':  return aq === val;
                            default:   return aq >= val;
                        }
                    };
                    matchedBranch = branches.find(b => {
                        if (!b.condition) return false;
                        const val = Number(b.condition);
                        return !isNaN(val) && evalOp2(b.operator || '>=', val, awarenessQuotient);
                    });
                } else {
                    matchedBranch = branches.find(b => b.condition === resolvedValue);
                }
                // Fallback to 'default' branch if no exact match
                if (!matchedBranch) matchedBranch = branches.find(b => b.condition === 'default');

                if (!matchedBranch?.content) return null;

                return (
                    <div key={key} className="w-full w-full flex flex-col bg-black/40 rounded-[2rem] p-8 border-4 border-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.2)] backdrop-blur-md overflow-hidden">
                        {matchedBranch.label && matchedBranch.label !== matchedBranch.condition && (
                            <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-sky-300 border-b border-sky-400/30 pb-3">
                                {matchedBranch.label}
                            </h3>
                        )}
                        <div
                            className="text-white text-base leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(matchedBranch.content) }}
                        />
                    </div>
                );
            }

            case 'awareness_assessment': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                const html = cfg.html || '';
                return (
                    <div key={key} className="w-full w-full flex flex-col bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-6 uppercase tracking-wider text-white border-b border-white/20 pb-4 flex items-center gap-2">
                            🧠 Awareness Assessment
                        </h3>
                        <div
                            className="text-white text-base leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(html || config?.awareness_assessment || '') }}
                        />
                    </div>
                );
            }

            case 'scoring_groups': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};

                // Build tiers from module config, falling back to level config score_tiers
                type ScoreTier = { min_score: number; tier: string; message: string };
                const levelTiers = (config?.score_tiers as unknown as ScoreTier[] | undefined) ?? [];

                const getTierMessage = (letter: string, cfgMsg: string | undefined) => {
                    if (cfgMsg) return cfgMsg;
                    return levelTiers.find(t => t.tier === letter)?.message || '';
                };

                // Determine which group the user is in
                const tierAMin = cfg.tier_a_min ?? levelTiers.find(t => t.tier === 'A')?.min_score ?? 90;
                const tierBMin = cfg.tier_b_min ?? levelTiers.find(t => t.tier === 'B')?.min_score ?? 70;

                const userTier = awarenessQuotient >= tierAMin ? 'A' : awarenessQuotient >= tierBMin ? 'B' : 'C';
                const userMessage = getTierMessage(userTier, userTier === 'A' ? cfg.tier_a_message : userTier === 'B' ? cfg.tier_b_message : cfg.tier_c_message);

                const tierColors = { A: 'border-green-400 bg-green-400/10', B: 'border-yellow-400 bg-yellow-400/10', C: 'border-gray-400 bg-gray-400/10' };
                const tierLabels = { A: '🏆 Group A', B: '⭐ Group B', C: '🤔 Group C' };

                return (
                    <div key={key} className={`w-full w-full flex flex-col bg-black/40 rounded-[2rem] p-8 border-4 backdrop-blur-md overflow-hidden ${tierColors[userTier as keyof typeof tierColors]}`}>
                        <div className="flex items-center justify-between mb-4 border-b border-white/20 pb-4">
                            <h3 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                                {tierLabels[userTier as keyof typeof tierLabels]}
                            </h3>
                            <div className="text-3xl font-black text-white">{awarenessQuotient}</div>
                        </div>
                        {userMessage && (
                            <div
                                className="text-white text-base leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(userMessage) }}
                            />
                        )}
                    </div>
                );
            }

            case 'aggregate_results':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-6 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-3">📋 Poll Results</h3>
                        <p className="text-gray-400 text-sm">Aggregate results</p>
                    </div>
                );

            case 'discussion_forum':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-start bg-black/40 rounded-[2rem] p-6 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-3">💬 Discussion</h3>
                        <p className="text-gray-400 text-sm">Forum coming soon</p>
                    </div>
                );

            case 'path_selector':
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-center bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden">
                        {pathConfig.instructions && (
                            <div className="bg-[#cceeff] rounded-2xl p-6 mb-6 w-full shadow-lg border-2 border-[#4169E1]">
                                <p className="text-lg text-black font-medium leading-relaxed">{pathConfig.instructions}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <Link href={pathConfig.path1?.url || "#"} className="group relative bg-black/40 hover:bg-white hover:text-black border-2 border-white/20 hover:border-white p-6 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
                                <span className="text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">Option 1</span>
                                <span className="text-xl font-black leading-tight">{pathConfig.path1?.label || "Path 1"}</span>
                            </Link>
                            <Link href={pathConfig.path2?.url || "#"} className="group relative bg-black/40 hover:bg-yellow-400 hover:text-black border-2 border-white/20 hover:border-white p-6 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
                                <span className="text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">Option 2</span>
                                <span className="text-xl font-black leading-tight">{pathConfig.path2?.label || "Path 2"}</span>
                            </Link>
                        </div>
                    </div>
                );



            case 'level_up_hero': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                return (
                    <div key={key} className="w-full w-full flex flex-col items-center justify-center gap-6 bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden">
                        <div className="flex justify-center mb-2">
                            <div className={`${coinColorClass} p-6 rounded-full ${coinShadowClass} animate-bounce`}>
                                <Coins size={64} className="opacity-80" />
                            </div>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black mb-0 tracking-tighter text-center">YOU LEVELED UP!</h1>
                        {cfg.subheading ? (
                            <p className="text-xl lg:text-2xl text-gray-300 font-bold uppercase tracking-wide text-center">{cfg.subheading}</p>
                        ) : (
                            <p className="text-xl lg:text-3xl text-gray-400 font-bold mb-4 uppercase tracking-wide text-center">
                                Stage {stageName} • Level {levelLetter} Complete
                            </p>
                        )}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full text-left">
                            <div
                                className="text-lg lg:text-xl font-medium leading-relaxed w-full"
                                dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(cfg.body || matchedTierMessage || instructionsText) }}
                            />
                        </div>
                        {!modules.includes('path_selector') && (
                            <Link href="/poll" className="block w-full max-w-xl mx-auto bg-white text-black py-4 rounded-full text-2xl font-black hover:scale-105 hover:bg-yellow-400 transition-all shadow-xl text-center">
                                CONTINUE
                            </Link>
                        )}
                    </div>
                );
            }

            case 'izzy': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                const pose = cfg.pose || 'izzy_6_640x960.png';
                const balloon = cfg.balloon || '';
                const pos = cfg.balloonPos || 'top-center';

                // Translate 3x3 grid position to absolute placement classes
                const [vPos, hPos] = pos.split('-') as [string, string];
                const vClass = vPos === 'top' ? 'top-4' : vPos === 'mid' ? 'top-1/2 -translate-y-1/2' : 'bottom-4';
                const hClass = hPos === 'left' ? 'left-2 text-left' : hPos === 'right' ? 'right-2 text-right' : 'left-1/2 -translate-x-1/2 text-center';
                const wClass = 'w-1/3';

                // Tail points toward Izzy who is bottom-center
                // For top rows tail points down, for mid/bot rows tail points up
                const tailClass = vPos === 'bot'
                    ? 'absolute -top-3 ' + (hPos === 'left' ? 'left-6' : hPos === 'right' ? 'right-6' : 'left-1/2 -translate-x-1/2') + ' w-0 h-0 border-l-[10px] border-r-[10px] border-b-[12px] border-l-transparent border-r-transparent border-b-black'
                    : 'absolute -bottom-3 ' + (hPos === 'left' ? 'left-6' : hPos === 'right' ? 'right-6' : 'left-1/2 -translate-x-1/2') + ' w-0 h-0 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-black';

                return (
                    <div key={key} className="w-full w-full flex flex-col items-center justify-end bg-transparent overflow-hidden relative min-h-[300px]">
                        {balloon && (
                            <div className={`absolute ${vClass} ${hClass} ${wClass} bg-white text-black text-sm font-bold rounded-2xl p-4 shadow-xl border-2 border-black z-10`}>
                                <span>{balloon}</span>
                                <div className={tailClass} />
                            </div>
                        )}
                        <img src={pose?.startsWith("http") || pose?.startsWith("/images") ? pose : `/images/izzy/${pose}`} alt="Izzy" className="object-contain max-h-[420px] w-auto drop-shadow-2xl" />
                    </div>
                );
            }

            case 'poll': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                return (
                    <div key={key} className="w-full w-full flex flex-col justify-center bg-black/40 rounded-[2rem] p-6 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden">
                        <h3 className="text-xl font-black mb-4 uppercase tracking-wider text-white border-b border-white/20 pb-3">🗳️ Poll</h3>
                        <p className="text-gray-400 text-sm">{cfg.pollSource === 'specific' ? `Poll #${cfg.pollId || '—'}` : cfg.pollSource === 'previous' ? 'Previous poll' : 'Current poll'}</p>
                    </div>
                );
            }

            case 'is_rail':
                return (
                    <div key={key} className="w-full w-full overflow-hidden">
                        <div className="flex-1 rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] bg-white text-black h-full">
                            <div className="bg-black text-white border-black p-3 text-center border-b-4">
                                <h3 className="text-3xl font-black leading-none tracking-tighter">IS</h3>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[70vh]">
                                <div className="flex justify-between text-xs font-bold mb-4 px-2 border-b pb-2 text-gray-400 border-gray-200">
                                    <span>WORD</span><span>%</span>
                                </div>
                                <ul className="space-y-2">
                                    {railItems.filter(i => i.side === "IS").slice(0, 50).map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center font-bold text-sm">
                                            <span className="truncate mr-2 max-w-[12ch]">{item.text}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white">100%</span>
                                        </li>
                                    ))}
                                    {railItems.filter(i => i.side === "IS").length === 0 && <li className="italic text-center py-10 text-xs text-gray-400">No items yet.</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                );

            case 'it_rail':
                return (
                    <div key={key} className="w-full w-full overflow-hidden">
                        <div className="flex-1 rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] bg-black text-white h-full">
                            <div className="bg-white text-black border-white p-3 text-center border-b-4">
                                <h3 className="text-3xl font-black leading-none tracking-tighter">IT</h3>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[70vh]">
                                <div className="flex justify-between text-xs font-bold mb-4 px-2 border-b pb-2 text-gray-500 border-gray-800">
                                    <span>WORD</span><span>%</span>
                                </div>
                                <ul className="space-y-2">
                                    {railItems.filter(i => i.side === "IT").slice(0, 50).map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center font-bold text-sm">
                                            <span className="truncate mr-2 max-w-[12ch]">{item.text}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-black">100%</span>
                                        </li>
                                    ))}
                                    {railItems.filter(i => i.side === "IT").length === 0 && <li className="italic text-center py-10 text-xs text-gray-600">No items yet.</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                );

            case 'tip': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                return (
                    <div key={key} className="w-full w-full flex flex-col bg-[#fffbe6] rounded-[2rem] p-6 border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)] overflow-hidden">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">💡</span>
                            <h3 className="text-lg font-black text-yellow-900 uppercase tracking-wider">{cfg.title || "Tip"}</h3>
                        </div>
                        <p className="text-yellow-900 font-medium leading-relaxed text-sm">{cfg.body || ""}</p>
                    </div>
                );
            }

            case 'quest': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                return (
                    <div key={key} className="w-full w-full flex flex-col bg-black/40 rounded-[2rem] p-6 border-4 border-orange-400 shadow-[0_0_30px_rgba(251,146,60,0.3)] backdrop-blur-md overflow-hidden">
                        <div className="flex items-center gap-2 mb-3 border-b border-orange-400/30 pb-3">
                            <span className="text-2xl">⚔️</span>
                            <h3 className="text-lg font-black text-orange-300 uppercase tracking-wider">Quest</h3>
                        </div>
                        <p className="text-xl font-black text-white mb-2">{cfg.title || "Side Mission"}</p>
                        <p className="text-gray-300 font-medium leading-relaxed text-sm mb-4">{cfg.description || ""}</p>
                        {(cfg.reward || cfg.rewardLabel) && (
                            <div className="mt-auto flex items-center gap-3 bg-orange-400/20 rounded-xl p-3 border border-orange-400/30">
                                <span className="text-2xl">🎁</span>
                                <div>
                                    <p className="text-orange-300 font-black text-lg leading-none">{cfg.reward ? `+${cfg.reward} pts` : ""}</p>
                                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{cfg.rewardLabel || "Reward"}</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            case 'rich_text':
                return (
                    <div key={key} className="w-full bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden text-white">
                        {/* content stored in col.content — rendered as HTML */}
                        <div className="prose prose-invert max-w-none" />
                    </div>
                );

            case 'image': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                if (!cfg.src) return (
                    <div key={key} className="w-full flex items-center justify-center bg-black/40 rounded-[2rem] border-4 border-dashed border-white/30 overflow-hidden min-h-[200px]">
                        <span className="text-gray-500 text-sm font-medium">🖼️ No image URL set</span>
                    </div>
                );
                const imgEl = (
                    <img
                        src={cfg.src}
                        alt={cfg.alt || ""}
                        className={`w-full h-full rounded-[2rem] ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[cfg.fit as string] || 'object-cover'}`}
                        style={{ minHeight: '200px', maxHeight: '500px' }}
                    />
                );
                return (
                    <div key={key} className="w-full w-full overflow-hidden rounded-[2rem] border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                        {cfg.href
                            ? <a href={cfg.href} target="_blank" rel="noopener noreferrer" className="block w-full h-full">{imgEl}</a>
                            : imgEl
                        }
                    </div>
                );
            }

            case 'video': {
                const cfg = col_content ? (() => { try { return JSON.parse(col_content); } catch { return {}; } })() : {};
                // Normalise YouTube / Vimeo URL to embed URL
                const getEmbedUrl = (url: string): string | null => {
                    if (!url) return null;
                    // youtu.be/ID or youtube.com/watch?v=ID or youtube.com/embed/ID
                    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
                    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
                    // vimeo.com/ID
                    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
                    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
                    return null;
                };
                const embedUrl = getEmbedUrl(cfg.url || '');
                if (!embedUrl) return (
                    <div key={key} className="w-full flex items-center justify-center bg-black/40 rounded-[2rem] border-4 border-dashed border-white/30 overflow-hidden min-h-[200px]">
                        <span className="text-gray-500 text-sm font-medium">🎬 {cfg.url ? 'Unrecognised video URL' : 'No video URL set'}</span>
                    </div>
                );
                return (
                    <div key={key} className="w-full flex flex-col overflow-hidden rounded-[2rem] border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full rounded-t-[2rem]"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                        {cfg.caption && (
                            <div className="bg-black/60 px-6 py-3 text-sm text-gray-300 font-medium text-center rounded-b-[2rem]">
                                {cfg.caption}
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return null;
        }
    };

    // ── Column width → Tailwind class ───────────────────────────────────────

    const colWidthClass = (width: string) => {
        switch (width) {
            case "1/1":  return "w-full";
            case "1/2":  return "w-full md:w-1/2";
            case "1/3":  return "w-full md:w-1/3";
            case "2/3":  return "w-full md:w-2/3";
            case "1/6":  return "w-full md:w-1/6";
            case "2/6":  return "w-full md:w-1/3";
            case "4/6":  return "w-full md:w-2/3";
            case "5/6":  return "w-full md:w-5/6";
            default:     return "w-full";
        }
    };

    // ── The always-present hero card ─────────────────────────────────────────

    const HeroCard = (
        <div className="flex flex-col items-center justify-center gap-6 bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md w-full overflow-hidden">
            <div className="flex justify-center mb-2">
                <div className={`${coinColorClass} p-6 rounded-full ${coinShadowClass} animate-bounce`}>
                    <Coins size={64} className="opacity-80" />
                </div>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black mb-0 tracking-tighter text-center">YOU LEVELED UP!</h1>
            <p className="text-xl lg:text-3xl text-gray-400 font-bold mb-4 uppercase tracking-wide text-center">
                Stage {stageName} • Level {levelLetter} Complete
            </p>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full text-left">
                <div
                    className="text-lg lg:text-xl font-medium leading-relaxed w-full"
                    dangerouslySetInnerHTML={{ __html: formatHtmlForDisplay(matchedTierMessage || instructionsText) }}
                />
            </div>
            {/* Continue button lives here when no path_selector is in layout */}
            {!modules.includes('path_selector') && (
                <Link
                    href="/poll"
                    className="block w-full max-w-xl mx-auto bg-white text-black py-4 rounded-full text-2xl font-black hover:scale-105 hover:bg-yellow-400 transition-all shadow-xl text-center"
                >
                    CONTINUE
                </Link>
            )}
        </div>
    );

    // ── Decide rendering mode ────────────────────────────────────────────────

    const layoutConfigRaw = config?.layout_config as { rows?: { id: string; columns: { width: string; moduleId: string | null }[] }[] } | null;
    const layoutConfig = (layoutConfigRaw && Array.isArray(layoutConfigRaw.rows) && layoutConfigRaw.rows.length >= 0) ? layoutConfigRaw as { rows: { id: string; columns: { width: string; moduleId: string | null }[] }[] } : null;
    const pathConfig = config?.path_selector_config || {};
    const showPathSelector = modules.includes('path_selector');

    // ── DYNAMIC MODE: layout_config present ─────────────────────────────────

    const DynamicLayout = layoutConfig ? (
        <div className="relative z-10 w-full animate-in zoom-in duration-500 flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Rows from layout_config — no hardcoded hero, builder controls everything */}
            {(layoutConfig?.rows ?? []).map((row, rowIndex) => (
                <div key={row.id ?? rowIndex} className="flex flex-col md:flex-row gap-6 items-start w-full">
                    {row.columns.map((col, colIndex) => {
                        // Support both new modules array and legacy single moduleId
                        const colMods = col.modules && col.modules.length > 0
                            ? col.modules
                            : (col.moduleId ? [{ moduleId: col.moduleId, content: col.content }] : []);
                        return (
                            <div key={colIndex} className={`${colWidthClass(col.width)} flex flex-col gap-4`}>
                                {colMods.map((mod: any, modIndex: number) =>
                                    renderModule(mod.moduleId, `${rowIndex}-${colIndex}-${modIndex}`, mod.content)
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    ) : null;

    // ── LEGACY MODE: no layout_config, fall back to old hard-coded layout ───

    const LegacyLayout = (
        <div className="relative z-10 w-full animate-in zoom-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch mb-8">
                <div className="md:col-span-1 flex flex-col items-stretch">
                    {modules.includes('level_scores') ? renderModule('level_scores', 'legacy-scores') : null}
                </div>
                <div className="md:col-span-2 flex flex-col items-stretch">
                    {HeroCard}
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8 max-w-7xl mx-auto w-full bg-black/40 rounded-[2rem] p-8 border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-md">
                <div className="hidden md:flex flex-col justify-end items-center md:w-1/3">
                    <img src="/images/izzy/izzy_6_640x960.png" alt="Izzy" className="object-contain max-h-[400px] w-auto h-auto drop-shadow-2xl" />
                </div>
                <div className="flex-1 flex flex-col h-full items-center justify-center text-center">
                    {showPathSelector
                        ? renderModule('path_selector', 'legacy-path')
                        : (
                            <Link href="/poll" className="block w-full max-w-xl mx-auto bg-white text-black py-4 rounded-full text-2xl font-black hover:scale-105 hover:bg-yellow-400 transition-all shadow-xl">
                                CONTINUE
                            </Link>
                        )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 relative overflow-x-hidden">
            <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black z-0 opacity-50"></div>
            <div className="relative z-10 w-full">
                {DynamicLayout ?? LegacyLayout}
            </div>
        </div>
    );
}



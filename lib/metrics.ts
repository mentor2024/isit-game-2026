import { SupabaseClient } from "@supabase/supabase-js";

export type UserMetrics = {
    pollsTaken: number;
    pollsIncorrect: number;
    overallDq: number;
    rawScore: number;
    aq: number;
};

export async function getUserMetrics(supabase: SupabaseClient, userId: string): Promise<UserMetrics> {
    // 1. Get raw score from profile
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('score')
        .eq('id', userId)
        .single();

    if (error) {
        console.error(`[getUserMetrics] Error fetching profile for ${userId}:`, error);
    } else {
        console.log(`[getUserMetrics] Fetched score for ${userId}:`, profile?.score);
    }

    const rawScore = profile?.score || 0;

    // 2. Get Poll Statistics
    // We need "Total Polls Taken" and "Polls where at least one vote was wrong".
    // Efficient way:
    // Fetch all votes for user, select poll_id, is_correct
    // Then process in JS (simpler than complex SQL if dataset isn't huge yet)
    // Or doing a count?
    // Let's do a grouped query if possible, or just select needed fields.
    // Since we need to know "Is ANY vote for this poll incorrect?", grouped by poll_id.

    const { data: votes } = await supabase
        .from('poll_votes')
        .select('poll_id, is_correct, points_earned, polls(stage, level)')
        .eq('user_id', userId);

    const pollMap = new Map<string, boolean>(); // poll_id -> is_fully_correct
    const stageZeroLevelPoints = new Map<number, number>(); // level -> sum of points

    if (votes) {
        votes.forEach(v => {
            // AQ Calculation: Track points earned per level in Stage 0
            // @ts-ignore
            if (v.polls?.stage === 0) {
                // @ts-ignore
                const lvl = v.polls.level || 1;
                const earned = v.points_earned || 0;
                stageZeroLevelPoints.set(lvl, (stageZeroLevelPoints.get(lvl) || 0) + earned);
            }

            const currentStatus = pollMap.get(v.poll_id);
            // If we haven't seen this poll, assume true (innocent until proven guilty)
            // But wait, v.is_correct is for a side. 
            // If v.is_correct is false, the POLL is incorrect.
            // If v.is_correct is true, we keep checking.

            if (currentStatus === undefined) {
                pollMap.set(v.poll_id, v.is_correct);
            } else {
                // If already false, stay false. If true, becomes v.is_correct.
                if (currentStatus === true && v.is_correct === false) {
                    pollMap.set(v.poll_id, false);
                }
            }
        });
    }

    const pollsTaken = pollMap.size;
    let pollsIncorrect = 0;

    pollMap.forEach((isCorrect) => {
        if (!isCorrect) pollsIncorrect++;
    });

    const overallDq = pollsTaken > 0 ? (pollsIncorrect / pollsTaken) : 0;

    // 3. Total Possible Points Calculation
    // We need to know the max potential points for every poll the user has interacted with.
    // Fetch unique poll IDs from votes.
    const pollIds = Array.from(pollMap.keys());
    let totalPossiblePoints = 0;

    if (pollIds.length > 0) {
        // Fetch Poll Details to calculate max points
        // We need: Type, Stage, Level (for Binary), and Object Points (for MC)
        const { data: polls } = await supabase
            .from('polls')
            .select(`
                id, 
                type, 
                stage, 
                level, 
                poll_objects (points),
                quad_scores
            `)
            .in('id', pollIds);

        polls?.forEach(poll => {
            if (poll.type === 'multiple_choice') {
                // Max possible is the object with highest points
                const maxObjPoints = Math.max(...(poll.poll_objects?.map((o: any) => o.points || 0) || [0]));
                totalPossiblePoints += maxObjPoints;
            } else if (poll.type === 'quad_sorting') {
                // Quad Sorting: Max is the highest value in quad_scores map
                let maxQuad = 0;
                if (poll.quad_scores && typeof poll.quad_scores === 'object') {
                    const scores = Object.values(poll.quad_scores) as number[];
                    if (scores.length > 0) {
                        maxQuad = Math.max(...scores);
                    }
                }
                // If no scores defined, fallback
                if (maxQuad === 0) {
                    const stageMult = Math.max(1, poll.stage || 1);
                    const levelMult = Math.max(1, poll.level || 1);
                    maxQuad = (2 * stageMult * levelMult);
                }
                totalPossiblePoints += maxQuad;
            } else {
                // Binary / ISIT
                // Check if objects have points
                const objPointsSum = poll.poll_objects?.reduce((sum: number, o: any) => sum + (o.points || 0), 0) || 0;

                if (objPointsSum > 0) {
                    totalPossiblePoints += objPointsSum;
                } else {
                    // Fallback Formula (Matches submitVote logic)
                    const stageMult = Math.max(1, poll.stage || 1);
                    const levelMult = Math.max(1, poll.level || 1);
                    totalPossiblePoints += (2 * stageMult * levelMult);
                }
            }
        });
    }

    // New AQ Formula (User Request #1166): Average of AQ per level in Stage Zero
    let aq = 50; // Default baseline
    if (stageZeroLevelPoints.size > 0) {
        let totalAQ = 0;
        stageZeroLevelPoints.forEach(pts => {
            let levelAQ = 50 + pts;
            if (levelAQ > 100) levelAQ = 100; // Cap each level's AQ at 100
            totalAQ += levelAQ;
        });
        aq = totalAQ / stageZeroLevelPoints.size;
    }

    // Cap overall at 100 just in case
    if (aq > 100) aq = 100;

    // Integer for display
    aq = Math.round(aq);

    return {
        pollsTaken,
        pollsIncorrect,
        overallDq,
        rawScore, // Keeps Profile Score (with bonuses)
        aq
    };
}

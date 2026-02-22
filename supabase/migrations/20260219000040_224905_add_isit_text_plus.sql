-- Add isit_text_plus poll type support
-- No schema change needed for polls table (type is text, not enum)
-- Add feedback_majority and feedback_minority columns to polls
ALTER TABLE public.polls
    ADD COLUMN IF NOT EXISTS feedback_majority text,
    ADD COLUMN IF NOT EXISTS feedback_minority text;

-- New RPC: vote_isit_plus
-- Scoring: majority = 1pt × stage multiplier, tie = 0, minority = 0
-- DQ slot is tracked but calculation is TBD
CREATE OR REPLACE FUNCTION public.vote_isit_plus(
    p_is_word_id text,
    p_it_word_id text,
    p_poll_id uuid,
    p_chosen_side text   -- 'IS' or 'IT'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_already_voted boolean;
    v_stage int;
    v_level int;
    v_stage_multiplier int;
    v_is_votes int;
    v_it_votes int;
    v_total_votes int;
    v_majority_side text;
    v_is_majority boolean;
    v_points int := 0;
    v_chosen_object_id text;
    v_other_object_id text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate objects belong to poll
    IF NOT EXISTS (SELECT 1 FROM poll_objects WHERE id = p_is_word_id AND poll_id = p_poll_id) THEN
        RAISE EXCEPTION 'IS object does not belong to poll';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM poll_objects WHERE id = p_it_word_id AND poll_id = p_poll_id) THEN
        RAISE EXCEPTION 'IT object does not belong to poll';
    END IF;

    -- Determine which object the user chose
    IF p_chosen_side = 'IS' THEN
        v_chosen_object_id := p_is_word_id;
        v_other_object_id  := p_it_word_id;
    ELSE
        v_chosen_object_id := p_it_word_id;
        v_other_object_id  := p_is_word_id;
    END IF;

    -- Check if already voted
    SELECT EXISTS (
        SELECT 1 FROM public.poll_votes
        WHERE poll_id = p_poll_id AND user_id = v_uid
    ) INTO v_already_voted;

    -- Get poll metadata
    SELECT stage, level INTO v_stage, v_level
    FROM public.polls WHERE id = p_poll_id;

    v_stage := COALESCE(v_stage, 1);
    v_level := COALESCE(v_level, 1);

    -- Stage multiplier: stage 0 counts as 1
    v_stage_multiplier := CASE WHEN v_stage < 1 THEN 1 ELSE v_stage END;

    -- Upsert votes (IS row and IT row)
    -- For isit_text_plus: is_correct is NULL (no pre-defined answer)
    INSERT INTO poll_votes (poll_id, user_id, selected_object_id, chosen_side, is_correct)
    VALUES (p_poll_id, v_uid, p_is_word_id, 'IS', NULL)
    ON CONFLICT (user_id, poll_id, selected_object_id)
    DO UPDATE SET chosen_side = excluded.chosen_side;

    INSERT INTO poll_votes (poll_id, user_id, selected_object_id, chosen_side, is_correct)
    VALUES (p_poll_id, v_uid, p_it_word_id, 'IT', NULL)
    ON CONFLICT (user_id, poll_id, selected_object_id)
    DO UPDATE SET chosen_side = excluded.chosen_side;

    -- Count votes AFTER inserting (includes this user's vote)
    -- Count distinct users who chose each side
    SELECT
        COUNT(DISTINCT CASE WHEN chosen_side = 'IS' THEN user_id END),
        COUNT(DISTINCT CASE WHEN chosen_side = 'IT' THEN user_id END)
    INTO v_is_votes, v_it_votes
    FROM poll_votes
    WHERE poll_id = p_poll_id;

    v_total_votes := v_is_votes + v_it_votes;

    -- Determine majority side (tie = NULL = no majority)
    v_majority_side := CASE
        WHEN v_is_votes > v_it_votes THEN 'IS'
        WHEN v_it_votes > v_is_votes THEN 'IT'
        ELSE NULL  -- tie
    END;

    -- Did user vote with majority?
    v_is_majority := (v_majority_side IS NOT NULL AND p_chosen_side = v_majority_side);

    -- Calculate points (only on first vote)
    IF NOT v_already_voted THEN
        IF v_is_majority THEN
            v_points := 1 * v_stage_multiplier;
        ELSE
            v_points := 0;
        END IF;

        -- Award points to user profile
        IF v_points > 0 THEN
            UPDATE public.user_profiles
            SET score = COALESCE(score, 0) + v_points
            WHERE id = v_uid;
        END IF;

        -- Record points_earned on the vote rows
        UPDATE public.poll_votes
        SET points_earned = v_points
        WHERE poll_id = p_poll_id AND user_id = v_uid;
    END IF;

    -- Return result
    RETURN json_build_object(
        'majority_side',    v_majority_side,
        'is_majority',      v_is_majority,
        'is_votes',         v_is_votes,
        'it_votes',         v_it_votes,
        'total_votes',      v_total_votes,
        'points_awarded',   v_points,
        'already_voted',    v_already_voted,
        'stage_multiplier', v_stage_multiplier
    );
END
$$;

COMMENT ON FUNCTION public.vote_isit_plus IS
    'Consensus-based voting for isit_text_plus polls.
     Majority earns stage-multiplied points. Tie = 0 points for all.
     DQ (Deviance Quotient) tracking: TBD.';

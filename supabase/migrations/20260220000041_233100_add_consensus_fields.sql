-- Migration: Add Consensus Feedback Columns
-- Removes feedback_majority and feedback_minority and replaces them with explicitly targeted 4-quadrant feedback.

ALTER TABLE polls
DROP COLUMN IF EXISTS feedback_majority,
DROP COLUMN IF EXISTS feedback_minority;

ALTER TABLE polls
ADD COLUMN IF NOT EXISTS consensus_1_majority TEXT Default NULL,
ADD COLUMN IF NOT EXISTS consensus_1_minority TEXT Default NULL,
ADD COLUMN IF NOT EXISTS consensus_2_majority TEXT Default NULL,
ADD COLUMN IF NOT EXISTS consensus_2_minority TEXT Default NULL;

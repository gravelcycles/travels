-- Trip-wide metadata and newest-first pages share one ordered, covering index.
-- Read receipts remain local to the browser; no visitor read state is stored.
CREATE INDEX IF NOT EXISTS comments_journey_order
  ON comments(journey_id, created_at, id, photo_id)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

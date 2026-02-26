CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id text,
  event_name text NOT NULL,
  page       text,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role inserts" ON events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE INDEX idx_events_name_created ON events (event_name, created_at DESC);
CREATE INDEX idx_events_visitor ON events (visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calendar_events (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisation(id),
  site_id integer REFERENCES sites(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time text,
  end_time text,
  created_by integer REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendar_events_org_dates_idx
  ON calendar_events (organisation_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisation(id),
  dashboard text NOT NULL,
  items jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_org_view
  ON dashboard_layouts (organisation_id, dashboard);
CREATE TABLE IF NOT EXISTS dashboard_layout_drafts (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisation(id),
  dashboard text NOT NULL,
  staff_id integer NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  base_revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_draft_org_view_staff
  ON dashboard_layout_drafts (organisation_id, dashboard, staff_id);

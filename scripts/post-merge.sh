#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Rename the legacy access_settings unique index to the name drizzle-kit expects.
# Without this rename drizzle-kit detects a mismatch and prompts interactively,
# causing the post-merge setup to time out (stdin is closed during setup).
psql "$DATABASE_URL" -c "
  DO \$\$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'access_settings_role_key') THEN
      ALTER INDEX access_settings_role_key RENAME TO access_settings_role_unique;
    END IF;
  END \$\$;
"

# Drizzle asks whether populated tables may be truncated when it detects
# constraint changes. Post-merge runs with stdin closed, so explicitly answer
# "no" rather than allowing the command to wait forever.
printf 'n\n' | pnpm --filter db push-force

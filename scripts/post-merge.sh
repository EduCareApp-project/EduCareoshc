#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Development only: establish policy dependencies and legacy ownership first.
# These commands must never be used for a production database.
node lib/db/scripts/setup-tenant-development.mjs --development
python3 scripts/push-schema-safe.py
node lib/db/scripts/setup-tenant-development.mjs --development

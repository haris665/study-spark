#!/usr/bin/env bash
set -euo pipefail

# Reinstall the locked dependency tree after merges, then make sure the
# imported project still produces a deployable build.
npm ci --no-audit --no-fund
npm run build
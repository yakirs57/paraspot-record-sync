#!/bin/sh
set -euxo pipefail

echo "[root] PWD is: $(pwd)"
echo "List root:"
ls -la
echo "List ios/:"
ls -la ios || true
echo "List ios/App/:"
ls -la ios/App || true
echo "List ci_scripts/:"
ls -la ci_scripts || true


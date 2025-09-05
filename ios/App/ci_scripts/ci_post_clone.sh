#!/bin/sh
set -euxo pipefail

# ----- locate the repo root robustly (don’t rely on CI_WORKSPACE) -----
# If this script is in ios/App/ci_scripts, go three levels up to repo root.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd || true)"
if [ ! -f "$REPO_ROOT/package.json" ]; then
  # If that didn’t land us at the root (because the script is at repo root), try current dir
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$REPO_ROOT"

# ----- ensure Homebrew is on PATH (works for Intel & Apple Silicon) -----
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# ----- ensure Node / npm exist; install Node 20 via Homebrew if needed -----
if ! command -v npm >/dev/null 2>&1; then
  brew update
  # Prefer a pinned major; adjust if you need a different one
  if brew info node@20 >/dev/null 2>&1; then
    brew install node@20 || true
    # Add node@20 to PATH (Intel vs ARM locations)
    [ -d /opt/homebrew/opt/node@20/bin ] && export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    [ -d /usr/local/opt/node@20/bin ] && export PATH="/usr/local/opt/node@20/bin:$PATH"
  else
    # Fallback to latest node if node@20 isn’t available
    brew install node
  fi
fi
node -v
npm -v

# ----- build web (Vite) -----
npm ci
npm run build

# ----- copy Capacitor web assets into iOS app -----
npx cap copy ios

# ----- install CocoaPods in the folder that matches your Pods path -----
cd ios/App
pod repo update
pod install

# Sanity: show the xcconfig Cloud was missing
ls -la "Pods/Target Support Files/Pods-App" || true


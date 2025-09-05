#!/bin/sh
set -euxo pipefail

# Always start from the workspace root that Xcode Cloud uses
cd "$CI_WORKSPACE"

# 1) Build your Vite app
npm ci
npm run build

# 2) Copy web assets into iOS app
npx cap copy ios

# 3) Install CocoaPods for the iOS app (IMPORTANT: run inside ios/App)
cd ios/App
pod repo update
pod install

# (Optional) sanity – show that the xcconfig now exists
ls -la "Pods/Target Support Files/Pods-App" || true

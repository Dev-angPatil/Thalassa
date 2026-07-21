#!/bin/bash
set -e

echo "=== Matsya Drishti Mobile Setup & Verification Script ==="

# 1. Setup PATH to include local Flutter SDK
export PATH="$PATH:/home/deu/development/flutter/bin"

if ! command -v flutter &> /dev/null; then
    echo "ERROR: Flutter SDK not found on PATH or directory structure is incomplete."
    exit 1
fi

echo "Flutter SDK found: $(flutter --version | head -n 1)"

# 2. Navigate to mobile app directory
cd "$(dirname "$0")/mobile"

echo "Running flutter pub get..."
flutter pub get

echo "Running flutter analyze..."
flutter analyze

echo "=== Verification Completed Successfully! ==="

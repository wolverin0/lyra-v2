#!/bin/bash
# Lyra v2 Stop Quality Gate - Non-blocking warnings at session end
# Checks for console.log in modified files and uncommitted changes
# Works on macOS and Linux

warnings=()

# Get git-modified JS/TS files
modified_files=$(git diff --name-only HEAD 2>/dev/null)
if [ -z "$modified_files" ]; then
    modified_files=$(git diff --name-only --cached 2>/dev/null)
fi

if [ -n "$modified_files" ]; then
    while IFS= read -r file; do
        if [[ "$file" =~ \.(js|ts|jsx|tsx)$ ]] && [ -f "$file" ]; then
            count=$(grep -c 'console\.\(log\|debug\|info\)(' "$file" 2>/dev/null || echo 0)
            if [ "$count" -gt 0 ]; then
                warnings+=("console.log found in $file ($count occurrences)")
            fi
        fi
    done <<< "$modified_files"
fi

# Check for uncommitted changes
status=$(git status --porcelain 2>/dev/null)
if [ -n "$status" ]; then
    count=$(echo "$status" | wc -l | tr -d ' ')
    warnings+=("Uncommitted changes: $count file(s)")
fi

# Output warnings
if [ ${#warnings[@]} -gt 0 ]; then
    echo ""
    echo "[QUALITY GATE]"
    for w in "${warnings[@]}"; do
        echo "  ! $w"
    done
fi

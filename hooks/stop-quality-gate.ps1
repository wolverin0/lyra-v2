# Lyra v2 Stop Quality Gate - Non-blocking warnings at session end
# Checks for console.log in modified files and uncommitted changes
# Works on Windows with PowerShell

$warnings = @()

# Get git-modified JS/TS files
try {
    $modifiedFiles = git diff --name-only HEAD 2>$null
    if (-not $modifiedFiles) {
        $modifiedFiles = git diff --name-only --cached 2>$null
    }
    if ($modifiedFiles) {
        $jstsFiles = $modifiedFiles | Where-Object { $_ -match '\.(js|ts|jsx|tsx)$' }
        foreach ($file in $jstsFiles) {
            if (Test-Path $file) {
                $matches = Select-String -Path $file -Pattern 'console\.(log|debug|info)\(' -AllMatches
                if ($matches) {
                    $warnings += "console.log found in $file ($($matches.Count) occurrences)"
                }
            }
        }
    }
} catch {}

# Check for uncommitted changes
try {
    $status = git status --porcelain 2>$null
    if ($status) {
        $count = ($status | Measure-Object).Count
        $warnings += "Uncommitted changes: $count file(s)"
    }
} catch {}

# Output warnings
if ($warnings.Count -gt 0) {
    Write-Output ""
    Write-Output "[QUALITY GATE]"
    foreach ($w in $warnings) {
        Write-Output "  ! $w"
    }
}

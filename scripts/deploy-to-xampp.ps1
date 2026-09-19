# Syncs the project into a local XAMPP webroot for testing against real
# Apache (mod_rewrite, .htaccess) instead of `php -S`, which never reads
# .htaccess at all and therefore misses that whole class of bug.
#
# Does NOT rebuild the React app - run "npm run build" yourself first if you
# changed frontend code. Never overwrites data/database/uploads if they
# already exist in the target (your real local data is left alone) - delete
# them in the target folder yourself if you want a clean reset.
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-to-xampp.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-to-xampp.ps1 -Target "C:\xampp\htdocs\myname"

param(
    [string]$Target = "C:\xampp\htdocs\rogleskogen"
)

$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$src\dist\index.html")) {
    Write-Host "No build found - run 'npm run build' first." -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Path $Target -Force | Out-Null

# Frontend + .htaccess: always refreshed from the latest build.
Get-ChildItem $Target -Exclude data, database, uploads, .env | Remove-Item -Recurse -Force
Copy-Item "$src\dist\*" $Target -Recurse -Force
Copy-Item "$src\.htaccess" "$Target\.htaccess" -Force

# Backend code: always refreshed, nothing here to preserve.
if (Test-Path "$Target\server") { Remove-Item "$Target\server" -Recurse -Force }
Copy-Item "$src\server" "$Target\server" -Recurse -Force

# Installationsguiden: samma sak - alltid färsk. Testa den mot en TOM
# database\app.sqlite (byt namn på/radera den i $Target om du vill köra
# guiden på nytt lokalt; se dess egen "redan installerad"-spärr).
if (Test-Path "$Target\install") { Remove-Item "$Target\install" -Recurse -Force }
Copy-Item "$src\install" "$Target\install" -Recurse -Force
Copy-Item "$src\.env.example" "$Target\.env.example" -Force

# Data/database/uploads: copied only the first time - never touches existing
# content in the target.
foreach ($dir in @("data", "database", "uploads")) {
    if (-not (Test-Path "$Target\$dir")) {
        Copy-Item "$src\$dir" "$Target\$dir" -Recurse -Force
        Write-Host "Copied $dir/ (did not exist in target)."
    }
}

if (-not (Test-Path "$Target\.env")) {
    $envLines = @(
        "APP_ENV=development",
        "DATA_DIR=",
        "UPLOADS_DIR=",
        "DB_PATH=",
        "PETITION_URL=",
        "CORS_ORIGINS=",
        "RESEND_API_KEY=",
        "ANTHROPIC_API_KEY="
    )
    Set-Content -Path "$Target\.env" -Value $envLines -Encoding utf8
    Write-Host "Created .env (APP_ENV=development shows error details - switch to production before going live)."
}

Write-Host "Done: $Target" -ForegroundColor Green

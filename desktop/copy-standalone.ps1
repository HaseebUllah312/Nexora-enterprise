$src = "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\frontend\.next\standalone"
$dst = "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\desktop\frontend-standalone"
$static = "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\frontend\.next\static"
$pub = "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\frontend\public"

if (Test-Path $dst) {
    Write-Host "Removing old frontend-standalone..."
    Remove-Item -Recurse -Force $dst
}

Write-Host "Copying standalone server..."
Copy-Item -Recurse -Path $src -Destination $dst

Write-Host "Copying static assets..."
$staticDst = Join-Path $dst ".next\static"
if (-not (Test-Path $staticDst)) { New-Item -ItemType Directory -Force -Path $staticDst | Out-Null }
Copy-Item -Recurse -Path "$static\*" -Destination $staticDst -Force

if (Test-Path $pub) {
    Write-Host "Copying public folder..."
    $pubDst = Join-Path $dst "public"
    if (-not (Test-Path $pubDst)) { New-Item -ItemType Directory -Force -Path $pubDst | Out-Null }
    Copy-Item -Recurse -Path "$pub\*" -Destination $pubDst -Force
}

Write-Host "COPY_COMPLETE"

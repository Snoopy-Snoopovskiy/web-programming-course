$tag = "quiz-backend:release-" + (Get-Date -Format "yyyyMMddHHmmss")
Write-Host "Building image $tag"
docker build -t $tag .
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# Сохраняем тег для rollback
$tag | Out-File -FilePath ".last-release-tag" -Encoding utf8

Write-Host "Stopping old containers"
docker compose down

Write-Host "Starting new version"
docker compose up -d

Write-Host "Waiting for app..."
Start-Sleep -Seconds 5

Write-Host "Healthcheck..."
$response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
if ($response.StatusCode -eq 200) {
    Write-Host "Release successful! Image: $tag" -ForegroundColor Green
} else {
    Write-Host "Healthcheck failed!" -ForegroundColor Red
    exit 1
}
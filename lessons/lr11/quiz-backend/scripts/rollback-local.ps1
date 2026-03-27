$tag = Get-Content ".last-release-tag" -Raw
Write-Host "Rolling back to $tag"
docker compose down
docker run --rm -d -p 3000:3000 --env-file .env --name quiz-rollback $tag
Start-Sleep -Seconds 5
$response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
if ($response.StatusCode -eq 200) {
    Write-Host "Rollback successful!" -ForegroundColor Green
} else {
    Write-Host "Rollback failed!" -ForegroundColor Red
    exit 1
}
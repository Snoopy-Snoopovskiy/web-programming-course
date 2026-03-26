$tag = "quiz-backend:release-" + (Get-Date -Format "yyyyMMddHHmmss")

Write-Host "Building image $tag"
docker build -t $tag .

Write-Host "Stopping old containers"
docker compose down

Write-Host "Starting new version"
docker compose up -d

Write-Host "Waiting for app..."
Start-Sleep -Seconds 5

Write-Host "Healthcheck..."
Invoke-WebRequest -Uri "http://localhost:3000/health"
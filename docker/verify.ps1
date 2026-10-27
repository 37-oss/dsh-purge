# 隔离校验（Windows / PowerShell）：把仓库只读挂进容器跑，绝不碰本机 dsh
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "这台机器没有 docker。改走云端：push 到 GitHub，看 Actions 里的 ci 工作流。" -ForegroundColor Yellow
  exit 1
}

docker build -f docker/Dockerfile -t dsh-purge-verify:local .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker run --rm --network none -v "${PWD}:/w:ro" -w /w dsh-purge-verify:local
exit $LASTEXITCODE

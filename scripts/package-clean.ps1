#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('win', 'linux', 'mac', 'all')]
    [string]$Platform = 'win'
)

$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIY-Linux-Shell 清理打包脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] 检查并停止 DIY-Linux-Shell 进程..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -eq "DIY-Linux-Shell" } -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "  发现 $($processes.Count) 个 DIY-Linux-Shell 进程:" -ForegroundColor Yellow
    foreach ($process in $processes) {
        Write-Host "    - PID: $($process.Id)" -ForegroundColor Gray
    }
    Write-Host "  正在终止进程..." -ForegroundColor Yellow
    Stop-Process -Name "DIY-Linux-Shell" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  [OK] 进程已终止" -ForegroundColor Green
} else {
    Write-Host "  [OK] 未发现运行中的进程" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] 清理输出目录..." -ForegroundColor Yellow
$releaseDir = Join-Path $PSScriptRoot "..\release"
$winUnpackedDir = Join-Path $releaseDir "win-unpacked"

if (Test-Path $winUnpackedDir) {
    Write-Host "  删除 $winUnpackedDir" -ForegroundColor Gray
    try {
        Remove-Item -Path $winUnpackedDir -Recurse -Force -ErrorAction Stop
        Write-Host "  [OK] 输出目录已清理" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] 清理失败：$($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [OK] 输出目录不存在，无需清理" -ForegroundColor Green
}

Write-Host ""
$packageCommand = switch ($Platform) {
    'win'   { 'package:win' }
    'linux' { 'package:linux' }
    'mac'   { 'package:mac' }
    'all'   { 'package:all' }
}

Write-Host "[3/4] 执行打包命令：npm run $packageCommand" -ForegroundColor Yellow
Write-Host ""
Write-Host "[4/4] 开始打包..." -ForegroundColor Cyan
Write-Host ""

npm run $packageCommand

$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "  [OK] 打包成功！" -ForegroundColor Green
    Write-Host "  输出目录：$releaseDir" -ForegroundColor Gray
} else {
    Write-Host "  [ERROR] 打包失败 (退出码：$exitCode)" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit $exitCode
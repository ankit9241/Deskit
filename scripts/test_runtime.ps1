$exe = Resolve-Path "$PSScriptRoot\..\src-tauri\target\x86_64-pc-windows-msvc\debug\deskit.exe"
$proc = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 3
$isRunning = !$proc.HasExited
$id = $proc.Id
Write-Output "Process started: ID=$id, Running=$isRunning"
if ($isRunning) {
    Stop-Process -Id $id -Force
    Write-Output "Process terminated cleanly after startup verification."
} else {
    Write-Output ("Process exited with exit code: " + $proc.ExitCode)
}

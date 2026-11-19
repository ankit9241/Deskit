$msvcBin = 'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64'
$msvcLib = 'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\lib\x64'
$winSdkLib = 'C:\Users\ankit\Desktop\pinned\winsdk\lib_x64'
$winSdkBin = 'C:\Users\ankit\Desktop\pinned\winsdk\bin'
$rustBin = 'C:\Users\ankit\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin'

$env:PATH = "$winSdkBin;$msvcBin;$rustBin;$env:PATH"
$env:LIB = "$winSdkLib;$msvcLib;$env:LIB"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "$msvcBin\link.exe"
$env:SQLITE3_LIB_DIR = "$winSdkLib"
$env:SQLITE3_STATIC = "0"
$env:RC = "$winSdkBin\rc.exe"
$env:RC_x86_64_pc_windows_msvc = "$winSdkBin\rc.exe"
$env:CC = "$msvcBin\cl.exe"
$env:CXX = "$msvcBin\cl.exe"

# Terminate any previously running pinned.exe process
Get-Process pinned -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Ensure binary target file is unlocked before cargo runs
$targetExe = "$PSScriptRoot\..\src-tauri\target\x86_64-pc-windows-msvc\debug\pinned.exe"
if (Test-Path $targetExe) {
    try {
        $fs = [System.IO.File]::Open($targetExe, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite)
        $fs.Dispose()
    } catch {
        $oldExe = "$targetExe.old"
        Remove-Item $oldExe -Force -ErrorAction SilentlyContinue
        Move-Item $targetExe $oldExe -Force -ErrorAction SilentlyContinue
    }
}

# Ensure manifest exists at target locations
$manifestSource = "$PSScriptRoot\..\src-tauri\app_manifest.xml"
if (-not (Test-Path $manifestSource)) {
    $manifestSource = "$PSScriptRoot\..\winsdk\app_manifest.xml"
}
if (Test-Path $manifestSource) {
    $dir1 = "$PSScriptRoot\..\src-tauri\target\x86_64-pc-windows-msvc\debug"
    if (Test-Path $dir1) { Copy-Item $manifestSource "$dir1\pinned.exe.manifest" -Force }
    $dir2 = "$PSScriptRoot\..\src-tauri\target\debug"
    if (Test-Path $dir2) { Copy-Item $manifestSource "$dir2\pinned.exe.manifest" -Force }
}

Set-Location "$PSScriptRoot\.."
npx tauri dev

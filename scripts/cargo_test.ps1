$msvcBin = 'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64'
$msvcLib = 'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\lib\x64'
$projectRoot = Split-Path -Parent $PSScriptRoot
$winSdkLib = "$projectRoot\winsdk\lib_x64"
$winSdkBin = "$projectRoot\winsdk\bin"
$rustBin = 'C:\Users\ankit\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin'

$env:PATH = "$winSdkBin;$msvcBin;$rustBin;$env:PATH"
$env:LIB = "$winSdkLib;$msvcLib;$env:LIB"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "$msvcBin\link.exe"
$env:SQLITE3_LIB_DIR = "$winSdkLib"
$env:SQLITE3_STATIC = "0"
$env:RC = "$winSdkBin\rc.exe"
$env:RC_x86_64_pc_windows_msvc = "$winSdkBin\rc.exe"

Set-Location "$PSScriptRoot\..\src-tauri"
cargo test --test integration_tests -- $args

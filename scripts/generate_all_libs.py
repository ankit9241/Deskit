import subprocess
import os

dumpbin = r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\dumpbin.exe"
lib_exe = r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\lib.exe"
out_dir = r"winsdk\lib_x64"

os.makedirs(out_dir, exist_ok=True)

targets = [
    ("kernel32.dll", "KERNEL32.DLL", "kernel32.lib"),
    ("user32.dll", "USER32.DLL", "user32.lib"),
    ("advapi32.dll", "ADVAPI32.DLL", "advapi32.lib"),
    ("ws2_32.dll", "WS2_32.DLL", "ws2_32.lib"),
    ("ole32.dll", "OLE32.DLL", "ole32.lib"),
    ("oleaut32.dll", "OLEAUT32.DLL", "oleaut32.lib"),
    ("bcrypt.dll", "BCRYPT.DLL", "bcrypt.lib"),
    ("crypt32.dll", "CRYPT32.DLL", "crypt32.lib"),
    ("userenv.dll", "USERENV.DLL", "userenv.lib"),
    ("ntdll.dll", "NTDLL.DLL", "ntdll.lib"),
    ("secur32.dll", "SECUR32.DLL", "secur32.lib"),
    ("rpcrt4.dll", "RPCRT4.DLL", "rpcrt4.lib"),
    ("version.dll", "VERSION.DLL", "version.lib"),
    ("shcore.dll", "SHCORE.DLL", "shcore.lib"),
    ("d3d11.dll", "D3D11.DLL", "d3d11.lib"),
    ("dxgi.dll", "DXGI.DLL", "dxgi.lib"),
    ("mswsock.dll", "MSWSOCK.DLL", "mswsock.lib"),
    ("iphlpapi.dll", "IPHLPAPI.DLL", "iphlpapi.lib"),
    ("winmm.dll", "WINMM.DLL", "winmm.lib"),
    ("imm32.dll", "IMM32.DLL", "imm32.lib"),
    ("comdlg32.dll", "COMDLG32.DLL", "comdlg32.lib"),
    ("shell32.dll", "SHELL32.DLL", "shell32.lib"),
    ("gdi32.dll", "GDI32.DLL", "gdi32.lib"),
    ("ucrtbase.dll", "UCRTBASE.DLL", "ucrt.lib"),
]

for src_dll, lib_name, out_lib in targets:
    dll_path = os.path.join(r"C:\Windows\System32", src_dll)
    if not os.path.exists(dll_path):
        print(f"Skipping {dll_path} (not found)")
        continue

    res = subprocess.run([dumpbin, "/EXPORTS", dll_path], capture_output=True, text=True)
    exports = []
    start = False
    for line in res.stdout.splitlines():
        if "ordinal hint" in line:
            start = True
            continue
        if start:
            if line.strip() == "Summary":
                break
            parts = line.split()
            if len(parts) >= 3 and parts[0].isdigit():
                if "(forwarded" in parts:
                    exports.append(parts[2])
                elif len(parts) >= 4:
                    exports.append(parts[3])

    def_filename = out_lib.replace(".lib", ".def")
    def_path = os.path.join(out_dir, def_filename)
    dest_lib_path = os.path.join(out_dir, out_lib)

    with open(def_path, "w") as f:
        f.write(f"LIBRARY {lib_name}\nEXPORTS\n")
        for exp in sorted(set(exports)):
            f.write(f"    {exp}\n")

    cmd = [lib_exe, f"/DEF:{def_path}", "/MACHINE:X64", f"/OUT:{dest_lib_path}"]
    lib_res = subprocess.run(cmd, capture_output=True, text=True)
    if lib_res.returncode == 0:
        print(f"{src_dll} -> {out_lib}: {len(exports)} exports written.")
    else:
        print(f"Failed {src_dll}: {lib_res.stderr}")

print("Done generating all libraries.")

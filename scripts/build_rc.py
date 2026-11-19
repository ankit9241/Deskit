import subprocess
import os

code = r"""
extern "C" {
struct STARTUPINFOW {
    unsigned long cb;
    wchar_t* lpReserved;
    wchar_t* lpDesktop;
    wchar_t* lpTitle;
    unsigned long dwX;
    unsigned long dwY;
    unsigned long dwXSize;
    unsigned long dwYSize;
    unsigned long dwXCountChars;
    unsigned long dwYCountChars;
    unsigned long dwFillAttribute;
    unsigned long dwFlags;
    unsigned short wShowWindow;
    unsigned short cbReserved2;
    unsigned char* lpReserved2;
    void* hStdInput;
    void* hStdOutput;
    void* hStdError;
};

struct PROCESS_INFORMATION {
    void* hProcess;
    void* hThread;
    unsigned long dwProcessId;
    unsigned long dwThreadId;
};

__declspec(dllimport) int __stdcall CreateProcessW(
    const wchar_t*, wchar_t*, void*, void*, int, unsigned long, void*, const wchar_t*, STARTUPINFOW*, PROCESS_INFORMATION*);
__declspec(dllimport) unsigned long __stdcall WaitForSingleObject(void*, unsigned long);
__declspec(dllimport) int __stdcall CloseHandle(void*);
__declspec(dllimport) void __stdcall ExitProcess(unsigned int);
__declspec(dllimport) wchar_t** __stdcall CommandLineToArgvW(const wchar_t*, int*);
__declspec(dllimport) wchar_t* __stdcall GetCommandLineW();

static int my_wcslen(const wchar_t* s) {
    int len = 0;
    while (*s++) len++;
    return len;
}

static void my_wcscat(wchar_t* dest, const wchar_t* src) {
    while (*dest) dest++;
    while ((*dest++ = *src++));
}

static void my_wcscpy(wchar_t* dest, const wchar_t* src) {
    while ((*dest++ = *src++));
}

void mainCRTStartup() {
    int argc = 0;
    wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    const wchar_t* out_file = 0;
    for (int i = 1; i < argc; i++) {
        if ((argv[i][0] == L'/' || argv[i][0] == L'-') &&
            (argv[i][1] == L'f' || argv[i][1] == L'F') &&
            (argv[i][2] == L'o' || argv[i][2] == L'O') &&
            i + 1 < argc) {
            out_file = argv[i+1];
            break;
        }
    }

    if (out_file) {
        wchar_t cmd[1024];
        my_wcscpy(cmd, L"\"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC\\Tools\\MSVC\\14.29.30133\\bin\\Hostx64\\x64\\lib.exe\" /NOLOGO /MACHINE:X64 /DEF:\"winsdk\\lib_x64\\uuid.def\" /OUT:\"");
        my_wcscat(cmd, out_file);
        my_wcscat(cmd, L"\"");

        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi = { 0 };
        if (CreateProcessW(0, cmd, 0, 0, 0, 0, 0, 0, &si, &pi)) {
            WaitForSingleObject(pi.hProcess, 0xFFFFFFFF);
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }

    ExitProcess(0);
}
}
"""

with open("winsdk/bin/rc.cpp", "w") as f:
    f.write(code)

cl = r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\cl.exe"
link_dirs = ["/LIBPATH:winsdk\\lib_x64"]
cmd = [cl, "/nologo", "/GS-", "winsdk/bin/rc.cpp", "/link", "/NODEFAULTLIB", "/ENTRY:mainCRTStartup", "/SUBSYSTEM:CONSOLE"] + link_dirs + ["kernel32.lib", "shell32.lib", "/OUT:winsdk\\bin\\rc.exe"]
res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)
print("Stdout:", res.stdout)
print("Stderr:", res.stderr)

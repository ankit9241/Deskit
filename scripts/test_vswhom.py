import subprocess

code = """
extern "C" {
    struct Find_Result {
        int windows_sdk_version;
        const wchar_t *windows_sdk_root;
        const wchar_t *windows_sdk_um_library_path;
        const wchar_t *windows_sdk_ucrt_library_path;
        const wchar_t *vs_exe_path;
        const wchar_t *vs_library_path;
    };

    Find_Result vswhom_find_visual_studio_and_windows_sdk() {
        Find_Result result = {0, 0, 0, 0, 0, 0};
        return result;
    }

    void vswhom_free_resources(Find_Result *result) {
        if (result) {
            result->windows_sdk_version = 0;
            result->windows_sdk_root = 0;
            result->windows_sdk_um_library_path = 0;
            result->windows_sdk_ucrt_library_path = 0;
            result->vs_exe_path = 0;
            result->vs_library_path = 0;
        }
    }
}
"""

with open("test_vswhom.cpp", "w") as f:
    f.write(code)

cl = r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\cl.exe"
res = subprocess.run([cl, "/nologo", "/c", "test_vswhom.cpp"], capture_output=True, text=True)
print("Return code:", res.returncode)
print("Stdout:", res.stdout)
print("Stderr:", res.stderr)

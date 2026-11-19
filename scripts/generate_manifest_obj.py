import struct
import subprocess
import os

manifest_text = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 and Windows 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
      <!-- Windows 8.1 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/>
      <!-- Windows 8 -->
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}"/>
      <!-- Windows 7 -->
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>""".strip().encode('utf-8')

def make_res_entry(type_id, name_id, data, lang_id=0x0409):
    pad_len = (4 - (len(data) % 4)) % 4
    padded = data + (b'\x00' * pad_len)
    header = struct.pack(
        '<IIHHHH I HH II',
        len(data),      # DataSize
        32,             # HeaderSize
        0xFFFF, type_id,# Type
        0xFFFF, name_id,# Name
        0,              # DataVersion
        0x0030,         # MemoryFlags
        lang_id,        # LanguageId
        0,              # Version
        0               # Characteristics
    )
    return header + padded

# Initial empty header
res_data = struct.pack('<IIHHHH I HH II', 0, 32, 0xFFFF, 0, 0xFFFF, 0, 0, 0, 0, 0, 0)

# Add RT_MANIFEST (Type 24, Name 1)
res_data += make_res_entry(24, 1, manifest_text)

# Add icon resources if available
ico_path = os.path.abspath('src-tauri/icons/icon.ico')
if os.path.exists(ico_path):
    with open(ico_path, 'rb') as f:
        ico_bytes = f.read()
    reserved, itype, count = struct.unpack_from('<HHH', ico_bytes, 0)
    if itype == 1 and count > 0:
        grp_entries = []
        for i in range(count):
            offset = 6 + i * 16
            bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes, dwImageOffset = struct.unpack_from('<BBBBHHII', ico_bytes, offset)
            img_data = ico_bytes[dwImageOffset : dwImageOffset + dwBytesInRes]
            icon_id = i + 1
            # Add RT_ICON (Type 3)
            res_data += make_res_entry(3, icon_id, img_data)
            # GRPICONDIRENTRY
            grp_entries.append(struct.pack('<BBBBHHIH', bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes, icon_id))
        
        # RT_GROUP_ICON (Type 14)
        grp_data = struct.pack('<HHH', 0, 1, count) + b''.join(grp_entries)
        # Add for both ID 128 (Tauri default) and ID 32512 (IDI_APPLICATION) and ID 1
        res_data += make_res_entry(14, 128, grp_data)
        res_data += make_res_entry(14, 1, grp_data)
        res_data += make_res_entry(14, 32512, grp_data)
        print(f'Embedded icon.ico ({count} frames) into resource object')

res_path = os.path.abspath('winsdk/lib_x64/app_manifest.res')
obj_path = os.path.abspath('winsdk/lib_x64/app_manifest.obj')

with open(res_path, 'wb') as f:
    f.write(res_data)

cvtres = r'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\cvtres.exe'
res = subprocess.run([cvtres, '/NOLOGO', '/MACHINE:X64', f'/OUT:{obj_path}', res_path], capture_output=True, text=True)
if res.returncode != 0:
    print('cvtres failed:', res.stderr)
    exit(1)

print('Successfully generated app_manifest.obj at:', obj_path)

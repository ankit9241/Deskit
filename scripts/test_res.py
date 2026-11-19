import struct
import subprocess

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
</assembly>""".encode('utf-8')

# Build .res file
# Empty initial header (32 bytes)
# DataSize=0, HeaderSize=32, Type=0xFFFF0000, Name=0xFFFF0000, DataVersion=0, MemoryFlags=0, LanguageId=0, Version=0, Characteristics=0
res_data = struct.pack('<IIHHHH I HH II', 0, 32, 0xFFFF, 0, 0xFFFF, 0, 0, 0, 0, 0, 0)

pad_len = (4 - (len(manifest_text) % 4)) % 4
padded_manifest = manifest_text + b'\x00' * pad_len

header = struct.pack('<IIHHHH I HH II',
    len(manifest_text), # DataSize
    32,                 # HeaderSize
    0xFFFF, 24,         # Type: RT_MANIFEST (24)
    0xFFFF, 1,          # Name: 1 (CREATEPROCESS_MANIFEST_RESOURCE_ID)
    0,                  # DataVersion
    0x0030,             # MemoryFlags
    0x0409,             # LanguageId (0x0409)
    0,                  # Version
    0                   # Characteristics
)

with open('test_manifest.res', 'wb') as f:
    f.write(res_data + header + padded_manifest)

print('Written test_manifest.res, total size:', len(res_data + header + padded_manifest))

cvtres = r'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\bin\Hostx64\x64\cvtres.exe'
res = subprocess.run([cvtres, '/NOLOGO', '/MACHINE:X64', '/OUT:test_manifest.obj', 'test_manifest.res'], capture_output=True, text=True)
print('cvtres exit code:', res.returncode)
print('cvtres stdout:', res.stdout)
print('cvtres stderr:', res.stderr)

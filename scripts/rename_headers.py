import os
import shutil
import subprocess

msi_abs = os.path.abspath(r'winsdk\msi\headers.msi')
script = f'''
Set installer = CreateObject("WindowsInstaller.Installer")
Set db = installer.OpenDatabase("{msi_abs}", 0)
Set view = db.OpenView("SELECT File, FileName FROM File")
view.Execute
Do
    Set rec = view.Fetch
    If rec Is Nothing Then Exit Do
    WScript.Echo rec.StringData(1) & "|" & rec.StringData(2)
Loop
'''

with open('dump_map.vbs', 'w') as f:
    f.write(script)

res = subprocess.run(['cscript', '//nologo', 'dump_map.vbs'], capture_output=True, text=True)
mapping = {}
for line in res.stdout.splitlines():
    if '|' in line:
        parts = line.split('|')
        fil_name = parts[0].strip()
        # if there are multiple pipes: File|short|long
        real_name = parts[-1].strip()
        mapping[fil_name] = real_name

print(f'Parsed {len(mapping)} file mappings.')

raw_dir = r'winsdk\include_raw'
out_dir = r'winsdk\include'
os.makedirs(out_dir, exist_ok=True)

renamed = 0
for fil_name, real_name in mapping.items():
    src = os.path.join(raw_dir, fil_name)
    if os.path.exists(src):
        dst = os.path.join(out_dir, real_name)
        shutil.copy2(src, dst)
        renamed += 1

print(f'Successfully copied {renamed} header files to {out_dir}.')
print('windows.h present:', os.path.exists(os.path.join(out_dir, 'windows.h')))

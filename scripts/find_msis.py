import re
with open(r'C:\Users\ankit\AppData\Local\Temp\winsdk_quiet.log', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()
matches = re.findall(r'Installers/([^"\s\r\n]+\.msi)', text)
for m in sorted(set(matches)):
    print(m)

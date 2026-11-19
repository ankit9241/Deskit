$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $installer.OpenDatabase("$PSScriptRoot\..\winsdk\msi\headers.msi", 0)
$view = $db.OpenView("SELECT File, FileName FROM File WHERE FileName LIKE '%windows.h%'")
$view.Execute()
while ($rec = $view.Fetch()) {
    Write-Output ($rec.StringData(1) + " => " + $rec.StringData(2))
}
$viewMedia = $db.OpenView("SELECT DiskId, LastSequence, Cabinet FROM Media")
$viewMedia.Execute()
while ($rec = $viewMedia.Fetch()) {
    Write-Output ("Media: " + $rec.StringData(1) + " LastSeq: " + $rec.StringData(2) + " Cab: " + $rec.StringData(3))
}

#Requires -RunAsAdministrator
<#
  Sets up LedEdit 2014 + LEDPlayer 2024 on Windows for LED-controller test-file work.
  Run from an elevated PowerShell prompt (Right-click PowerShell -> Run as Administrator):
      powershell -ExecutionPolicy Bypass -File setup-ledit-windows.ps1
#>

$ErrorActionPreference = "Stop"
$ToolsDir = "$env:USERPROFILE\Desktop\LedEdit-Tools"
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

Write-Host "==> Enabling .NET Framework 3.5 (covers 2.0/3.5, required by LedEdit 2014)..."
$netfx = Get-WindowsOptionalFeature -Online -FeatureName NetFx3
if ($netfx.State -ne "Enabled") {
    Dism /online /enable-feature /featurename:NetFx3 /All /NoRestart
} else {
    Write-Host "    Already enabled."
}

Write-Host "==> Downloading Visual C++ Redistributable (x64) for LEDPlayer 2024..."
$vcUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
$vcPath = "$ToolsDir\vc_redist.x64.exe"
Invoke-WebRequest -Uri $vcUrl -OutFile $vcPath
Write-Host "==> Installing VC++ Redistributable (silent)..."
Start-Process -FilePath $vcPath -ArgumentList "/install", "/quiet", "/norestart" -Wait

Write-Host "==> Downloading LedEdit 2014..."
$ledEditZipUrl = "https://lededittm.com/wp-content/uploads/2025/04/LEDEdit-2014-V2.45.zip"
$ledEditZip = "$ToolsDir\LEDEdit-2014-V2.45.zip"
Invoke-WebRequest -Uri $ledEditZipUrl -OutFile $ledEditZip
Write-Host "==> Extracting LedEdit 2014..."
Expand-Archive -Path $ledEditZip -DestinationPath $ToolsDir -Force

Write-Host "==> Downloading LEDPlayer 2024..."
$ledPlayerZipUrl = "https://lededittm.com/wp-content/uploads/2025/04/LEDPlayer-2024.zip"
$ledPlayerZip = "$ToolsDir\LEDPlayer-2024.zip"
Invoke-WebRequest -Uri $ledPlayerZipUrl -OutFile $ledPlayerZip
Write-Host "==> Extracting LEDPlayer 2024..."
Expand-Archive -Path $ledPlayerZip -DestinationPath $ToolsDir -Force

# Create a desktop shortcut for LedEdit (it's portable — runs directly, no installer)
$ledEditExe = Get-ChildItem -Path $ToolsDir -Recurse -Filter "LedEdit.exe" | Select-Object -First 1
if ($ledEditExe) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut("$env:USERPROFILE\Desktop\LedEdit.lnk")
    $shortcut.TargetPath = $ledEditExe.FullName
    $shortcut.WorkingDirectory = $ledEditExe.DirectoryName
    $shortcut.Save()
    Write-Host "==> Desktop shortcut created: LedEdit.lnk"
}

Write-Host ""
Write-Host "===================================================================="
Write-Host " Done. Next steps:"
Write-Host " 1. Double-click 'LedEdit' on your Desktop (LedEdit 2014 needs no install)."
Write-Host " 2. For LEDPlayer, run the installer manually (click-through):"
Write-Host "    $ToolsDir\LEDPlayer 2024\LEDPlayer 2024 Setup.exe"
Write-Host " 3. In LedEdit: set controller = T1000, create a small test effect"
Write-Host "    (e.g. solid red, 1 frame), export via Project Output (工程输出) as .led"
Write-Host " 4. Send the exported .led files back for analysis."
Write-Host "===================================================================="

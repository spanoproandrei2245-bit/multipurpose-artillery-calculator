<#
  One screenshot of the primary monitor (the game must be in front, borderless or windowed).
    powershell -ExecutionPolicy Bypass -File tools/arma/snap.ps1 -Out D:\gradsat\test.png
#>
param([Parameter(Mandatory = $true)][string]$Out)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System.Runtime.InteropServices;
public static class DpiSnap { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
'@
[void][DpiSnap]::SetProcessDPIAware()

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$dir = Split-Path -Parent $Out
if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "saved $Out ($($bounds.Width)x$($bounds.Height))"

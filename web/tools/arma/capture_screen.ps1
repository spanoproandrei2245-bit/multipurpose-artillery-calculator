<#
  Captures the Windows screen whenever gradtopo_photos.sqf writes a GRADPHOTO|P| line to the Arma RPT.
  (The in-game screenshot command does not save files on many setups.)

  Run BEFORE the in-game script, then switch to the game (borderless/windowed on the primary monitor)
  and do not touch mouse or keyboard:

    powershell -ExecutionPolicy Bypass -File tools/arma/capture_screen.ps1 -OutDir D:\gradphoto

  Stops by itself on GRADPHOTO|END. See tools/arma/README.md.
#>
param(
  [string]$OutDir = 'D:\gradphoto',
  [string]$Rpt = ''
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System.Runtime.InteropServices;
public static class Dpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
'@
[void][Dpi]::SetProcessDPIAware()

if (-not $Rpt) {
  $Rpt = (Get-ChildItem "$env:LOCALAPPDATA\Arma 3" -Filter *.rpt | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host "RPT: $Rpt"
Write-Host "Screen: $($bounds.Width)x$($bounds.Height), frames -> $OutDir"
Write-Host 'Waiting for GRADPHOTO lines (start the script in the game)'

$stream = [System.IO.File]::Open($Rpt, 'Open', 'Read', 'ReadWrite')
[void]$stream.Seek(0, 'End')
$reader = New-Object System.IO.StreamReader($stream)
$count = 0
while ($true) {
  $line = $reader.ReadLine()
  if ($null -eq $line) { Start-Sleep -Milliseconds 20; continue }
  if ($line -match 'GRADPHOTO\|P\|([^|]+)\|') {
    $name = $Matches[1]
    $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    $count++
    if ($count % 10 -eq 0) { Write-Host "frames captured: $count" }
  }
  elseif ($line -match 'GRADPHOTO\|END') {
    Write-Host "Done: $count frames."
    break
  }
}
$reader.Dispose(); $stream.Dispose()

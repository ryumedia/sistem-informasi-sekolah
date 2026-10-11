$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = "c:\Ryumedia\sistem-informasi-sekolah\public\logo.png"
$dest = "c:\Ryumedia\sistem-informasi-sekolah\android-webview\app\src\main\res"

$sizes = @{ 'mipmap-mdpi'=48; 'mipmap-hdpi'=72; 'mipmap-xhdpi'=96; 'mipmap-xxhdpi'=144; 'mipmap-xxxhdpi'=192 }

$logo = [System.Drawing.Image]::FromFile($src)
foreach ($k in $sizes.Keys) {
    $dir = Join-Path $dest $k
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $size = $sizes[$k]
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    # background putih agar logo transparan tetap terlihat di launcher
    $g.Clear([System.Drawing.Color]::White)
    $margin = [int]($size * 0.08)
    $inner = $size - 2 * $margin
    $g.DrawImage($logo, $margin, $margin, $inner, $inner)
    $g.Dispose()
    $bmp.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
$logo.Dispose()
Write-Output "Ikon selesai dibuat."

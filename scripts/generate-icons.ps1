$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = "c:\Ryumedia\sistem-informasi-sekolah\public\logo.png"
$dest = "c:\Ryumedia\sistem-informasi-sekolah\android-webview\app\src\main\res"

# Ikon launcher: ukuran standar per dpi, margin cukup (aman untuk mask lingkaran)
$launcher = @{ 'mipmap-mdpi'=48; 'mipmap-hdpi'=72; 'mipmap-xhdpi'=96; 'mipmap-xxhdpi'=144; 'mipmap-xxxhdpi'=192 }
$launcherMarginRatio = 0.12

# Ikon splash: 108dp per dpi (ukuran penuh area splash), logo mengisi ~2/3
$splash = @{ 'mipmap-mdpi'=108; 'mipmap-hdpi'=162; 'mipmap-xhdpi'=216; 'mipmap-xxhdpi'=324; 'mipmap-xxxhdpi'=432 }
$splashLogoRatio = 0.66

$logo = [System.Drawing.Image]::FromFile($src)

function Resize-HQ($size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    return @($bmp, $g)
}

foreach ($k in $launcher.Keys) {
    $dir = Join-Path $dest $k
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $size = $launcher[$k]
    $bmp, $g = Resize-HQ $size
    $g.Clear([System.Drawing.Color]::White)
    $margin = [int]($size * $launcherMarginRatio)
    $inner = $size - 2 * $margin
    $g.DrawImage($logo, $margin, $margin, $inner, $inner)
    $g.Dispose()
    $bmp.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

foreach ($k in $splash.Keys) {
    $dir = Join-Path $dest $k
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $size = $splash[$k]
    $bmp, $g = Resize-HQ $size
    $g.Clear([System.Drawing.Color]::Transparent)
    $inner = [int]($size * $splashLogoRatio)
    $offset = [int](($size - $inner) / 2)
    $g.DrawImage($logo, $offset, $offset, $inner, $inner)
    $g.Dispose()
    $bmp.Save((Join-Path $dir 'splash_logo.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$logo.Dispose()
Write-Output "Ikon launcher & splash selesai dibuat (HQ)."

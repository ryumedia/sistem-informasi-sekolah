# Mainriang — Android WebView Wrapper

Project Android ini adalah pembungkus (wrapper) WebView untuk aplikasi Next.js di https://mainriang.app

## Fitur yang sudah disiapkan

| Fitur | Status |
|---|---|
| JavaScript + DOM Storage (wajib untuk Firebase Auth) | ✅ |
| Cookie tersimpan (sesi login bertahan) | ✅ |
| Swipe-to-refresh (tarik ke bawah untuk refresh) | ✅ |
| Upload file & **kamera** (`<input type="file">`) | ✅ |
| Handle link WhatsApp / tel / mailto → buka aplikasi eksternal | ✅ |
| Halaman pembayaran Midtrans (sandbox & produksi) tetap di WebView | ✅ |
| Deep link `https://mainriang.app/...` membuka aplikasi | ✅ |
| Splash screen dengan logo | ✅ |
| Back button menutup halaman WebView satu per satu | ✅ |
| Ikon launcher dibuat dari `public/logo.png` | ✅ |

## Cara Build (butuh Android Studio atau hanya command line)

### Opsi 1 — Dengan Android Studio (disarankan)
1. Install Android Studio: https://developer.android.com/studio
2. Buka folder `android-webview/` sebagai project (`File > Open`)
3. Tunggu Gradle sync selesai
4. Build APK: `Build > Build Bundle(s) / APK(s) > Build APK(s)`
5. APK ada di `app/build/outputs/apk/debug/app-debug.apk`

### Opsi 2 — Tanpa Android Studio (hanya command line + JDK 17)
```powershell
cd android-webview
# pertama kali: butuh file gradlew.bat (lihat catatan di bawah)
.\gradlew.bat assembleDebug
```
APK hasil build: `app\build\outputs\apk\debug\app-debug.apk`

> **Catatan:** file `gradlew.bat` & `gradle-wrapper.jar` tidak disertakan.
> Cara tercepat: install Android Studio (opsi 1), atau download
> Gradle 8.7 dari https://gradle.org/install dan jalankan `gradle wrapper`.

## Langkah Setelah APK Jadi

1. **Instal di HP**: salin APK ke HP atau sambungkan HP (USB debugging aktif) lalu jalankan dari Android Studio.
2. **Sebelum rilis ke Play Store**, siapkan:
   - `versionCode` dinaikkan setiap rilis (di `app/build.gradle`)
   - Signed APK/AAB: `Build > Generate Signed Bundle / APK`
3. **Kalau logo ganti**: jalankan ulang `scripts/generate-icons.ps1`

## Hal yang perlu diperhatikan di web app (Next.js)

1. **User-Agent sudah diberi suffix** `MainriangApp/1.0` — di web app kamu bisa deteksi:
   ```js
   const isAndroidApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('MainriangApp');
   ```
2. **PWA vs WebView**: karena sudah dibungkus WebView, tidak perlu service worker/PWA install prompt muncul di dalam aplikasi — sembunyikan jika terdeteksi `isAndroidApp`.
3. **Midtrans Snap**: halaman pembayaran sudah di-whitelist supaya tidak terbuka di browser eksternal. Jika nanti midtrans menambah domain baru, tambahkan di `shouldOverrideUrlLoading` pada `MainActivity.java`.

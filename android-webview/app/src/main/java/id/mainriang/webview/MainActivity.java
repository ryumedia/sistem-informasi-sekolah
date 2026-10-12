package id.mainriang.webview;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String BASE_URL = "https://mainriang.app";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;

    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraPhotoUri;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    results = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    private final ActivityResultLauncher<Uri> takePictureLauncher =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
                if (filePathCallback == null) return;
                Uri[] results = (success && cameraPhotoUri != null) ? new Uri[]{cameraPhotoUri} : null;
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // WAJIB dipanggil setelah super.onCreate saat memakai Theme.SplashScreen
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this);

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        progressBar = findViewById(R.id.progress_bar);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);          // wajib untuk Firebase/localStorage
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " MainriangApp/1.0");

        // Cookie supaya sesi login bertahan
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Semua navigasi di dalam domain aplikasi tetap di WebView.
        // Link luar (WhatsApp, tel, mail, dan halaman pembayaran Midtrans)
        // dibuka sesuai kebutuhan.
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost() == null ? "" : url.getHost();
                String scheme = url.getScheme() == null ? "" : url.getScheme();

                // Skema khusus (whatsapp, tel, mailto, dll) -> aplikasi eksternal
                if (!scheme.equals("http") && !scheme.equals("https")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {}
                    return true;
                }

                // Domain milik aplikasi & halaman pembayaran -> tetap di WebView
                boolean isInternal = host.equals("mainriang.app")
                        || host.endsWith(".mainriang.app")
                        || host.equals("app.sandbox.midtrans.com")
                        || host.equals("app.midtrans.com")
                        || host.equals("simulator.sandbox.midtrans.com")
                        || host.endsWith(".midtrans.com");
                return !isInternal; // true = buka di browser eksternal
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            // Debug: catat semua error network resource ke Logcat
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                android.util.Log.e("MainriangWebView", "Error " + request.getUrl() + ": " + error.getDescription());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            // Debug: tampilkan console.log/error dari web app di Logcat
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                android.util.Log.d("MainriangWebView", "[JS] " + consoleMessage.messageLevel() + ": "
                        + consoleMessage.message() + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return true;
            }

            // Progress loading
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }

            // Izin kamera/mikrofon dari web (misal scan KTP)
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            // Upload file & kamera dari <input type="file">
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                // Tawarkan kamera terlebih dahulu
                try {
                    cameraPhotoUri = createImageFileUri();
                    takePictureLauncher.launch(cameraPhotoUri);
                    return true;
                } catch (IOException e) {
                    // Gagal kamera -> fallback ke pemilih file biasa
                    try {
                        fileChooserLauncher.launch(params.createIntent());
                        return true;
                    } catch (Exception ignored) {
                        filePathCallback = null;
                        return false;
                    }
                }
            }
        });

        // Unduhan (misal laporan PDF) dikirim ke aplikasi pengunduh
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(i);
            } catch (Exception e) {
                Toast.makeText(this, "Tidak bisa membuka unduhan", Toast.LENGTH_SHORT).show();
            }
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        if (savedInstanceState == null) {
            // Bisa buka URL spesifik lewat deep link (misal dari notifikasi)
            Uri intentData = getIntent() != null ? getIntent().getData() : null;
            webView.loadUrl(intentData != null ? intentData.toString() : BASE_URL);
        }
    }

    private Uri createImageFileUri() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File file = File.createTempFile("JPEG_" + timeStamp + "_", ".jpg",
                getExternalFilesDir(Environment.DIRECTORY_PICTURES));
        return Uri.fromFile(file);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onRestoreInstanceState(@NonNull Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        webView.restoreState(savedInstanceState);
    }
}

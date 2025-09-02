package ai.paraspot.backgrounduploader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Data;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.io.File;
import java.util.Iterator;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class UploaderWorker extends Worker {

    private static final int NOTIF_ID = 991;
    private static final String CHANNEL_ID = "uploads";

    public UploaderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull @Override
    public Result doWork() {
        Data input = getInputData();
        String fileUrl     = input.getString("fileUrl");
        String data        = input.getString("data");
        String uploadUrl   = input.getString("uploadUrl");
        String method      = input.getString("method");
        String headersJson = input.getString("headers");
        String field       = input.getString("field");

        if ((fileUrl == null || fileUrl.isEmpty()) && (data == null || data.isEmpty())) {
            return Result.failure();
        }
        if (uploadUrl == null) return Result.failure();

        NotificationManager nm = (NotificationManager) getApplicationContext()
            .getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Uploads", NotificationManager.IMPORTANCE_LOW);
        nm.createNotificationChannel(ch);
        }

        // Start as foreground so Android keeps it alive
        setForegroundAsync(createForegroundInfo("Uploading…", "Starting", true, 0));

        try {
        OkHttpClient client = new OkHttpClient.Builder().build();

        // Create RequestBody from either file or base64 data
        RequestBody rawBody;
        String fileName = "upload";
        
        if (data != null && !data.isEmpty()) {
            // Use base64 data
            byte[] bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
            rawBody = RequestBody.create(bytes, MediaType.parse("application/octet-stream"));
            fileName = "chunk.tmp";
        } else {
            // Use file path
            String path = fileUrl.startsWith("file://") ? fileUrl.substring("file://".length()) : fileUrl;
            File file = new File(path);
            if (!file.exists()) throw new Exception("File not found: " + path);
            rawBody = RequestBody.create(file, MediaType.parse("application/octet-stream"));
            fileName = file.getName();
        }

        Request.Builder reqBuilder = new Request.Builder().url(uploadUrl);

        // headers
        if (headersJson != null && !headersJson.isEmpty()) {
            try {
            JSONObject obj = new JSONObject(headersJson);
            Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                String v = obj.optString(k, null);
                if (v != null) reqBuilder.addHeader(k, v);
            }
            } catch (Throwable ignored) {}
        }

        Request request;
        if ("PUT".equalsIgnoreCase(method)) {
            ProgressRequestBody body = new ProgressRequestBody(
                rawBody,
                pct -> updateProgress(nm, pct)
            );
            request = reqBuilder.put(body).build();
        } else {
            ProgressRequestBody fileBody = new ProgressRequestBody(
                rawBody,
                pct -> updateProgress(nm, pct)
            );
            MultipartBody multi = new MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart(field != null ? field : "file", fileName, fileBody)
                .build();
            request = reqBuilder.post(multi).build();
        }

        try (Response resp = client.newCall(request).execute()) {
            if (!resp.isSuccessful()) {
                Data output = new Data.Builder()
                    .putString("error", "HTTP " + resp.code())
                    .putInt("status", resp.code())
                    .build();
                return Result.failure(output);
            }
            
            // Final success notification
            Notification n = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
                .setContentTitle("Upload complete")
                .setContentText("Success")
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setOngoing(false)
                .build();
            nm.notify(NOTIF_ID, n);
            
            Data output = new Data.Builder()
                .putInt("status", resp.code())
                .build();
            return Result.success(output);
        }
        } catch (Exception e) {
        Notification n = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
            .setContentTitle("Upload failed")
            .setContentText(e.getMessage() != null ? e.getMessage() : "Error")
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setOngoing(false)
            .build();
        nm.notify(NOTIF_ID, n);
        
        Data output = new Data.Builder()
            .putString("error", e.getMessage() != null ? e.getMessage() : "Unknown error")
            .build();
        return Result.failure(output);
        }
    }

    private void updateProgress(NotificationManager nm, int pct) {
        // Update notification
        Notification n = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
            .setContentTitle("Uploading…")
            .setContentText(pct + "%")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOnlyAlertOnce(true)
            .setOngoing(pct < 100)
            .setProgress(100, pct, false)
            .build();
        nm.notify(NOTIF_ID, n);
        
        // Report progress to WorkManager
        Data progress = new Data.Builder()
            .putInt("progress", pct)
            .build();
        setProgressAsync(progress);
    }

    private ForegroundInfo createForegroundInfo(String title, String text, boolean indeterminate, int pct) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOnlyAlertOnce(true)
            .setOngoing(true);

        if (!indeterminate) b.setProgress(100, pct, false);

        Notification n = b.build();
        
        // For Android 14+ (API 34+), specify the foreground service type
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return new ForegroundInfo(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            return new ForegroundInfo(NOTIF_ID, n);
        }
    }
}

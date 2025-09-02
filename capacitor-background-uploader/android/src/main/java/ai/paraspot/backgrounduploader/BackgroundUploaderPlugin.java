package ai.paraspot.backgrounduploader;

import androidx.lifecycle.Observer;
import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "BackgroundUploader")
public class BackgroundUploaderPlugin extends Plugin {

  private static BackgroundUploaderPlugin instance;
  private ConcurrentHashMap<String, UUID> activeUploads = new ConcurrentHashMap<>();
  
  @Override
  public void load() {
    super.load();
    instance = this;
  }
  
  public static BackgroundUploaderPlugin getInstance() {
    return instance;
  }
  
  public void notifyProgress(String uploadId, int progress) {
    JSObject data = new JSObject();
    data.put("uploadId", uploadId);
    data.put("progress", progress);
    notifyListeners("progress", data);
  }
  
  public void notifyCompleted(String uploadId, int status) {
    JSObject data = new JSObject();
    data.put("uploadId", uploadId);
    data.put("status", status);
    notifyListeners("completed", data);
  }
  
  public void notifyError(String uploadId, String message) {
    JSObject data = new JSObject();
    data.put("uploadId", uploadId);
    data.put("message", message);
    notifyListeners("error", data);
  }

  @PluginMethod
  public void startUpload(PluginCall call) {
    String fileUrl   = call.getString("fileUrl");
    String data      = call.getString("data");
    String uploadUrl = call.getString("uploadUrl");
    String method    = call.getString("method", "POST");
    JSObject hdrsObj = call.getObject("headers", new JSObject());
    String headers   = hdrsObj.toString();
    String field     = call.getString("field", "file");

    if ((fileUrl == null || fileUrl.isEmpty()) && (data == null || data.isEmpty())) {
      call.reject("Either fileUrl or data is required");
      return;
    }
    
    if (uploadUrl == null || uploadUrl.isEmpty()) {
      call.reject("uploadUrl is required");
      return;
    }

    Data workData = new Data.Builder()
        .putString("fileUrl", fileUrl)
        .putString("data", data)
        .putString("uploadUrl", uploadUrl)
        .putString("method", method)
        .putString("headers", headers)
        .putString("field", field)
        .build();

    OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(UploaderWorker.class)
        .setInputData(workData)
        .build();

    WorkManager workManager = WorkManager.getInstance(getContext());
    workManager.enqueue(req);
    
    String uploadId = req.getId().toString();
    activeUploads.put(uploadId, req.getId());
    
    // Observe work progress and completion on main thread
    getActivity().runOnUiThread(() -> {
      workManager.getWorkInfoByIdLiveData(req.getId()).observeForever(new Observer<WorkInfo>() {
        @Override
        public void onChanged(WorkInfo workInfo) {
          if (workInfo != null) {
            Data progress = workInfo.getProgress();
            Data output = workInfo.getOutputData();
            
            switch (workInfo.getState()) {
              case RUNNING:
                int progressPct = progress.getInt("progress", 0);
                if (progressPct > 0) {
                  notifyProgress(uploadId, progressPct);
                }
                break;
              case SUCCEEDED:
                int status = output.getInt("status", 200);
                notifyCompleted(uploadId, status);
                activeUploads.remove(uploadId);
                break;
              case FAILED:
                String error = output.getString("error");
                notifyError(uploadId, error != null ? error : "Upload failed");
                activeUploads.remove(uploadId);
                break;
              case CANCELLED:
                notifyError(uploadId, "Upload cancelled");
                activeUploads.remove(uploadId);
                break;
            }
          }
        }
      });
    });

    JSObject ret = new JSObject();
    ret.put("uploadId", uploadId);
    call.resolve(ret);
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    String id = call.getString("uploadId");
    if (id != null && activeUploads.containsKey(id)) {
      UUID workId = activeUploads.get(id);
      WorkManager.getInstance(getContext()).cancelWorkById(workId);
      activeUploads.remove(id);
    }
    call.resolve();
  }
}

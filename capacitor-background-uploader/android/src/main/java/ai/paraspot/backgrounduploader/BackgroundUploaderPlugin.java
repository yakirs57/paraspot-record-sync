package ai.paraspot.backgrounduploader;

import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundUploader")
public class BackgroundUploaderPlugin extends Plugin {

  @PluginMethod
  public void startUpload(PluginCall call) {
    String fileUrl   = call.getString("fileUrl");
    String uploadUrl = call.getString("uploadUrl");
    String method    = call.getString("method", "POST");
    JSObject hdrsObj = call.getObject("headers", new JSObject());
    String headers   = hdrsObj.toString();
    String field     = call.getString("field", "file");

    if (fileUrl == null || fileUrl.isEmpty() || uploadUrl == null || uploadUrl.isEmpty()) {
      call.reject("fileUrl and uploadUrl are required");
      return;
    }

    Data data = new Data.Builder()
        .putString("fileUrl", fileUrl)
        .putString("uploadUrl", uploadUrl)
        .putString("method", method)
        .putString("headers", headers)
        .putString("field", field)
        .build();

    OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(UploaderWorker.class)
        .setInputData(data)
        .build();

    WorkManager.getInstance(getContext()).enqueue(req);

    JSObject ret = new JSObject();
    ret.put("uploadId", req.getId().toString());
    call.resolve(ret);
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    String id = call.getString("uploadId");
    if (id != null) {
      WorkManager.getInstance(getContext()).cancelWorkById(java.util.UUID.fromString(id));
    }
    call.resolve();
  }
}

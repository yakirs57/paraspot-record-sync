package ai.paraspot.backgrounduploader;

import androidx.annotation.NonNull;

import java.io.IOException;

import okhttp3.MediaType;
import okhttp3.RequestBody;
import okio.BufferedSink;
import okio.Okio;
import okio.Source;

public class ProgressRequestBody extends RequestBody {

    public interface OnProgress {
        void onProgress(int pct);
    }

    private final RequestBody delegate;
    private final OnProgress callback;

    public ProgressRequestBody(RequestBody delegate, OnProgress cb) {
        this.delegate = delegate;
        this.callback = cb;
    }

    @Override public MediaType contentType() { return delegate.contentType(); }
    @Override public long contentLength() throws IOException { return delegate.contentLength(); }

    @Override
    public void writeTo(@NonNull BufferedSink sink) throws IOException {
        long length = contentLength();
        long uploaded = 0L;

        try (Source source = Okio.source(delegateToInputStream())) {
        long read;
        long lastEmit = -1;
        while ((read = source.read(sink.getBuffer(), 8192)) != -1) {
            sink.flush();
            uploaded += read;
            if (length > 0) {
            int pct = (int)((uploaded * 100L) / length);
            if (pct != lastEmit) {
                callback.onProgress(pct);
                lastEmit = pct;
            }
            }
        }
        }
    }

    /** Turn the delegate body into an InputStream so we can count bytes */
    private java.io.InputStream delegateToInputStream() throws IOException {
        okio.Buffer buffer = new okio.Buffer();
        delegate.writeTo(buffer);
        return buffer.inputStream();
    }
}

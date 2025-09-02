package ai.paraspot.backgrounduploader;

import androidx.annotation.NonNull;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.io.File;
import okhttp3.MediaType;
import okhttp3.RequestBody;
import okio.BufferedSink;

class RangeFileRequestBody extends RequestBody {
  interface OnProgress { void onProgress(int pct); }
  private final File file; private final long offset; private final long length;
  private final MediaType mediaType; private final OnProgress cb;

  RangeFileRequestBody(File f, long off, long len, MediaType mt, OnProgress cb) {
    this.file=f; this.offset=off; this.length=len; this.mediaType=mt; this.cb=cb;
  }

  @Override public MediaType contentType() { return mediaType; }
  @Override public long contentLength() { return length; }

  @Override public void writeTo(@NonNull BufferedSink sink) throws IOException {
    byte[] buf = new byte[64 * 1024];
    long remaining = length, sent = 0;
    try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
      raf.seek(offset);
      while (remaining > 0) {
        int toRead = (int)Math.min(buf.length, remaining);
        int read = raf.read(buf, 0, toRead);
        if (read == -1) break;
        sink.write(buf, 0, read);
        sent += read; remaining -= read;
        if (cb != null) cb.onProgress((int)((sent * 100L) / length));
      }
    }
  }
}

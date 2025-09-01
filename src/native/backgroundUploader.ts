import { BackgroundUploader, type StartResult } from '@paraspot/capacitor-background-uploader';

type Part = { uploadUrl: string; size: number };

export async function startMultipartUploadFromFile(params: {
  fileUrl: string;        // file:/// path to your saved recording
  parts: Part[];          // presigned URLs with each part's size
  title?: string;
  onProgress?: (pct: number) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
}): Promise<StartResult> {
  const { fileUrl, parts, title } = params;
  const { uploadId } = await BackgroundUploader.startMultipartFromFile({
    fileUrl,
    parts,
    notificationTitle: title ?? 'Uploading…',
  });

  const offP = await BackgroundUploader.addListener('progress', ({ uploadId: id, progress }) => {
    if (id === uploadId) params.onProgress?.(progress);
  });
  const offC = await BackgroundUploader.addListener('completed', ({ uploadId: id }) => {
    if (id === uploadId) { offP.remove(); offC.remove(); offE.remove(); params.onDone?.(); }
  });
  const offE = await BackgroundUploader.addListener('error', ({ uploadId: id, message }) => {
    if (id === uploadId) { offP.remove(); offC.remove(); offE.remove(); params.onError?.(message); }
  });

  return { uploadId };
}

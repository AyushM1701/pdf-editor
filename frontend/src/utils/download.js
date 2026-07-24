export function sanitizeFileStem(fileName, fallback = 'download') {
  const stem = String(fileName || fallback)
    .replace(/\.[^.]+$/u, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/gu, '-')
    .trim();

  return stem || fallback;
}

export function ensureFileExtension(fileName, extension) {
  return String(fileName).toLowerCase().endsWith(extension.toLowerCase())
    ? fileName
    : `${fileName}${extension}`;
}

export function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
}

export function downloadBytes(bytes, fileName, mimeType = 'application/octet-stream') {
  downloadBlob(new Blob([bytes], { type: mimeType }), fileName);
}

export async function downloadZip(entries, fileName) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  entries.forEach((entry) => {
    zip.file(entry.name, entry.data);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, ensureFileExtension(fileName, '.zip'));
}

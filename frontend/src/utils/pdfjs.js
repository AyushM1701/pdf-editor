import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSource;

function blobFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to render the PDF page thumbnail.'));
          return;
        }

        resolve(blob);
      },
      'image/png',
      0.92,
    );
  });
}

function getCanvasRenderingContext(canvas) {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The browser could not create a canvas context for PDF rendering.');
  }

  return context;
}

export async function loadPdfDocument(sourceBytes) {
  const loadingTask = getDocument({
    data: sourceBytes.slice(),
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  
  if (typeof pdfDocument.destroy !== 'function') {
    pdfDocument.destroy = async () => {
      await loadingTask.destroy();
    };
  }

  return pdfDocument;
}

export async function renderPageThumbnail(pdfDocument, pageIndex) {
  const page = await pdfDocument.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  // Use a much higher scale so the main canvas is sharp and clear. 
  // The user explicitly requested high quality, even if it takes more time.
  const thumbnailScale = 1.5;
  const viewport = page.getViewport({ scale: thumbnailScale });
  const canvas = document.createElement('canvas');
  const context = getCanvasRenderingContext(canvas);

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const blob = await blobFromCanvas(canvas);
  const thumbnailUrl = URL.createObjectURL(blob);

  page.cleanup();

  return {
    thumbnailUrl,
    thumbnailWidth: canvas.width,
    thumbnailHeight: canvas.height,
    pageWidth: Math.round(baseViewport.width),
    pageHeight: Math.round(baseViewport.height),
  };
}

export async function renderPdfPageImage(pdfDocument, pageIndex, scale = 2) {
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = getCanvasRenderingContext(canvas);

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const blob = await blobFromCanvas(canvas);

  page.cleanup();

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  };
}

export async function extractPdfTextPages(sourceBytes) {
  const pdfDocument = await loadPdfDocument(sourceBytes);

  try {
    const pages = [];

    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex + 1);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({
        pageNumber: pageIndex + 1,
        text,
      });
    }

    return pages;
  } finally {
    await pdfDocument.destroy();
  }
}

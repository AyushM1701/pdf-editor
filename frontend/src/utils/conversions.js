import { extractPdfTextPages, loadPdfDocument, renderPdfPageImage } from './pdfjs';
import {
  downloadBlob,
  downloadBytes,
  downloadZip,
  ensureFileExtension,
  sanitizeFileStem,
} from './download';

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(
          new Error(
            'The browser could not convert the image into a PDF-safe format.',
          ),
        );
        return;
      }

      resolve(blob);
    }, 'image/png');
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name} could not be read as an image.`));
    };

    image.src = objectUrl;
  });
}

export async function prepareImagesForPdf(files) {
  const supportedFiles = Array.from(files).filter((file) =>
    file.type.startsWith('image/'),
  );

  if (!supportedFiles.length) {
    throw new Error('Choose one or more PNG, JPEG, WebP, or GIF files first.');
  }

  const preparedImages = [];

  for (const file of supportedFiles) {
    const image = await loadImage(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('The browser could not create a canvas for image conversion.');
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);

    const pngBlob = await canvasToPngBlob(canvas);
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

    preparedImages.push({
      name: file.name,
      width: canvas.width,
      height: canvas.height,
      mimeType: 'image/png',
      bytes: pngBytes,
    });
  }

  return preparedImages;
}

export async function exportPdfAsImages({ bytes, fileName }) {
  const pdfDocument = await loadPdfDocument(bytes);
  const entries = [];

  try {
    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      const image = await renderPdfPageImage(pdfDocument, pageIndex, 2);
      entries.push({
        name: `${sanitizeFileStem(fileName)}-page-${pageIndex + 1}.png`,
        data: image.blob,
      });
    }
  } finally {
    await pdfDocument.destroy();
  }

  await downloadZip(entries, `${sanitizeFileStem(fileName)}-images.zip`);
}

export async function exportPdfAsWord({ bytes, fileName }) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const pages = await extractPdfTextPages(bytes);
  const sections = pages.map((page) => {
    const lines = page.text
      ? page.text.split(/\n+/).filter(Boolean)
      : ['No text was detected on this page.'];

    return {
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun(`Page ${page.pageNumber}`)],
        }),
        ...lines.map(
          (line) =>
            new Paragraph({
              children: [new TextRun(line)],
            }),
        ),
      ],
    };
  });

  const document = new Document({
    creator: 'Hybrid PDF Workbench',
    title: sanitizeFileStem(fileName),
    sections,
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(
    blob,
    ensureFileExtension(sanitizeFileStem(fileName), '.docx'),
  );
}

export async function extractWordText(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  const normalizedText = value.replace(/\r/g, '').trim();

  if (!normalizedText) {
    throw new Error('The selected Word document did not contain readable text.');
  }

  return normalizedText;
}

export function downloadPdfBytes(bytes, fileName) {
  downloadBytes(bytes, ensureFileExtension(fileName, '.pdf'), 'application/pdf');
}

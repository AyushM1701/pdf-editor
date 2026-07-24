import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function sanitizeFileName(fileName, fallback = 'hybrid-pdf-export') {
  const stem = String(fileName || fallback)
    .replace(/\.[^.]+$/u, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/gu, '-')
    .trim();

  const cleanStem = stem || fallback;
  return cleanStem.toLowerCase().endsWith('.pdf') ? cleanStem : `${cleanStem}.pdf`;
}

function hexToRgb(colorValue) {
  const cleanColor = String(colorValue || '#0f172a').replace('#', '').trim();
  const expandedColor =
    cleanColor.length === 3
      ? cleanColor
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : cleanColor;
  const normalizedColor = /^[0-9a-fA-F]{6}$/.test(expandedColor)
    ? expandedColor
    : '0f172a';

  return rgb(
    parseInt(normalizedColor.slice(0, 2), 16) / 255,
    parseInt(normalizedColor.slice(2, 4), 16) / 255,
    parseInt(normalizedColor.slice(4, 6), 16) / 255,
  );
}

function drawAnnotationText(pdfPage, annotation) {
  const pageWidth = pdfPage.getWidth();
  const pageHeight = pdfPage.getHeight();
  const fontSize = Number(annotation.fontSize) || 16;
  const xPercent = Math.max(0, Math.min(100, Number(annotation.xPercent) || 0));
  const yPercent = Math.max(0, Math.min(100, Number(annotation.yPercent) || 0));
  const x = Math.max(0, Math.min(pageWidth - 24, (pageWidth * xPercent) / 100));
  const startY = pageHeight - (pageHeight * yPercent) / 100 - fontSize;
  const lines = String(annotation.text || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const lineHeight = fontSize * 1.2;

  lines.forEach((line, index) => {
    pdfPage.drawText(line, {
      x,
      y: startY - index * lineHeight,
      size: fontSize,
      color: hexToRgb(annotation.color),
      lineHeight,
      maxWidth: Math.max(0, pageWidth - x - 12),
    });
  });
}

async function buildExportedPdf({ documents, fileName, metadata, pages, pageNumbering, watermark }) {
  if (!pages.length) {
    throw new Error('There are no pages available to export.');
  }

  const outputDocument = await PDFDocument.create();
  const sourceDocumentMap = new Map();

  for (const document of documents) {
    if (!document.bytes) {
      throw new Error(`Missing source bytes for ${document.fileName}.`);
    }

    const sourceDocument = await PDFDocument.load(document.bytes, {
      updateMetadata: false,
    });

    try {
      const form = sourceDocument.getForm();
      const documentPages = pages.filter(p => p.documentId === document.id);
      const modifiedFields = documentPages.flatMap(p => p.formFields || []);

      for (const mf of modifiedFields) {
        try {
          const field = form.getField(mf.name);
          if (mf.type === 'PDFTextField') field.setText(mf.value || '');
          else if (mf.type === 'PDFCheckBox') {
            if (mf.value) field.check(); else field.uncheck();
          }
          else if (mf.type === 'PDFRadioGroup' || mf.type === 'PDFDropdown' || mf.type === 'PDFOptionList') {
             field.select(mf.value || '');
          }
        } catch(e) {
          // ignore individual field mapping errors
        }
      }
      form.flatten();
    } catch(e) {
      // document might not have a form or flattening failed
    }

    sourceDocumentMap.set(document.id, sourceDocument);
  }

  const font = await outputDocument.embedFont(StandardFonts.Helvetica);
  let pageIndex = 1;

  for (const page of pages) {
    const sourceDocument = sourceDocumentMap.get(page.documentId);

    if (!sourceDocument) {
      throw new Error('A page references a source document that is not loaded.');
    }

    const [copiedPage] = await outputDocument.copyPages(sourceDocument, [
      page.sourcePageIndex,
    ]);
    const currentRotation = copiedPage.getRotation().angle;

    copiedPage.setRotation(degrees((currentRotation + page.rotation) % 360));

    if (page.cropBox) {
      const width = copiedPage.getWidth();
      const height = copiedPage.getHeight();
      const { xPercent, yPercent, widthPercent, heightPercent } = page.cropBox;
      
      const x = (width * xPercent) / 100;
      const y = height - (height * (yPercent + heightPercent)) / 100;
      const w = (width * widthPercent) / 100;
      const h = (height * heightPercent) / 100;
      
      copiedPage.setCropBox(x, y, w, h);
    }

    if (Array.isArray(page.annotations)) {
      const { width, height } = copiedPage.getSize();
      
      for (const annotation of page.annotations) {
        if (annotation.type === 'redaction') {
          // Redactions are true redacts handled by the backend PyMuPDF pass, skip them in pdf-lib!
          continue;
        }

        if (annotation.type === 'text' || !annotation.type) {
          if (annotation.text?.trim()) {
            drawAnnotationText(copiedPage, annotation);
          }
        } else if (annotation.type === 'draw' && annotation.points?.length > 1) {
          const path = annotation.points.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${(p.xPercent / 100) * width} ${height - (p.yPercent / 100) * height}`
          ).join(' ');
          
          copiedPage.drawSvgPath(path, {
            borderColor: hexToRgb(annotation.color),
            borderWidth: annotation.strokeWidth || 4,
          });
        } else if (['shape-rect', 'shape-circle', 'highlight'].includes(annotation.type)) {
          const x = (annotation.xPercent / 100) * width;
          const w = (annotation.widthPercent / 100) * width;
          const h = (annotation.heightPercent / 100) * height;
          // PDF y is from bottom, and we need the bottom-left corner of the shape for drawing rects
          const y = height - (annotation.yPercent / 100) * height - h;
          
          if (annotation.type === 'shape-rect') {
            copiedPage.drawRectangle({
              x, y, width: w, height: h,
              borderColor: hexToRgb(annotation.color),
              borderWidth: annotation.strokeWidth || 4,
            });
          } else if (annotation.type === 'highlight') {
            copiedPage.drawRectangle({
              x, y, width: w, height: h,
              color: hexToRgb(annotation.color),
              opacity: 0.4,
            });
          } else if (annotation.type === 'shape-circle') {
            copiedPage.drawEllipse({
              x: x + w / 2, y: y + h / 2,
              xScale: w / 2, yScale: h / 2,
              borderColor: hexToRgb(annotation.color),
              borderWidth: annotation.strokeWidth || 4,
            });
          }
        } else if (annotation.type === 'image' && annotation.dataUrl) {
          const x = (annotation.xPercent / 100) * width;
          const w = (annotation.widthPercent / 100) * width;
          const h = (annotation.heightPercent / 100) * height;
          const y = height - (annotation.yPercent / 100) * height - h;
          
          // Cache the embedded image on the outputDocument object to avoid bloating
          outputDocument._imageCache = outputDocument._imageCache || new Map();
          let embeddedImage = outputDocument._imageCache.get(annotation.dataUrl);
          
          if (!embeddedImage) {
            if (annotation.dataUrl.startsWith('data:image/jpeg') || annotation.dataUrl.startsWith('data:image/jpg')) {
              embeddedImage = await outputDocument.embedJpg(annotation.dataUrl);
            } else {
              embeddedImage = await outputDocument.embedPng(annotation.dataUrl);
            }
            outputDocument._imageCache.set(annotation.dataUrl, embeddedImage);
          }
          
          copiedPage.drawImage(embeddedImage, {
            x, y, width: w, height: h
          });
        }
      }
    }

    if (watermark?.text) {
      const { width, height } = copiedPage.getSize();
      const textWidth = font.widthOfTextAtSize(watermark.text, 48);
      copiedPage.drawText(watermark.text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: 48,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: watermark.opacity || 0.3,
        rotate: degrees(watermark.rotation || 45),
      });
    }

    if (pageNumbering) {
      const { width } = copiedPage.getSize();
      const text = `Page ${pageIndex} of ${pages.length}`;
      const textWidth = font.widthOfTextAtSize(text, 10);
      copiedPage.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: 20,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    }

    outputDocument.addPage(copiedPage);
    pageIndex += 1;
  }

  if (metadata?.title) {
    outputDocument.setTitle(metadata.title);
  }

  if (metadata?.author) {
    outputDocument.setAuthor(metadata.author);
  }

  if (metadata?.subject) {
    outputDocument.setSubject(metadata.subject);
  }

  outputDocument.setProducer('Hybrid PDF Workbench');
  outputDocument.setCreator('Hybrid PDF Workbench');

  const savedBytes = await outputDocument.save();
  return {
    bytes: savedBytes.buffer,
    fileName: sanitizeFileName(fileName),
  };
}

async function buildTextPdf({ fileName, text, title }) {
  const outputDocument = await PDFDocument.create();
  const font = await outputDocument.embedFont(StandardFonts.Helvetica);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const fontSize = 12;
  const lineHeight = 18;
  const maxWidth = pageWidth - margin * 2;
  let currentPage = outputDocument.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  if (title) {
    currentPage.drawText(title, {
      x: margin,
      y: cursorY,
      size: 20,
      font,
      color: rgb(0.06, 0.09, 0.14),
    });
    cursorY -= 34;
  }

  const wrapLine = (line) => {
    if (!line.trim()) {
      return [''];
    }

    const words = line.split(/\s+/);
    const wrappedLines = [];
    let currentLine = words.shift() ?? '';

    words.forEach((word) => {
      const candidate = `${currentLine} ${word}`.trim();

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        wrappedLines.push(currentLine);
        currentLine = word;
      }
    });

    wrappedLines.push(currentLine);
    return wrappedLines;
  };

  String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .forEach((paragraph) => {
      const lines = wrapLine(paragraph);

      if (cursorY - lineHeight * lines.length < margin) {
        currentPage = outputDocument.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }

      lines.forEach((line) => {
        currentPage.drawText(line, {
          x: margin,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.06, 0.09, 0.14),
        });
        cursorY -= lineHeight;
      });

      cursorY -= 8;
    });

  const savedBytes = await outputDocument.save();
  return {
    bytes: savedBytes.buffer,
    fileName: sanitizeFileName(fileName),
  };
}

async function buildImagePdf({ fileName, images, metadata }) {
  if (!images?.length) {
    throw new Error('There are no images available to convert into a PDF.');
  }

  const outputDocument = await PDFDocument.create();

  for (const image of images) {
    let embeddedImage;
    if (image.type === 'image/jpeg' || image.type === 'image/jpg') {
      embeddedImage = await outputDocument.embedJpg(image.bytes);
    } else {
      embeddedImage = await outputDocument.embedPng(image.bytes);
    }
    const page = outputDocument.addPage([image.width, image.height]);

    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  if (metadata?.title) {
    outputDocument.setTitle(metadata.title);
  }

  if (metadata?.author) {
    outputDocument.setAuthor(metadata.author);
  }

  if (metadata?.subject) {
    outputDocument.setSubject(metadata.subject);
  }

  outputDocument.setProducer('Hybrid PDF Workbench');
  outputDocument.setCreator('Hybrid PDF Workbench');

  const savedBytes = await outputDocument.save();
  return {
    bytes: savedBytes.buffer,
    fileName: sanitizeFileName(fileName),
  };
}

self.onmessage = async (event) => {
  const { requestId, type, payload } = event.data ?? {};

  if (!type) {
    return;
  }

  try {
    let result;

    if (type === 'EXPORT_PDF') {
      result = await buildExportedPdf(payload);
    } else if (type === 'CREATE_TEXT_PDF') {
      result = await buildTextPdf(payload);
    } else if (type === 'CREATE_IMAGE_PDF') {
      result = await buildImagePdf(payload);
    } else {
      throw new Error(`Unsupported worker task: ${type}`);
    }

    self.postMessage(
      {
        requestId,
        status: 'success',
        payload: result,
      },
      [result.bytes],
    );
  } catch (error) {
    self.postMessage({
      requestId,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'The PDF worker could not finish the requested task.',
    });
  }
};

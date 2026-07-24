import { arrayMove } from '@dnd-kit/sortable';
import { PDFDocument } from 'pdf-lib';
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { hasMeaningfulMetadata, normalizeMetadata } from '../schemas/pdfState';
import {
  downloadBytes,
  downloadZip,
  ensureFileExtension,
  sanitizeFileStem,
} from '../utils/download';
import { downloadPdfBytes } from '../utils/conversions';
import { loadPdfDocument, renderPageThumbnail } from '../utils/pdfjs';
import { useExportWorker } from './useExportWorker';
import { clearThumbnailCaches } from '../components/ThumbnailCanvas';
import localforage from 'localforage';
import { usePasswordModal } from '../context/PasswordModalContext';
import { decryptPdf, encryptPdf, optimizePdf, signPdf, redactPdf } from '../api/apiClient';
import toast from 'react-hot-toast';

import { useUndoRedo } from './useUndoRedo';
import { parsePageRange } from '../utils/pageRanges';

const EMPTY_METADATA = Object.freeze({
  title: '',
  author: '',
  subject: '',
});

function getFriendlyPdfError(fileName, error) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('encrypted')) {
    return `${fileName} is encrypted and cannot be edited in the local workspace yet.`;
  }

  if (
    normalizedMessage.includes('invalid pdf') ||
    normalizedMessage.includes('failed to parse') ||
    normalizedMessage.includes('formaterror')
  ) {
    return `${fileName} appears to be corrupted or unreadable.`;
  }

  return `${fileName} could not be processed: ${message}`;
}

function buildExportFileName(metadata, documents) {
  const baseName =
    metadata.title?.trim().replace(/\.pdf$/i, '') ||
    documents[0]?.fileName?.replace(/\.pdf$/i, '') ||
    'hybrid-pdf-export';

  return `${baseName.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-').trim() || 'hybrid-pdf-export'}.pdf`;
}



function parseSplitExpression(rangeExpression, availablePageNumbers) {
  const normalizedExpression = String(rangeExpression || '').trim();

  if (!normalizedExpression) {
    throw new Error('Enter one or more page groups, for example 1-2;3-4;5.');
  }

  const availablePages = new Set(availablePageNumbers);

  return normalizedExpression.split(';').map((group) => {
    const trimmedGroup = group.trim();

    if (!trimmedGroup) {
      throw new Error('Split groups cannot be empty.');
    }

    const pages = [];

    trimmedGroup.split(',').forEach((token) => {
      const trimmedToken = token.trim();

      if (/^\d+$/u.test(trimmedToken)) {
        const pageNumber = Number(trimmedToken);

        if (!availablePages.has(pageNumber)) {
          throw new Error(`Page ${pageNumber} is not available in the selected PDF.`);
        }

        pages.push(pageNumber);
        return;
      }

      const rangeMatch = trimmedToken.match(/^(\d+)\s*-\s*(\d+)$/u);
      if (!rangeMatch) {
        throw new Error(
          `Could not understand "${trimmedToken}". Use formats like 1, 3-5, or 1-2;3-4.`,
        );
      }

      const startPage = Number(rangeMatch[1]);
      const endPage = Number(rangeMatch[2]);

      if (endPage < startPage) {
        throw new Error(
          `Invalid range ${trimmedToken}. The end page must be after the start page.`,
        );
      }

      for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
        if (!availablePages.has(pageNumber)) {
          throw new Error(`Page ${pageNumber} is not available in the selected PDF.`);
        }

        pages.push(pageNumber);
      }
    });

    return Array.from(new Set(pages));
  });
}

export function useLocalPDF() {
  const { requestPassword } = usePasswordModal();
  const [documents, setDocuments] = useState([]);
  const { state: pages, setState: setPages, undo, redo, canUndo, canRedo, resetState } = useUndoRedo([]);
  const [metadata, setMetadata] = useState({ ...EMPTY_METADATA });
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [workspaceError, setWorkspaceError] = useState(null);
  
  // Search state
  const [activeSearchHighlight, setActiveSearchHighlight] = useState(null);
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const documentStoreRef = useRef(new Map());
  const { createImagePdf, createTextPdf, exportPdf } = useExportWorker();

  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  
  const clearWorkspace = useCallback(() => {
    documentStoreRef.current.clear();
    clearThumbnailCaches();
    localforage.removeItem('pdf_workspace_state').catch(() => {});

    startTransition(() => {
      setDocuments([]);
      resetState([]);
      setMetadata({ ...EMPTY_METADATA });
      setSelectedPageId(null);
      setWorkspaceError('');
    });
  }, [resetState]);

  useEffect(() => {
    let mounted = true;
    localforage.getItem('pdf_workspace_state').then((state) => {
      if (mounted && state && state.pages && state.pages.length > 0) {
        if (window.confirm("You have an unsaved PDF workspace session. Would you like to restore it?")) {
          setMetadata(state.metadata || { ...EMPTY_METADATA });
          setDocuments(state.documents || []);
          
          state.documents?.forEach(doc => {
            if (doc.bytes) {
              documentStoreRef.current.set(doc.id, { 
                bytes: doc.bytes, 
                file: new File([doc.bytes], doc.fileName, { type: 'application/pdf' }) 
              });
            }
          });
          
          resetState(state.pages || []);
        } else {
          localforage.removeItem('pdf_workspace_state').catch(() => {});
        }
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [resetState]);

  useEffect(() => {
    if (pages.length > 0) {
      const serializableDocs = documents.map(d => ({
        ...d,
        bytes: documentStoreRef.current.get(d.id)?.bytes,
      }));
      localforage.setItem('pdf_workspace_state', {
        metadata,
        documents: serializableDocs,
        pages,
      }).catch(() => {});
    } else if (documents.length === 0) {
      localforage.removeItem('pdf_workspace_state').catch(() => {});
    }
  }, [metadata, documents, pages]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pages.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pages.length]);

  const ingestFiles = useCallback(async (incomingFiles) => {
    if (!incomingFiles.length) {
      return;
    }


    setIsParsing(true);
    setParseProgress({ current: 0, total: 0 });
    setWorkspaceError('');

    const preparedDocuments = [];
    const preparedPages = [];
    const failures = [];
    let metadataSeed = null;
    // Read the current page count at call time (not from closure) for limit checking.
    // We use a synchronous state read via a temporary variable set from the updater.
    let existingPageCount = 0;
    setPages(prev => { existingPageCount = prev.length; return prev; });
    let accumulatedPages = existingPageCount;

    for (const item of incomingFiles) {
      // Support raw File or configured object
      const file = item instanceof File ? item : item.file;
      const pageRangeStr = item instanceof File ? '' : item.pageRange || '';

      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        failures.push(`${file.name} was skipped because it is not a PDF.`);
        continue;
      }

      try {
        const sourceBytes = new Uint8Array(await file.arrayBuffer());
        let pdfLibDocument = await PDFDocument.load(sourceBytes, {
          updateMetadata: false,
        });

        let finalSourceBytes = sourceBytes;

        if (pdfLibDocument.isEncrypted) {
          try {
            let decryptedBlob = null;
            let currentError = '';
            
            // Allow multiple attempts
            while (!decryptedBlob) {
              const password = await requestPassword(file.name, currentError);
              try {
                decryptedBlob = await decryptPdf(file, password);
              } catch (err) {
                currentError = err.message || 'Incorrect password.';
              }
            }
            
            finalSourceBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
            // Reload the decrypted document
            pdfLibDocument = await PDFDocument.load(finalSourceBytes, {
              updateMetadata: false,
            });
          } catch (err) {
            // User cancelled the prompt or another error occurred
            throw new Error(`Skipped encrypted file: ${err.message}`);
          }
        }
        
        const pageCount = pdfLibDocument.getPageCount();
        const validPageIndices = parsePageRange(pageRangeStr, pageCount);
        
        if (accumulatedPages + validPageIndices.length > 100) {
          throw new Error('Adding these pages would exceed the maximum workspace limit of 100 pages.');
        }
        accumulatedPages += validPageIndices.length;

        const pdfJsDocument = await loadPdfDocument(finalSourceBytes);
        const documentId = crypto.randomUUID();
        const sourceMetadata = normalizeMetadata({
          title: pdfLibDocument.getTitle() ?? '',
          author: pdfLibDocument.getAuthor() ?? '',
          subject: pdfLibDocument.getSubject() ?? '',
        });

        if (!metadataSeed && hasMeaningfulMetadata(sourceMetadata)) {
          metadataSeed = sourceMetadata;
        }

        documentStoreRef.current.set(documentId, {
          bytes: finalSourceBytes,
          file: new File([finalSourceBytes], file.name, { type: 'application/pdf' }),
        });

        preparedDocuments.push({
          id: documentId,
          fileName: file.name,
          fileSize: file.size,
          pageCount: pdfLibDocument.getPageCount(),
        });

        // Extract AcroForm fields if any
        const extractedFields = [];
        try {
          const form = pdfLibDocument.getForm();
          const fields = form.getFields();
          const docPages = pdfLibDocument.getPages();

          for (const field of fields) {
            const type = field.constructor.name;
            const name = field.getName();
            let value = '';
            
            if (type === 'PDFTextField') value = field.getText() || '';
            if (type === 'PDFCheckBox') value = field.isChecked();
            if (type === 'PDFRadioGroup') value = field.getSelected() || '';
            if (type === 'PDFDropdown' || type === 'PDFOptionList') {
              const selected = field.getSelected();
              value = Array.isArray(selected) ? selected[0] : (selected || '');
            }

            const widgets = field.acroField.getWidgets();
            widgets.forEach(widget => {
              const rect = widget.getRectangle(); // {x, y, width, height} in PDF points
              try {
                const widgetPage = form.findWidgetPage(widget);
                const sourcePageIndex = docPages.indexOf(widgetPage);
                if (sourcePageIndex !== -1) {
                  extractedFields.push({
                    id: crypto.randomUUID(),
                    name,
                    type,
                    value,
                    sourcePageIndex,
                    rect,
                  });
                }
              } catch(e) {}
            });
          }
        } catch(e) {
          // Ignore form extraction errors
        }

        try {
          // Filter down to the user-selected pages, maintaining their order
          for (let idx = 0; idx < validPageIndices.length; idx++) {
            const sourcePageIndex = validPageIndices[idx];
            let viewport = { width: 595, height: 842 };
            let rotate = 0;
            let pdfJsPage = null;
            
            try {
              pdfJsPage = await pdfJsDocument.getPage(sourcePageIndex + 1);
              viewport = pdfJsPage.getViewport({ scale: 1 });
              rotate = pdfJsPage.rotate;
            } catch (err) {
              console.warn(`Failed to get page ${sourcePageIndex + 1} from pdfjs`, err);
            }
            
            let thumbnailUrl = '';
            let thumbnailWidth = 100;
            let thumbnailHeight = 150;
            try {
              const thumbnailResult = await renderPageThumbnail(pdfJsDocument, sourcePageIndex);
              thumbnailUrl = thumbnailResult.thumbnailUrl;
              thumbnailWidth = thumbnailResult.thumbnailWidth;
              thumbnailHeight = thumbnailResult.thumbnailHeight;
            } catch (err) {
              console.warn(`Failed to render thumbnail for page ${sourcePageIndex + 1}`, err);
            }

            const pageFields = extractedFields
              .filter((f) => f.sourcePageIndex === sourcePageIndex)
              .map((f) => {
                const pageWidth = viewport.width;
                const pageHeight = viewport.height;
                // Convert PDF points to percentages
                const xPercent = (f.rect.x / pageWidth) * 100;
                const yPercent = ((pageHeight - (f.rect.y + f.rect.height)) / pageHeight) * 100;
                const widthPercent = (f.rect.width / pageWidth) * 100;
                const heightPercent = (f.rect.height / pageHeight) * 100;
                return { ...f, xPercent, yPercent, widthPercent, heightPercent };
              });
              
            let textItems = [];
            try {
              if (pdfJsPage) {
                const textContent = await pdfJsPage.getTextContent();
                textItems = textContent.items.map(item => {
                  const x = item.transform[4];
                  const y = item.transform[5];
                  const xPercent = (x / viewport.width) * 100;
                  const yPercent = ((viewport.height - (y + item.height)) / viewport.height) * 100;
                  const widthPercent = (item.width / viewport.width) * 100;
                  const heightPercent = (item.height / viewport.height) * 100;
                  return { str: item.str, xPercent, yPercent, widthPercent, heightPercent };
                });
              }
            } catch (err) {
              console.warn(`Failed to extract text for page ${sourcePageIndex + 1}`, err);
            }

            preparedPages.push({
              id: crypto.randomUUID(),
              documentId,
              sourcePageIndex,
              pageNumber: sourcePageIndex + 1,
              width: Math.round(viewport.width),
              height: Math.round(viewport.height),
              rotation: rotate,
              thumbnailUrl,
              thumbnailWidth,
              thumbnailHeight,
              annotations: [],
              formFields: pageFields,
              textItems,
              fileName: file.name,
              fileSize: file.size,
            });
            
            if (pdfJsPage) {
              pdfJsPage.cleanup();
            }
          }
        } finally {
          await pdfJsDocument.destroy();
        }
      } catch (error) {
        failures.push(getFriendlyPdfError(file.name, error));
      }
    }

    startTransition(() => {
      if (preparedDocuments.length) {
        setDocuments((currentDocuments) => currentDocuments.concat(preparedDocuments));
        setPages((currentPages) => currentPages.concat(preparedPages));
        setSelectedPageId(
          (currentSelectedPageId) =>
            currentSelectedPageId ?? preparedPages[0]?.id ?? null,
        );
        setMetadata((currentMetadata) =>
          hasMeaningfulMetadata(currentMetadata) || !metadataSeed
            ? currentMetadata
            : metadataSeed,
        );
      }
    });

    if (failures.length) {
      setWorkspaceError(failures.join(' '));
    }

    setIsParsing(false);
    setParseProgress(null);
  }, [resetState]);

  const reorderPages = useCallback((activeId, overId) => {
    setPages((currentPages) => {
      const oldIndex = currentPages.findIndex((page) => page.id === activeId);
      const newIndex = currentPages.findIndex((page) => page.id === overId);

      if (oldIndex < 0 || newIndex < 0) {
        return currentPages;
      }

      return arrayMove(currentPages, oldIndex, newIndex);
    });
  }, []);

  const rotatePage = useCallback((pageId) => {
    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation: (page.rotation + 90) % 360,
            }
          : page,
      ),
    );
  }, []);

  const duplicatePage = useCallback((pageId) => {
    setPages((currentPages) => {
      const pageIndex = currentPages.findIndex((page) => page.id === pageId);
      if (pageIndex < 0) return currentPages;
      
      const pageToDuplicate = currentPages[pageIndex];
      const newPage = {
        ...pageToDuplicate,
        id: crypto.randomUUID(), // Assign a new ID for the duplicate
        annotations: JSON.parse(JSON.stringify(pageToDuplicate.annotations || [])), // Deep copy annotations
        formFields: JSON.parse(JSON.stringify(pageToDuplicate.formFields || [])), // Deep copy form fields
      };
      
      const nextPages = [...currentPages];
      nextPages.splice(pageIndex + 1, 0, newPage);
      return nextPages;
    });
  }, []);

  const updateFormField = useCallback((pageId, fieldId, newValue) => {
    setPages((currentPages) =>
      currentPages.map((page) => {
        if (page.id !== pageId || !page.formFields) return page;
        return {
          ...page,
          formFields: page.formFields.map((field) =>
            field.id === fieldId ? { ...field, value: newValue } : field
          ),
        };
      })
    );
  }, []);

  const removePage = useCallback(
    (pageId) => {
      setPages((currentPages) => {
        const pageToRemove = currentPages.find((page) => page.id === pageId);

        const nextPages = currentPages.filter((page) => page.id !== pageId);

        if (pageToRemove) {
          const docId = pageToRemove.documentId;
          const stillHasPages = nextPages.some((p) => p.documentId === docId);
          if (!stillHasPages) {
            setDocuments((docs) => docs.filter((d) => d.id !== docId));
            documentStoreRef.current.delete(docId);
          }
        }

        setSelectedPageId((currentSelectedPageId) => {
          if (currentSelectedPageId !== pageId) {
            return currentSelectedPageId;
          }

          return nextPages[0]?.id ?? null;
        });

        return nextPages;
      });
    },
    [],
  );

  const selectPage = useCallback((pageId) => {
    setSelectedPageId(pageId);
  }, []);

  const updateMetadata = useCallback((key, value) => {
    setMetadata((currentMetadata) => ({
      ...currentMetadata,
      [key]: value,
    }));
  }, []);

  const addPageAnnotation = useCallback((pageId, annotationInput) => {
    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              annotations: [
                ...(page.annotations ?? []),
                {
                  ...annotationInput,
                  id: annotationInput.id || crypto.randomUUID(),
                  type: annotationInput.type || 'text',
                },
              ],
            }
          : page,
      ),
    );
  }, []);

  const removeAnnotation = useCallback((pageId, annotationId) => {
    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              annotations: (page.annotations ?? []).filter(
                (annotation) => annotation.id !== annotationId,
              ),
            }
          : page,
      ),
    );
  }, []);

  const updateAnnotation = useCallback((pageId, annotationId, updates) => {
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.fontSize !== undefined) {
      sanitizedUpdates.fontSize = Math.max(8, Math.min(72, Number(sanitizedUpdates.fontSize) || 8));
    }
    if (sanitizedUpdates.xPercent !== undefined) {
      sanitizedUpdates.xPercent = Math.max(0, Math.min(100, Number(sanitizedUpdates.xPercent) || 0));
    }
    if (sanitizedUpdates.yPercent !== undefined) {
      sanitizedUpdates.yPercent = Math.max(0, Math.min(100, Number(sanitizedUpdates.yPercent) || 0));
    }

    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              annotations: (page.annotations ?? []).map((annotation) =>
                annotation.id === annotationId
                  ? { ...annotation, ...sanitizedUpdates }
                  : annotation,
              ),
            }
          : page,
      ),
    );
  }, []);

  const updatePageCropBox = useCallback((pageId, cropBox) => {
    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              cropBox,
            }
          : page,
      ),
    );
  }, []);

  const exportDocument = useCallback(async (exportOptions = {}) => {
    if (!pages.length) {
      return;
    }

    setIsExporting(true);
    setWorkspaceError('');

    try {
      const payload = {
        metadata: normalizeMetadata(metadata),
        fileName: buildExportFileName(metadata, documents),
        ...exportOptions,
        documents: documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          bytes: documentStoreRef.current.get(document.id)?.bytes,
        })),
        pages: pages.map((page) => ({
          documentId: page.documentId,
          sourcePageIndex: page.sourcePageIndex,
          rotation: page.rotation,
          annotations: page.annotations ?? [],
          formFields: page.formFields ?? [],
          cropBox: page.cropBox ?? null,
        })),
      };

      const result = await exportPdf(payload);
      let finalBytes;

      // Check for redactions
      const redactions = pages.map((page, index) => {
        const pageRedactions = (page.annotations || []).filter(a => a.type === 'redaction');
        if (pageRedactions.length > 0) {
          return { pageIndex: index, rects: pageRedactions.map(r => ({
            xPercent: r.xPercent,
            yPercent: r.yPercent,
            widthPercent: r.widthPercent,
            heightPercent: r.heightPercent,
            color: r.color
          }))};
        }
        return null;
      }).filter(Boolean);

      const loadingToast = toast.loading('Processing document...');

      if (redactions.length > 0) {
        toast.loading('Applying permanent redactions...', { id: loadingToast });
        const blob = new Blob([result.bytes], { type: 'application/pdf' });
        const redactedBlob = await redactPdf(blob, redactions);
        finalBytes = new Uint8Array(await redactedBlob.arrayBuffer());
      } else {
        finalBytes = result.bytes;
      }

      if (exportOptions.compress) {
        toast.loading('Optimizing PDF...', { id: loadingToast });
        try {
          const originalSize = finalBytes.length;
          const blob = new Blob([finalBytes], { type: 'application/pdf' });
          const optimizedBlob = await optimizePdf(blob);
          finalBytes = new Uint8Array(await optimizedBlob.arrayBuffer());
          
          const newSize = finalBytes.length;
          const savedMb = ((originalSize - newSize) / (1024 * 1024)).toFixed(1);
          const origMb = (originalSize / (1024 * 1024)).toFixed(1);
          const percent = Math.round((1 - newSize / originalSize) * 100);
          
          toast.success(`Optimized! Saved ${percent}% (${origMb}MB ➔ ${(newSize / (1024 * 1024)).toFixed(1)}MB)`, { id: loadingToast });
        } catch (err) {
          toast.error('Optimization failed. Exporting original instead.', { id: loadingToast });
        }
      }

      if (exportOptions.encryption) {
        if (exportOptions.encryption.userPassword || exportOptions.encryption.ownerPassword) {
          const blob = new Blob([finalBytes], { type: 'application/pdf' });
          const encryptedBlob = await encryptPdf(blob, exportOptions.encryption);
          finalBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
        }
        
        if (exportOptions.encryption.signDocument) {
          const blob = new Blob([finalBytes], { type: 'application/pdf' });
          const signedBlob = await signPdf(blob);
          finalBytes = new Uint8Array(await signedBlob.arrayBuffer());
          toast.success('Document cryptographically signed', { id: loadingToast });
        }
      }

      downloadPdfBytes(finalBytes, result.fileName);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : 'The local export worker failed to build the PDF.',
      );
    } finally {
      setIsExporting(false);
    }
  }, [documents, exportPdf, metadata, pages]);

  const splitDocument = useCallback(
    async ({ documentId, mode, rangeExpression }) => {
      const sourceDocument = documents.find((document) => document.id === documentId);
      const storedDocument = documentStoreRef.current.get(documentId);
      const documentPages = pages
        .filter((page) => page.documentId === documentId)
        .sort((leftPage, rightPage) => leftPage.sourcePageIndex - rightPage.sourcePageIndex);

      if (!sourceDocument || !storedDocument?.bytes) {
        setWorkspaceError('The selected PDF is no longer available in memory.');
        return;
      }

      if (!documentPages.length) {
        setWorkspaceError('The selected PDF has no pages left to split.');
        return;
      }

      setIsExporting(true);
      setWorkspaceError('');

      try {
        const groups =
          mode === 'per-page'
            ? documentPages.map((page) => [page.pageNumber])
            : parseSplitExpression(
                rangeExpression,
                documentPages.map((page) => page.pageNumber),
              );

        const splitOutputs = [];

        for (const group of groups) {
          const selectedPages = group
            .map((pageNumber) =>
              documentPages.find((page) => page.pageNumber === pageNumber),
            )
            .filter(Boolean);
          const label =
            group.length === 1
              ? `page-${group[0]}`
              : `pages-${group[0]}-${group[group.length - 1]}`;

          const result = await exportPdf({
            metadata: normalizeMetadata(metadata),
            fileName: ensureFileExtension(
              `${sanitizeFileStem(sourceDocument.fileName)}-${label}`,
              '.pdf',
            ),
            documents: [
              {
                id: sourceDocument.id,
                fileName: sourceDocument.fileName,
                bytes: storedDocument.bytes,
              },
            ],
            pages: selectedPages.map((page) => ({
              documentId: sourceDocument.id,
              sourcePageIndex: page.sourcePageIndex,
              rotation: page.rotation,
              annotations: page.annotations ?? [],
              cropBox: page.cropBox ?? null,
            })),
          });

          splitOutputs.push(result);
        }

        if (splitOutputs.length === 1) {
          downloadPdfBytes(splitOutputs[0].bytes, splitOutputs[0].fileName);
        } else {
          await downloadZip(
            splitOutputs.map((output) => ({
              name: output.fileName,
              data: output.bytes,
            })),
            `${sanitizeFileStem(sourceDocument.fileName)}-split-files.zip`,
          );
        }
      } catch (error) {
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : 'The local split process could not build the requested files.',
        );
      } finally {
        setIsExporting(false);
      }
    },
    [documents, exportPdf, metadata, pages],
  );

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const getSourceDocument = useCallback((documentId) => {
    const storedDocument = documentStoreRef.current.get(documentId);
    if (!storedDocument) {
      return null;
    }

    return {
      bytes: storedDocument.bytes,
      file: storedDocument.file,
    };
  }, []);

  return {
    documents,
    pages,
    metadata,
    selectedPageId,
    selectedPage,
    workspaceError,
    isParsing,
    parseProgress,
    isExporting,
    activeSearchHighlight,
    setActiveSearchHighlight,
    ingestFiles,
    reorderPages,
    rotatePage,
    duplicatePage,
    removePage,
    selectPage,
    updateMetadata,
    addPageAnnotation,
    removeAnnotation,
    updateAnnotation,
    updatePageCropBox,
    updateFormField,
    exportDocument,
    splitDocument,
    clearWorkspace,
    getSourceDocument,
    createTextPdf,
    createImagePdf,
    undo,
    redo,
    canUndo,
    canRedo,
    signatureDataUrl,
    setSignatureDataUrl,
  };
}

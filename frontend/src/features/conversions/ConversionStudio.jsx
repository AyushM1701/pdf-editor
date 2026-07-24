import { useEffect, useState, useRef } from 'react';
import {
  downloadPdfBytes,
  exportPdfAsImages,
  exportPdfAsWord,
  extractWordText,
  prepareImagesForPdf,
} from '../../utils/conversions';
import { ensureFileExtension, sanitizeFileStem } from '../../utils/download';

export function ConversionStudio({
  createImagePdf,
  createTextPdf,
  documents,
  getSourceDocument,
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [externalSource, setExternalSource] = useState(null);
  const externalInputRef = useRef(null);
  
  const [status, setStatus] = useState({
    busy: false,
    message: '',
    kind: 'idle',
  });

  useEffect(() => {
    if (!documents.length) {
      setSelectedDocumentId('');
      return;
    }

    // Only auto-select if we aren't using an external source
    if (!externalSource) {
      const selectionStillExists = documents.some(
        (document) => document.id === selectedDocumentId,
      );

      if (!selectionStillExists) {
        setSelectedDocumentId(documents[0].id);
      }
    }
  }, [documents, selectedDocumentId, externalSource]);

  const setError = (message) => {
    setStatus({
      busy: false,
      message,
      kind: 'error',
    });
  };

  const setSuccess = (message) => {
    setStatus({
      busy: false,
      message,
      kind: 'success',
    });
  };

  const withBusyState = async (task) => {
    setStatus({
      busy: true,
      message: '',
      kind: 'idle',
    });

    try {
      await task();
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : 'The requested conversion could not be completed.',
      );
    }
  };

  const handleSelectLoaded = (event) => {
    setSelectedDocumentId(event.target.value);
    setExternalSource(null);
    if (externalInputRef.current) {
      externalInputRef.current.value = '';
    }
  };

  const handleExternalPdfImport = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) return;
    
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setExternalSource({ bytes, fileName: file.name });
      setSelectedDocumentId('');
    } catch (err) {
      setError('Could not load the selected PDF.');
    }
  };

  const getSelectedSource = () => {
    if (externalSource) {
      return externalSource;
    }

    const sourceDocument = getSourceDocument(selectedDocumentId);

    if (!sourceDocument?.bytes) {
      throw new Error('The selected PDF is no longer available in memory.');
    }

    const selectedDocument = documents.find(
      (document) => document.id === selectedDocumentId,
    );

    return {
      bytes: sourceDocument.bytes,
      fileName: selectedDocument?.fileName ?? 'converted-document.pdf',
    };
  };

  const handlePdfToImages = async () => {
    await withBusyState(async () => {
      const source = getSelectedSource();
      await exportPdfAsImages(source);
      setSuccess('Downloaded a ZIP with one PNG per PDF page.');
    });
  };

  const handlePdfToWord = async () => {
    await withBusyState(async () => {
      const source = getSelectedSource();
      await exportPdfAsWord(source);
      setSuccess('Downloaded a DOCX file generated from the PDF text layer.');
    });
  };

  const handleWordToPdf = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!file) {
      return;
    }

    await withBusyState(async () => {
      const extractedText = await extractWordText(file);
      const result = await createTextPdf({
        fileName: ensureFileExtension(sanitizeFileStem(file.name), '.pdf'),
        title: sanitizeFileStem(file.name),
        text: extractedText,
      });

      downloadPdfBytes(result.bytes, result.fileName);
      setSuccess('Downloaded a PDF generated from the Word document text.');
    });
  };

  const handleImagesToPdf = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    await withBusyState(async () => {
      const preparedImages = await prepareImagesForPdf(files);
      const result = await createImagePdf({
        fileName: ensureFileExtension(
          sanitizeFileStem(files[0].name, 'images-to-pdf'),
          '.pdf',
        ),
        metadata: {
          title: 'Image to PDF conversion',
          author: 'Hybrid PDF Workbench',
          subject: 'Images converted into a PDF locally in the browser',
        },
        images: preparedImages,
      });

      downloadPdfBytes(result.bytes, result.fileName);
      setSuccess('Downloaded a PDF created from the selected images.');
    });
  };

  return (
    <section className="surface-card px-6 py-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="section-kicker">Converters</span>
          <h2 className="font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            PDF, Word, and image conversion tools
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            PDF to images, PDF to Word, Word to PDF, and images to PDF all run
            locally. The Word conversion path is text-focused rather than a
            layout-perfect Office renderer.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-white/70 bg-white/65 dark:bg-slate-900/65 p-5">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                  PDF to images and Word
                </h3>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  Choose one of the PDFs already loaded, or import a new one.
                </p>
              </div>

              <div className="space-y-3">
                <label className="input-group">
                  <span>Loaded PDF</span>
                  <select
                    disabled={!documents.length || status.busy}
                    onChange={handleSelectLoaded}
                    value={selectedDocumentId}
                  >
                    {documents.length ? null : <option value="">Add a PDF first</option>}
                    {documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.fileName} - {document.pageCount} pages
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>

                <label className="rounded-[16px] border border-dashed border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 transition hover:border-slate-400 flex flex-col">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Import New PDF
                  </span>
                  <input
                    ref={externalInputRef}
                    accept=".pdf"
                    className="block w-full text-sm text-slate-700 dark:text-slate-300"
                    disabled={status.busy}
                    onChange={handleExternalPdfImport}
                    type="file"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <button
                  className="rounded-full border border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={(!selectedDocumentId && !externalSource) || status.busy}
                  onClick={handlePdfToImages}
                  type="button"
                >
                  Export PNG ZIP
                </button>
                <button
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={(!selectedDocumentId && !externalSource) || status.busy}
                  onClick={handlePdfToWord}
                  type="button"
                >
                  Convert to DOCX
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/70 bg-white/65 dark:bg-slate-900/65 p-5">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                  Word to PDF and images to PDF
                </h3>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  Import a `.docx` file for text-based PDF generation, or combine
                  multiple images into a new PDF.
                </p>
              </div>

              <div className="grid gap-3">
                <label className="rounded-[24px] border border-dashed border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/70 px-4 py-4 text-sm text-slate-700 dark:text-slate-300 transition hover:border-slate-400">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Word to PDF
                  </span>
                  <input
                    accept=".docx"
                    className="block w-full text-sm text-slate-700 dark:text-slate-300"
                    disabled={status.busy}
                    onChange={handleWordToPdf}
                    type="file"
                  />
                </label>

                <label className="rounded-[24px] border border-dashed border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/70 px-4 py-4 text-sm text-slate-700 dark:text-slate-300 transition hover:border-slate-400">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Images to PDF
                  </span>
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="block w-full text-sm text-slate-700 dark:text-slate-300"
                    disabled={status.busy}
                    multiple
                    onChange={handleImagesToPdf}
                    type="file"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        {status.message ? (
          <div
            className={`rounded-[24px] px-4 py-3 text-sm ${
              status.kind === 'error'
                ? 'border border-rose-200 bg-rose-50 text-rose-800'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {status.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}

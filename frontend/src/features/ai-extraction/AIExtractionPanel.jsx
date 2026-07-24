import { useDeferredValue, useEffect, useState, useMemo } from 'react';
import { downloadBlob } from '../../utils/download';
import { Search } from 'lucide-react';

export function AIExtractionPanel({
  documents,
  error,
  isRunning,
  onRunExtraction,
  result,
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [summarize, setSummarize] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredResult = useDeferredValue(result);

  useEffect(() => {
    if (!documents.length) {
      setSelectedDocumentId('');
      return;
    }

    const selectionStillExists = documents.some(
      (document) => document.id === selectedDocumentId,
    );

    if (!selectionStillExists) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (selectedDocumentId) {
      onRunExtraction(selectedDocumentId, { summarize });
    }
  };

  const handleDownloadJson = () => {
    if (!deferredResult) return;
    const blob = new Blob([JSON.stringify(deferredResult, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `extraction-${deferredResult.document_type}.json`);
  };

  const handleDownloadCsv = () => {
    if (!deferredResult || !deferredResult.fields.length) return;
    const headers = ['Field', 'Value', 'Confidence'];
    const rows = deferredResult.fields.map(f => `"${String(f.name).replace(/"/g, '""')}","${String(f.value).replace(/"/g, '""')}","${f.confidence}"`);
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    downloadBlob(blob, `extraction-${deferredResult.document_type}.csv`);
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-1">{part}</mark> 
            : part
        )}
      </span>
    );
  };

  const filteredFields = useMemo(() => {
    if (!deferredResult) return [];
    if (!searchQuery.trim()) return deferredResult.fields;
    
    const query = searchQuery.toLowerCase();
    return deferredResult.fields.filter(f => 
      String(f.name).toLowerCase().includes(query) || 
      String(f.value).toLowerCase().includes(query)
    );
  }, [deferredResult, searchQuery]);

  return (
    <section className="surface-card px-6 py-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="section-kicker">Cloud document AI</span>
          <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            Opt-in extraction pipeline
          </h2>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            This panel is the only place that uploads a file. It requests a
            presigned S3 URL, streams the chosen PDF directly to storage, and then
            asks the FastAPI service to run OCR plus structured extraction.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="input-group">
            <span>Source file</span>
            <select
              disabled={!documents.length || isRunning}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              value={selectedDocumentId}
            >
              {documents.length ? null : <option value="">Add a PDF first</option>}
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={summarize}
              onChange={(e) => setSummarize(e.target.checked)}
              disabled={!documents.length || isRunning}
              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Generate a comprehensive document summary
            </span>
          </label>

          <button
            className="w-full rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedDocumentId || isRunning}
            type="submit"
          >
            {isRunning ? 'Running AI...' : 'Run AI extraction'}
          </button>
        </form>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {deferredResult ? (
          <div className="space-y-4 rounded-[28px] border border-slate-200/80 dark:border-slate-700/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(247,243,237,0.9))] dark:bg-[linear-gradient(180deg,_rgba(30,41,59,0.9),_rgba(15,23,42,0.9))] transition-colors duration-300 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Classified Type
                </span>
                <p className="mt-2 text-xl font-semibold capitalize text-slate-950 dark:text-slate-50">
                  {deferredResult.document_type.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Confidence {Math.round(deferredResult.classification_confidence * 100)}%
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Extracted Fields
                </span>
                <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                  {deferredResult.fields.length}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {deferredResult.warnings.length} warnings returned by the backend
                </p>
              </div>
            </div>

            {deferredResult.summary && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  Document Summary
                </h3>
                <div className="rounded-2xl border border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/20 p-4 text-sm leading-relaxed text-slate-800 dark:text-emerald-50">
                  {deferredResult.summary.split('\n').map((paragraph, i) => (
                    <p key={i} className="mb-2 last:mb-0">
                      {highlightText(paragraph, searchQuery)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                  Key values
                </h3>
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search fields..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                  />
                </div>
              </div>
              <div className="grid gap-3 mt-3">
                {filteredFields.length ? (
                  filteredFields.map((field) => (
                    <div
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 px-4 py-3"
                      key={`${field.name}-${field.value}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {highlightText(field.name.replaceAll('_', ' '), searchQuery)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {highlightText(String(field.value), searchQuery)}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">
                          {Math.round(field.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {searchQuery ? "No matching fields found." : "The backend completed, but no key-value pairs were detected yet."}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleDownloadJson}
                className="flex-1 sm:flex-none text-center px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Download JSON
              </button>
              {deferredResult.fields.length > 0 && (
                <button
                  onClick={handleDownloadCsv}
                  className="flex-1 sm:flex-none text-center px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Download CSV
                </button>
              )}
            </div>

            <details className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-slate-100">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Raw response payload
              </summary>
              <pre className="max-h-80 overflow-auto px-4 pb-4 text-xs leading-6 text-slate-200">
                {JSON.stringify(deferredResult, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}

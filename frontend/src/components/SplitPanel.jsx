import { useEffect, useState } from 'react';
import { Scissors } from 'lucide-react';

const INITIAL_MODE = 'per-page';

export function SplitPanel({
  documents,
  pages = [],
  isBusy,
  onSplitDocument,
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [mode, setMode] = useState(INITIAL_MODE);
  const [rangeExpression, setRangeExpression] = useState('');
  const [lastDocId, setLastDocId] = useState('');

  useEffect(() => {
    if (!documents.length) {
      setSelectedDocumentId('');
      return;
    }

    const documentStillExists = documents.some(
      (document) => document.id === selectedDocumentId,
    );

    if (!documentStillExists) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedDocumentId) {
      return;
    }

    onSplitDocument({
      documentId: selectedDocumentId,
      mode,
      rangeExpression,
    });
  };

  const documentPages = pages.filter(p => p.documentId === selectedDocumentId).sort((a, b) => a.pageNumber - b.pageNumber);

  useEffect(() => {
    if (selectedDocumentId && documentPages.length > 0 && selectedDocumentId !== lastDocId) {
      setRangeExpression(`1-${documentPages.length}`);
      setLastDocId(selectedDocumentId);
    }
  }, [selectedDocumentId, documentPages.length, lastDocId]);

  const getSplitsFromRange = (rangeStr) => {
    if (!rangeStr) return [];
    const parts = rangeStr.split(';').map(p => p.trim()).filter(Boolean);
    const cuts = [];
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part.includes('-')) {
        const [, end] = part.split('-');
        if (end && !isNaN(parseInt(end, 10))) cuts.push(parseInt(end, 10));
      } else {
        if (!isNaN(parseInt(part, 10))) cuts.push(parseInt(part, 10));
      }
    }
    return cuts;
  };

  const getRangeFromSplits = (cuts) => {
    if (!documentPages.length) return '';
    if (cuts.length === 0) return `1-${documentPages.length}`;
    
    const sortedCuts = [...cuts].sort((a, b) => a - b);
    let parts = [];
    let start = 1;
    for (const cut of sortedCuts) {
      if (cut >= start && cut < documentPages.length) {
        parts.push(start === cut ? `${start}` : `${start}-${cut}`);
        start = cut + 1;
      }
    }
    parts.push(start === documentPages.length ? `${start}` : `${start}-${documentPages.length}`);
    return parts.join(';');
  };

  const activeSplits = getSplitsFromRange(rangeExpression);

  const toggleSplit = (pageNumber) => {
    const newSplits = activeSplits.includes(pageNumber) 
      ? activeSplits.filter(n => n !== pageNumber)
      : [...activeSplits, pageNumber];
    
    setRangeExpression(getRangeFromSplits(newSplits));
  };

  const isCustomExpression = rangeExpression.trim() !== '' && rangeExpression !== getRangeFromSplits(activeSplits);

  return (
    <section className="surface-card px-6 py-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="section-kicker">Split PDFs</span>
          <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            Break a loaded PDF into smaller outputs
          </h2>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            Export one PDF per page, or define explicit page groups like
            <code>1-2;3-4;5</code> to create several split files in a single ZIP.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="input-group">
            <span>Source PDF</span>
            <select
              disabled={!documents.length || isBusy}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
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

          <div className="grid gap-3">
            <button
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                mode === 'per-page'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
              onClick={() => setMode('per-page')}
              type="button"
            >
              One PDF per page
            </button>
            <button
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                mode === 'ranges'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
              onClick={() => setMode('ranges')}
              type="button"
            >
              Custom page groups
            </button>
          </div>

          {mode === 'ranges' ? (
            <div className="space-y-4">
              <label className="input-group">
                <span>Ranges</span>
                <input
                  disabled={!documents.length || isBusy}
                  onChange={(event) => setRangeExpression(event.target.value)}
                  placeholder="1-2;3-4;5"
                  type="text"
                  value={rangeExpression}
                />
              </label>

              {isCustomExpression ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Visual editor is disabled for non-sequential custom expressions.
                </div>
              ) : documentPages.length > 0 && (
                <div className="mt-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 overflow-x-auto shadow-sm">
                  <div className="flex gap-2 min-w-max pb-4 px-2 pt-2">
                    {documentPages.map((page, index) => {
                      const isLast = index === documentPages.length - 1;
                      const hasCut = activeSplits.includes(page.pageNumber);
                      
                      return (
                        <div key={page.id} className="flex items-stretch">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-28 h-36 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 transition hover:shadow-md">
                              <img 
                                src={page.thumbnailUrl} 
                                alt={`Page ${page.pageNumber}`}
                                className="w-full h-full object-contain bg-slate-50 dark:bg-slate-800 pointer-events-none"
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Page {page.pageNumber}</span>
                          </div>

                          {!isLast && (
                            <div 
                              onClick={() => toggleSplit(page.pageNumber)}
                              className="flex flex-col items-center justify-center px-4 cursor-pointer group"
                            >
                              <div className={`w-0 h-full relative transition-colors ${hasCut ? 'border-l-[3px] border-emerald-500' : 'border-l-[3px] border-dashed border-slate-200 dark:border-slate-700 group-hover:border-emerald-300'}`}>
                                {hasCut ? (
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg transform scale-110 transition-transform">
                                    <Scissors className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:border-emerald-300 group-hover:text-emerald-500 shadow-sm transition-all transform group-hover:scale-110">
                                    <Scissors className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <button
            className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedDocumentId || isBusy}
            type="submit"
          >
            {isBusy ? 'Preparing split...' : 'Split and download'}
          </button>
        </form>
      </div>
    </section>
  );
}

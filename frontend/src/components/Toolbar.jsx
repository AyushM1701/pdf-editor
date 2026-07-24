

export function Toolbar({
  documentCount,
  isBusy,
  isExporting,
  onClear,
  onExport,
  pageCount,
  compact = false,
}) {
  if (compact) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        <button
          className="rounded-full border border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 flex-1 whitespace-nowrap"
          disabled={!pageCount || isBusy || isExporting}
          onClick={onClear}
          type="button"
        >
          Clear workspace
        </button>
        <button
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500 flex-1 whitespace-nowrap"
          disabled={!pageCount || isBusy || isExporting}
          onClick={onExport}
          type="button"
        >
          {isExporting ? 'Exporting...' : 'Export edited PDF'}
        </button>
      </div>
    );
  }

  return (
    <section className="surface-card px-5 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="pill-badge">{documentCount} source files</div>
          <div className="pill-badge">{pageCount} live pages</div>
          <div className="pill-badge">Merge workspace active</div>
          <div className="pill-badge">
            {isBusy ? 'Parsing in browser' : 'Ready for local export'}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:ml-auto">
          <button
            className="rounded-full border border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!pageCount || isBusy || isExporting}
            onClick={onClear}
            type="button"
          >
            Clear workspace
          </button>
          <button
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={!pageCount || isBusy || isExporting}
            onClick={onExport}
            type="button"
          >
            {isExporting ? 'Exporting...' : 'Export edited PDF'}
          </button>
        </div>
      </div>
    </section>
  );
}

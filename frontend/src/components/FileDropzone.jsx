import { useDropzone } from 'react-dropzone';

export function FileDropzone({ compact = false, disabled = false, onFilesSelected }) {
  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    disabled,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: onFilesSelected,
  });

  return (
    <section
      {...getRootProps({
        onClick: () => {
          if (!disabled) {
            open();
          }
        },
      })}
      className={`surface-card cursor-pointer overflow-hidden transition ${
        compact ? 'px-5 py-4' : 'px-6 py-6 sm:px-8 sm:py-8'
      } ${
        isDragActive
          ? 'border-emerald-500/70 bg-emerald-100/70 shadow-[0_30px_70px_rgba(16,110,96,0.15)]'
          : 'hover:border-slate-300/80 dark:border-slate-600/80 hover:bg-white/90 dark:bg-slate-900/90'
      } ${disabled ? 'pointer-events-none opacity-70' : ''}`}
    >
      <input className="hidden" {...getInputProps()} />
      <div
        className={`grid gap-4 ${compact ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1.2fr_0.8fr]'}`}
      >
        <div className="space-y-3">
          <span className="section-kicker">
            {compact ? 'Merge more PDFs' : 'Merge PDFs locally'}
          </span>
          <div className="space-y-2">
            <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50 sm:text-3xl">
              {isDragActive
                ? 'Drop PDFs to append their pages to the live grid.'
                : compact
                  ? 'Drop more files here to merge them into the current layout.'
                  : 'Drop one or many PDFs to build the editing canvas.'}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300 sm:text-base">
              Files stay on-device for reordering, splitting, rotation, metadata
              edits, text overlays, and export. Every new PDF is merged into the
              current workspace stack automatically. The app never makes a network
              call unless the AI extraction button is clicked later.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-start lg:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            type="button"
          >
            {disabled ? 'Parsing PDFs...' : 'Browse PDFs'}
          </button>
        </div>
      </div>
    </section>
  );
}

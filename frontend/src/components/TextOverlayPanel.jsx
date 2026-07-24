import { useEffect, useState } from 'react';

const INITIAL_FORM = Object.freeze({
  text: '',
  xPercent: 12,
  yPercent: 14,
  fontSize: 16,
  color: '#0f172a',
});

export function TextOverlayPanel({
  onAddText,
  onRemoveText,
  selectedPage,
}) {
  const [formState, setFormState] = useState({ ...INITIAL_FORM });

  useEffect(() => {
    setFormState((currentState) => ({
      ...currentState,
      text: '',
    }));
  }, [selectedPage?.id]);

  const updateField = (key, value) => {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedPage || !formState.text.trim()) {
      return;
    }

    onAddText(selectedPage.id, {
      text: formState.text.trim(),
      xPercent: Number(formState.xPercent),
      yPercent: Number(formState.yPercent),
      fontSize: Number(formState.fontSize),
      color: formState.color,
    });

    setFormState((currentState) => ({
      ...currentState,
      text: '',
    }));
  };

  return (
    <section className="surface-card px-6 py-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="section-kicker">Add text to PDF</span>
          <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            Place simple text overlays on the selected page
          </h2>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            Use percentage-based placement from the page&apos;s top-left corner.
            For the most predictable results, add text before rotating a page.
          </p>
        </div>

        {selectedPage ? (
          <div className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
            Editing <strong>{selectedPage.fileName}</strong>, page{' '}
            <strong>{selectedPage.pageNumber}</strong>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
            Select a page in the grid to start placing text.
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="input-group">
            <span>Text</span>
            <textarea
              disabled={!selectedPage}
              onChange={(event) => updateField('text', event.target.value)}
              placeholder="Approved for release"
              rows={3}
              value={formState.text}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-group">
              <span>Horizontal %</span>
              <input
                disabled={!selectedPage}
                max="100"
                min="0"
                onChange={(event) => updateField('xPercent', event.target.value)}
                step="1"
                type="number"
                value={formState.xPercent}
              />
            </label>

            <label className="input-group">
              <span>Vertical %</span>
              <input
                disabled={!selectedPage}
                max="100"
                min="0"
                onChange={(event) => updateField('yPercent', event.target.value)}
                step="1"
                type="number"
                value={formState.yPercent}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="input-group">
              <span>Font size</span>
              <input
                disabled={!selectedPage}
                max="72"
                min="8"
                onChange={(event) => updateField('fontSize', event.target.value)}
                step="1"
                type="number"
                value={formState.fontSize}
              />
            </label>

            <label className="input-group">
              <span>Color</span>
              <input
                className="h-[58px] min-w-[88px] cursor-pointer p-2"
                disabled={!selectedPage}
                onChange={(event) => updateField('color', event.target.value)}
                type="color"
                value={formState.color}
              />
            </label>
          </div>

          <button
            className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedPage || !formState.text.trim()}
            type="submit"
          >
            Add text to selected page
          </button>
        </form>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current overlays
          </h3>
          {selectedPage?.annotations?.length ? (
            <div className="grid gap-3">
              {selectedPage.annotations.map((annotation) => (
                <div
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-4 py-3"
                  key={annotation.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {annotation.text}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        X {annotation.xPercent}% - Y {annotation.yPercent}% - {annotation.fontSize}px
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                      onClick={() => onRemoveText(selectedPage.id, annotation.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
              No overlay text has been added to this page yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

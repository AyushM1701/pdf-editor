export function MetadataEditor({ metadata, onMetadataChange }) {
  return (
    <section className="surface-card px-6 py-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="section-kicker">Metadata editor</span>
          <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            Control export properties
          </h2>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            The values below are written into the exported PDF without touching the
            original source files.
          </p>
        </div>

        <div className="space-y-4">
          <label className="input-group">
            <span>Title</span>
            <input
              onChange={(event) => onMetadataChange('title', event.target.value)}
              placeholder="Quarterly invoice packet"
              type="text"
              value={metadata.title}
            />
          </label>

          <label className="input-group">
            <span>Author</span>
            <input
              onChange={(event) => onMetadataChange('author', event.target.value)}
              placeholder="Finance Operations"
              type="text"
              value={metadata.author}
            />
          </label>

          <label className="input-group">
            <span>Subject</span>
            <textarea
              onChange={(event) => onMetadataChange('subject', event.target.value)}
              placeholder="Merged and reordered invoice bundle"
              rows={4}
              value={metadata.subject}
            />
          </label>
        </div>
      </div>
    </section>
  );
}

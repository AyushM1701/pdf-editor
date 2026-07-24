import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ThumbnailCanvas } from './ThumbnailCanvas';

function AnnotationPreview({ annotation }) {
  return (
    <div
      className="absolute max-w-[72%] truncate rounded-md bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
      style={{
        left: `${annotation.xPercent}%`,
        top: `${annotation.yPercent}%`,
        color: annotation.color,
      }}
      title={annotation.text}
    >
      {annotation.text}
    </div>
  );
}

export function PageCard({
  isSelected,
  onDelete,
  onRotate,
  onSelect,
  page,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const cardTransform = CSS.Transform.toString(transform);

  return (
    <article
      className={`relative rounded-[28px] border transition ${
        isSelected
          ? 'border-emerald-600/70 bg-white dark:bg-slate-900 shadow-[0_25px_55px_rgba(18,99,90,0.14)]'
          : 'border-white/80 bg-white/75 dark:bg-slate-900/75 shadow-[0_18px_44px_rgba(61,45,22,0.08)]'
      } ${isDragging ? 'z-20 scale-[1.02] shadow-[0_35px_80px_rgba(18,99,90,0.22)]' : ''}`}
      ref={setNodeRef}
      style={{
        transform: cardTransform,
        transition,
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {page.fileName}
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Page {page.pageNumber}</p>
        </div>

        <button
          className="inline-flex items-center justify-center rounded-full border border-slate-300/80 dark:border-slate-600/80 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300 transition hover:border-slate-400 hover:bg-white dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
          type="button"
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
      </div>

      <button
        className="block w-full px-4 pb-4 pt-3 text-left"
        onClick={() => onSelect(page.id)}
        type="button"
      >
        <div className="relative rounded-[24px] bg-[linear-gradient(180deg,_#fbf7f1_0%,_#f0e7da_100%)] p-3">
          <ThumbnailCanvas
            documentId={page.documentId}
            sourcePageIndex={page.sourcePageIndex}
            height={page.thumbnailHeight}
            rotation={page.rotation}
            src={page.thumbnailUrl}
            width={page.thumbnailWidth}
          />
          {page.annotations?.length
            ? page.annotations.map((annotation) => (
                <AnnotationPreview annotation={annotation} key={annotation.id} />
              ))
            : null}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
          <span>Rotation {page.rotation} deg</span>
          <span>
            {page.width} x {page.height}
          </span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        <button
          className="rounded-full border border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-emerald-500/70 hover:text-emerald-700"
          onClick={() => onRotate(page.id)}
          type="button"
        >
          Rotate 90 deg
        </button>
        <button
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          onClick={() => onDelete(page.id)}
          type="button"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

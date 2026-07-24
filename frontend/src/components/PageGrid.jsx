import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { PageCard } from './PageCard';

export function PageGrid({
  onDeletePage,
  onReorderPages,
  onRotatePage,
  onSelectPage,
  pages,
  selectedPageId,
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      onReorderPages(String(active.id), String(over.id));
    }
  };

  return (
    <section className="surface-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="section-kicker">Page workspace</span>
            <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
              Drag, split, reorder, rotate, and delete page tiles
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              The export worker replays this grid state onto the original binary
              sources, so all edits stay local until the final download.
            </p>
          </div>
        </div>

        {pages.length ? (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={pages.map((page) => page.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pages.map((page) => (
                  <PageCard
                    isSelected={page.id === selectedPageId}
                    key={page.id}
                    onDelete={onDeletePage}
                    onRotate={onRotatePage}
                    onSelect={onSelectPage}
                    page={page}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 dark:border-slate-600 bg-[linear-gradient(180deg,_rgba(255,255,255,0.6),_rgba(255,255,255,0.35))] px-6 py-14 text-center">
            <h3 className="font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
              No pages in the workspace yet
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Import one or more PDFs above to start generating thumbnails and
              building a local edit queue.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

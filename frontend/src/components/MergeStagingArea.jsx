import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, FileText, Lock } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

function StagingItem({ item, onUpdateRange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl ${
        isDragging ? 'shadow-xl z-10 ring-2 ring-slate-400 scale-[1.02]' : 'shadow-sm'
      }`}
    >
      <button
        type="button"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing p-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-slate-500" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {item.fileName}
        </h4>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
          {item.isLoading ? (
            <span className="animate-pulse">Loading info...</span>
          ) : item.isEncrypted ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <Lock className="w-3 h-3" /> Encrypted (Will prompt on merge)
            </span>
          ) : (
            <span>{item.pageCount} pages</span>
          )}
        </div>
      </div>

      <div className="w-48 shrink-0 flex flex-col">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Pages to Extract
        </label>
        <input
          type="text"
          value={item.pageRange}
          onChange={(e) => onUpdateRange(item.id, e.target.value)}
          placeholder="e.g. 1-5, 8"
          disabled={item.isLoading || item.isEncrypted}
          className="w-full text-sm px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 transition disabled:opacity-50"
        />
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0 ml-2"
        title="Remove file"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function MergeStagingArea({ files, onConfirm, onCancel }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    const processFiles = async () => {
      const initialItems = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        pageCount: 0,
        pageRange: '',
        isLoading: true,
        isEncrypted: false,
      }));
      
      setItems(initialItems);

      for (const item of initialItems) {
        if (!mounted) break;
        try {
          const buffer = await item.file.arrayBuffer();
          const doc = await PDFDocument.load(buffer, { updateMetadata: false });
          const count = doc.getPageCount();
          
          setItems((current) =>
            current.map((i) =>
              i.id === item.id ? { ...i, pageCount: count, isLoading: false, isEncrypted: doc.isEncrypted } : i
            )
          );
        } catch (error) {
          // pdf-lib throws if encrypted
          setItems((current) =>
            current.map((i) =>
              i.id === item.id
                ? { ...i, isLoading: false, isEncrypted: error.message.includes('encrypted') || true }
                : i
            )
          );
        }
      }
    };

    processFiles();

    return () => {
      mounted = false;
    };
  }, [files]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const updateRange = (id, newRange) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, pageRange: newRange } : item))
    );
  };

  const removeItem = (id) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      if (next.length === 0) {
        onCancel(); // If all removed, cancel out
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const configuredFiles = items.map((item) => ({
      file: item.file,
      pageRange: item.pageRange,
    }));
    onConfirm(configuredFiles);
  };

  const isAnyLoading = items.some((i) => i.isLoading);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 w-full max-w-3xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Merge Order & Pages
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Drag to reorder files. Leave the page range blank to import all pages.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isAnyLoading || items.length === 0}
            className="px-6 py-2 font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl shadow-sm disabled:opacity-50 transition"
          >
            Confirm & Merge
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <StagingItem
                  key={item.id}
                  item={item}
                  onUpdateRange={updateRange}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

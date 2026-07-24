import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useMemo } from 'react';
import { usePdf } from '../hooks/usePdf';
import { ThumbnailCanvas } from './ThumbnailCanvas';
import { Search } from 'lucide-react';

function SidebarPageItem({ page, isSelected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(page.id)}
      className={`w-full flex items-center gap-3 p-3 text-left transition border-b border-slate-100 dark:border-slate-800/50 ${
        isSelected ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      } ${isDragging ? 'z-10 shadow-lg scale-[1.02] bg-white dark:bg-slate-900' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="font-semibold text-slate-400 text-xs w-4 shrink-0 text-right">
        {page.pageNumber}
      </div>
      <div className="w-16 h-20 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded overflow-hidden flex items-center justify-center pointer-events-none">
        <ThumbnailCanvas
          documentId={page.documentId}
          sourcePageIndex={page.sourcePageIndex}
          height={page.thumbnailHeight}
          rotation={page.rotation}
          src={page.thumbnailUrl}
          width={page.thumbnailWidth}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{page.fileName}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{page.annotations?.length || 0} Annotations</p>
      </div>
    </button>
  );
}

export function EditorSidebar({ onClose }) {
  const { pages, selectedPageId, selectPage, reorderPages, setActiveSearchHighlight } = usePdf();
  const [activeTab, setActiveTab] = useState('pages'); // 'pages' or 'search'
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      reorderPages(String(active.id), String(over.id));
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results = [];
    
    for (const page of pages) {
      if (!page.textItems) continue;
      
      const pageResults = [];
      for (const item of page.textItems) {
        if (item.str.toLowerCase().includes(query)) {
          pageResults.push(item);
        }
      }
      
      if (pageResults.length > 0) {
        results.push({
          pageId: page.id,
          pageNumber: page.pageNumber,
          matches: pageResults
        });
      }
    }
    
    return results;
  }, [pages, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white/80 dark:bg-slate-900/80">
      <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Menu</span>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <button 
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'pages' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => {
            setActiveTab('pages');
            setActiveSearchHighlight(null);
          }}
        >
          Pages
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'search' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {activeTab === 'pages' ? (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {pages.map((page) => (
                <SidebarPageItem
                  key={page.id}
                  page={page}
                  isSelected={page.id === selectedPageId}
                  onSelect={(id) => {
                    selectPage(id);
                    setActiveSearchHighlight(null);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="p-4 flex flex-col h-full">
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {searchResults.length === 0 && searchQuery.trim() && (
                <div className="text-center text-sm text-slate-500 mt-8">
                  No matches found.
                </div>
              )}
              
              {searchResults.map(result => (
                <div key={result.pageId} className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Page {result.pageNumber}</h4>
                  <div className="space-y-1">
                    {result.matches.map((match, i) => (
                      <button
                        key={i}
                        className="w-full text-left p-2 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm border border-transparent hover:border-emerald-200 transition-colors"
                        onClick={() => {
                          selectPage(result.pageId);
                          setActiveSearchHighlight(match);
                        }}
                      >
                        <div className="truncate text-slate-700 dark:text-slate-300">
                          {match.str}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

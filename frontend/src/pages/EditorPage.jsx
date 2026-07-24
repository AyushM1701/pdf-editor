import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { EditorSidebar } from '../components/EditorSidebar';
import { EditorRibbon } from '../components/EditorRibbon';
import { EditorCanvas } from '../components/EditorCanvas';
import { EditorPropertiesPanel } from '../components/EditorPropertiesPanel';

export function EditorPage() {
  const { 
    documents, 
    undo, 
    redo, 
    removePage, 
    rotatePage, 
    selectedPageId, 
    exportDocument 
  } = usePdf();
  
  useKeyboardShortcuts({
    undo,
    redo,
    removePage,
    rotatePage,
    selectedPageId,
    exportDocument,
  });

  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'text', 'crop'
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100% size of PDF points
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  if (documents.length === 0) return null;

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Thumbnails */}
      <div className={`
        ${isSidebarOpen ? 'flex absolute inset-y-0 left-0 z-50 shadow-2xl h-full' : 'hidden'} 
        md:flex md:relative md:z-auto md:shadow-sm md:h-auto
        w-72 md:w-64 flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-r-2xl md:rounded-2xl overflow-hidden flex-col transition-all duration-300
      `}>
        <EditorSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm relative">
        <EditorRibbon 
          activeTool={activeTool} 
          setActiveTool={setActiveTool} 
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        
        <div className="flex-1 overflow-hidden flex relative">
           <EditorCanvas 
             activeTool={activeTool}
             setActiveTool={setActiveTool}
             selectedAnnotationId={selectedAnnotationId}
             setSelectedAnnotationId={setSelectedAnnotationId}
             zoomLevel={zoomLevel}
             setZoomLevel={setZoomLevel}
           />
           
           {selectedAnnotationId && activeTool === 'select' && (
             <EditorPropertiesPanel 
               selectedAnnotationId={selectedAnnotationId} 
             />
           )}
        </div>
      </div>
    </div>
  );
}

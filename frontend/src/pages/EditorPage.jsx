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

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  if (documents.length === 0) return null;

  return (
    <div className="flex h-[calc(100vh-130px)] gap-4 mt-2">
      {/* Left Sidebar - Thumbnails */}
      <div className="w-64 flex-shrink-0 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <EditorSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm relative">
        <EditorRibbon 
          activeTool={activeTool} 
          setActiveTool={setActiveTool} 
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
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

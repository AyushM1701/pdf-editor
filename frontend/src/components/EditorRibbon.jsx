import { useState } from 'react';
import { MousePointer2, Type, Crop, RotateCw, Trash2, ZoomIn, ZoomOut, Undo2, Redo2, Download, Pen, Highlighter, Square, Circle, PenLine, ShieldAlert, Copy } from 'lucide-react';
import { usePdf } from '../hooks/usePdf';
import { ExportDialog } from './ExportDialog';
import { SignatureModal } from './SignatureModal';

function ToolButton({ icon: Icon, label, isActive, onClick, isDanger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-10 h-10 rounded-xl transition ${
        isActive
          ? 'bg-slate-900 text-white shadow-md'
          : isDanger
          ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-100'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export function EditorRibbon({ activeTool, setActiveTool, zoomLevel, setZoomLevel }) {
  const { selectedPage, rotatePage, duplicatePage, removePage, undo, redo, canUndo, canRedo, exportDocument, signatureDataUrl, setSignatureDataUrl } = usePdf();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.2, 5));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.2, 0.2));

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm z-10 relative">
      <div className="flex items-center gap-2">
        <ToolButton
          icon={MousePointer2}
          label="Select (V)"
          isActive={activeTool === 'select'}
          onClick={() => setActiveTool('select')}
        />
        <ToolButton
          icon={Type}
          label="Add Text (T)"
          isActive={activeTool === 'text'}
          onClick={() => setActiveTool('text')}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <ToolButton
          icon={Pen}
          label="Draw"
          isActive={activeTool === 'draw'}
          onClick={() => setActiveTool('draw')}
        />
        <ToolButton
          icon={Highlighter}
          label="Highlight"
          isActive={activeTool === 'highlight'}
          onClick={() => setActiveTool('highlight')}
        />
        <ToolButton
          icon={Square}
          label="Rectangle"
          isActive={activeTool === 'shape-rect'}
          onClick={() => setActiveTool('shape-rect')}
        />
        <ToolButton
          icon={Circle}
          label="Circle"
          isActive={activeTool === 'shape-circle'}
          onClick={() => setActiveTool('shape-circle')}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <ToolButton
          icon={PenLine}
          label="Signature"
          isActive={activeTool === 'signature'}
          onClick={() => {
            if (signatureDataUrl) {
              setActiveTool('signature');
            } else {
              setShowSignatureModal(true);
            }
          }}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <ToolButton
          icon={ShieldAlert}
          label="Redact Content"
          isActive={activeTool === 'redaction'}
          onClick={() => setActiveTool('redaction')}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <ToolButton
          icon={Crop}
          label="Crop Page (C)"
          isActive={activeTool === 'crop'}
          onClick={() => setActiveTool('crop')}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition ${
            canUndo ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition ${
            canRedo ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-100 rounded-xl px-1 mr-2">
          <ToolButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <ToolButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} />
        </div>
        
        {selectedPage && (
          <div className="text-xs font-medium text-slate-500 mr-2 bg-slate-100 px-3 py-1.5 rounded-lg">
            {selectedPage.width} x {selectedPage.height} • {selectedPage.rotation}°
          </div>
        )}
        <ToolButton
          icon={RotateCw}
          label="Rotate 90°"
          isActive={false}
          onClick={() => selectedPage && rotatePage(selectedPage.id)}
        />
        <ToolButton
          icon={Copy}
          label="Duplicate Page"
          isActive={false}
          onClick={() => selectedPage && duplicatePage(selectedPage.id)}
        />
        <ToolButton
          icon={Trash2}
          label="Delete Page"
          isActive={false}
          isDanger={true}
          onClick={() => {
            if (selectedPage && window.confirm('Are you sure you want to delete this page?')) {
              removePage(selectedPage.id);
            }
          }}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <div className="flex rounded-xl shadow-sm ml-1">
          <button
            onClick={() => exportDocument()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-l-xl transition border-r border-slate-700"
          >
            <Download className="w-4 h-4" />
            Quick Export
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-r-xl transition"
            title="Export Options"
          >
            <span className="text-xs font-bold leading-none tracking-widest mt-[-2px]">...</span>
          </button>
        </div>
      </div>

      {showExportDialog && (
        <ExportDialog 
          onClose={() => setShowExportDialog(false)}
          onExport={(options) => {
            setShowExportDialog(false);
            exportDocument(options);
          }}
        />
      )}
      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={(dataUrl, aspectRatio) => {
            setSignatureDataUrl({ dataUrl, aspectRatio });
            setActiveTool('signature');
          }}
        />
      )}
    </div>
  );
}

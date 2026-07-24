import { useState, useRef, useEffect } from 'react';
import { X, Upload, Pencil, Trash2 } from 'lucide-react';

export function SignatureModal({ isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' or 'upload'
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
    setUploadedImage(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setUploadedImage(dataUrl);
        const img = new Image();
        img.onload = () => {
          setAspectRatio(img.height / img.width);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (activeTab === 'draw' && hasDrawn) {
      const canvas = canvasRef.current;
      
      // The canvas is 500x200, so aspect ratio is 200/500 = 0.4
      onSave(canvas.toDataURL('image/png'), 0.4);
      onClose();
    } else if (activeTab === 'upload' && uploadedImage) {
      onSave(uploadedImage, aspectRatio);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Create Signature</h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex p-2 gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={() => setActiveTab('draw')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition ${activeTab === 'draw' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
          >
            <Pencil className="w-4 h-4" /> Draw
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition ${activeTab === 'upload' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
          >
            <Upload className="w-4 h-4" /> Upload Image
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'draw' ? (
            <div className="flex flex-col items-center">
              <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden relative" style={{ height: '200px' }}>
                <canvas
                  ref={canvasRef}
                  width={450}
                  height={200}
                  className="w-full h-full cursor-crosshair touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-slate-400 font-medium select-none">Draw your signature here</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end w-full mt-3">
                <button
                  onClick={handleClear}
                  className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Canvas
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
              {uploadedImage ? (
                <div className="flex flex-col items-center w-full">
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 w-full flex items-center justify-center min-h-[150px]">
                    <img src={uploadedImage} alt="Uploaded signature" className="max-h-32 object-contain" />
                  </div>
                  <div className="flex justify-end w-full mt-3">
                    <button
                      onClick={handleClear}
                      className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Image
                    </button>
                  </div>
                </div>
              ) : (
                <label className="w-full flex flex-col items-center justify-center h-48 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="mb-2 text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-500">PNG, JPG or SVG (Transparent recommended)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={(activeTab === 'draw' && !hasDrawn) || (activeTab === 'upload' && !uploadedImage)}
            className="px-6 py-2 font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}

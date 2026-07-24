import { useState, useEffect } from 'react';
import { X, FileText, Type } from 'lucide-react';

export function ExportDialog({ onClose, onExport }) {
  const [pageNumbering, setPageNumbering] = useState(false);
  const [compress, setCompress] = useState(false);
  const [watermark, setWatermark] = useState({ text: '', opacity: 0.3, rotation: 45 });
  const [encrypt, setEncrypt] = useState(false);
  const [encryptionSettings, setEncryptionSettings] = useState({
    userPassword: '',
    ownerPassword: '',
    canPrint: true,
    canCopy: true,
    canModify: true
  });

  const handleExport = () => {
    onExport({
      pageNumbering,
      compress,
      watermark: watermark.text ? watermark : null,
      encryption: encrypt ? encryptionSettings : null,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-slate-100">Export Options</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded accent-slate-900 dark:accent-slate-100 cursor-pointer"
              checked={pageNumbering}
              onChange={(e) => setPageNumbering(e.target.checked)}
            />
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <FileText className="w-4 h-4" />
              Add page numbers
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded accent-slate-900 dark:accent-slate-100 cursor-pointer"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
            />
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Optimize & Compress PDF
            </span>
          </label>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Type className="w-4 h-4" />
              Watermark Text
            </label>
            <input
              type="text"
              placeholder="e.g. CONFIDENTIAL"
              value={watermark.text}
              onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 transition"
            />
            {watermark.text && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Opacity: {watermark.opacity}</label>
                  <input 
                    type="range" min="0.1" max="1" step="0.1"
                    value={watermark.opacity}
                    onChange={(e) => setWatermark({...watermark, opacity: parseFloat(e.target.value)})}
                    className="w-full accent-slate-900 dark:accent-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Rotation: {watermark.rotation}°</label>
                  <input 
                    type="range" min="0" max="360" step="15"
                    value={watermark.rotation}
                    onChange={(e) => setWatermark({...watermark, rotation: parseInt(e.target.value, 10)})}
                    className="w-full accent-slate-900 dark:accent-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded accent-slate-900 dark:accent-slate-100 cursor-pointer"
                checked={encrypt}
                onChange={(e) => setEncrypt(e.target.checked)}
              />
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Encrypt with Password
              </span>
            </label>

            {encrypt && (
              <div className="space-y-4 pl-8 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Document Password (User)</label>
                    <input
                      type="password"
                      placeholder="Required to open"
                      value={encryptionSettings.userPassword}
                      onChange={(e) => setEncryptionSettings({ ...encryptionSettings, userPassword: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-400 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Permissions Password (Owner)</label>
                    <input
                      type="password"
                      placeholder="Required to edit settings"
                      value={encryptionSettings.ownerPassword}
                      onChange={(e) => setEncryptionSettings({ ...encryptionSettings, ownerPassword: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-slate-400 transition"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Permissions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input 
                        type="checkbox" 
                        checked={encryptionSettings.canPrint}
                        onChange={(e) => setEncryptionSettings({...encryptionSettings, canPrint: e.target.checked})}
                      />
                      Allow Printing
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input 
                        type="checkbox" 
                        checked={encryptionSettings.canCopy}
                        onChange={(e) => setEncryptionSettings({...encryptionSettings, canCopy: e.target.checked})}
                      />
                      Allow Copying
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input 
                        type="checkbox" 
                        checked={encryptionSettings.canModify}
                        onChange={(e) => setEncryptionSettings({...encryptionSettings, canModify: e.target.checked})}
                      />
                      Allow Modifying
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            <label className="flex items-center gap-3 cursor-pointer mt-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded accent-emerald-500 dark:accent-emerald-400 cursor-pointer"
                checked={encryptionSettings.signDocument}
                onChange={(e) => setEncryptionSettings({...encryptionSettings, signDocument: e.target.checked})}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Apply Cryptographic Digital Signature
                </span>
                <span className="text-xs text-slate-500">
                  Seals the document against tampering with a self-signed certificate.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            className="px-5 py-2.5 text-sm font-medium text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-xl shadow-sm transition"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

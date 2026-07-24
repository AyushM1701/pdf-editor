import { usePdf } from '../hooks/usePdf';

export function EditorPropertiesPanel({ selectedAnnotationId }) {
  const { selectedPage, updateAnnotation, removeAnnotation } = usePdf();
  
  if (!selectedPage || !selectedAnnotationId) {
    return null;
  }
  
  const annotation = selectedPage.annotations?.find(a => a.id === selectedAnnotationId);
  
  if (!annotation) {
    return null;
  }

  const handleChange = (key, value) => {
    updateAnnotation(selectedPage.id, selectedAnnotationId, { [key]: value });
  };

  const handleSizeChange = (scale) => {
    // Assuming base width is 20, we scale it
    const baseWidth = 20;
    const newWidth = baseWidth * scale;
    const newHeight = newWidth * (annotation.heightPercent / annotation.widthPercent);
    updateAnnotation(selectedPage.id, selectedAnnotationId, { widthPercent: newWidth, heightPercent: newHeight });
  };

  const currentScale = annotation.type === 'image' ? (annotation.widthPercent / 20) : 1;

  const isText = annotation.type === 'text' || !annotation.type;
  const isImage = annotation.type === 'image';
  const isRedaction = annotation.type === 'redaction';
  const hasColor = !isImage;
  const hasStroke = ['draw', 'shape-rect', 'shape-circle'].includes(annotation.type);

  return (
    <div className="w-72 bg-white/70 dark:bg-slate-900/70 border-l border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-5 overflow-y-auto">
      <div>
        <h3 className="font-semibold text-sm text-slate-800 mb-1">Annotation Properties</h3>
        <p className="text-xs text-slate-500">Edit the selected {annotation.type || 'text'}.</p>
      </div>
      
      {isText && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Text Content</span>
          <textarea
            value={annotation.text}
            onChange={(e) => handleChange('text', e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white dark:bg-slate-900"
            rows={3}
          />
        </label>
      )}

      {isImage && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Scale</span>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={currentScale}
            onChange={(e) => handleSizeChange(Number(e.target.value))}
            className="w-full"
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        {isText && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Font Size (px)</span>
            <input
              type="number"
              min="8"
              max="144"
              value={annotation.fontSize}
              onChange={(e) => handleChange('fontSize', Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white dark:bg-slate-900"
            />
          </label>
        )}

        {hasStroke && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Stroke Width</span>
            <input
              type="number"
              min="1"
              max="20"
              value={annotation.strokeWidth || 4}
              onChange={(e) => handleChange('strokeWidth', Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white dark:bg-slate-900"
            />
          </label>
        )}
        
        {hasColor && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Color</span>
            <input
              type="color"
              value={annotation.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-full h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-1 bg-white dark:bg-slate-900"
            />
          </label>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <button
          onClick={() => removeAnnotation(selectedPage.id, selectedAnnotationId)}
          className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        >
          Delete Annotation
        </button>
      </div>
    </div>
  );
}

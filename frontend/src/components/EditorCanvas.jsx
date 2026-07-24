import { useEffect, useRef, useState } from "react";
import { usePdf } from "../hooks/usePdf";

export function EditorCanvas({
  activeTool,
  setActiveTool,
  selectedAnnotationId,
  setSelectedAnnotationId,
  zoomLevel,
  setZoomLevel,
}) {
  const {
    selectedPage,
    addPageAnnotation,
    updateAnnotation,
    updatePageCropBox,
    updateFormField,
    signatureDataUrl,
    activeSearchHighlight,
  } = usePdf();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawingCrop, setIsDrawingCrop] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropCurrent, setCropCurrent] = useState({ x: 0, y: 0 });
  const [draggedAnnotation, setDraggedAnnotation] = useState(null);
  
  // Track active drawing/shape action
  const [currentDrawing, setCurrentDrawing] = useState(null);

  useEffect(() => {
    if (activeTool !== "select") {
      setSelectedAnnotationId(null);
    }
  }, [activeTool, setSelectedAnnotationId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoomLevel((prev) => {
          const step = e.deltaY > 0 ? -0.1 : 0.1;
          return Math.max(0.2, Math.min(prev + step, 5));
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [setZoomLevel]);

  if (!selectedPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Select a page from the sidebar to begin editing.
      </div>
    );
  }

  const getPointerPercents = (e) => {
    if (!canvasRef.current) return { xPercent: 0, yPercent: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    
    // Rotate backwards to map to unrotated space
    const rad = (-selectedPage.rotation * Math.PI) / 180;
    const newDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const newDy = dx * Math.sin(rad) + dy * Math.cos(rad);
    
    const unrotatedWidth = selectedPage.width * zoomLevel;
    const unrotatedHeight = selectedPage.height * zoomLevel;
    
    const unrotatedX = newDx + unrotatedWidth / 2;
    const unrotatedY = newDy + unrotatedHeight / 2;
    
    return {
      xPercent: (unrotatedX / unrotatedWidth) * 100,
      yPercent: (unrotatedY / unrotatedHeight) * 100,
    };
  };

  const handlePointerDown = (e) => {
    const { xPercent, yPercent } = getPointerPercents(e);

    if (activeTool === "text") {
      const newId = crypto.randomUUID();
      addPageAnnotation(selectedPage.id, {
        type: 'text',
        id: newId,
        text: "New Text",
        xPercent,
        yPercent,
        fontSize: 16,
        color: "#0f172a",
      });
      setSelectedAnnotationId(newId);
      setActiveTool("select");
    } else if (activeTool === "crop") {
      setIsDrawingCrop(true);
      setCropStart({ x: xPercent, y: yPercent });
      setCropCurrent({ x: xPercent, y: yPercent });
      updatePageCropBox(selectedPage.id, null);
    } else if (activeTool === "signature" && signatureDataUrl) {
      const newId = crypto.randomUUID();
      const widthPercent = 20;
      const heightPercent = widthPercent * signatureDataUrl.aspectRatio;
      
      addPageAnnotation(selectedPage.id, {
        type: 'image',
        id: newId,
        dataUrl: signatureDataUrl.dataUrl,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
      });
      setSelectedAnnotationId(newId);
      setActiveTool("select");
    } else if (['draw', 'shape-rect', 'shape-circle', 'highlight', 'redaction'].includes(activeTool)) {
      setCurrentDrawing({
        type: activeTool,
        id: crypto.randomUUID(),
        start: { xPercent, yPercent },
        current: { xPercent, yPercent },
        points: [{ xPercent, yPercent }],
        color: activeTool === 'highlight' ? '#fbbf24' : (activeTool === 'redaction' ? '#000000' : '#0f172a'),
        strokeWidth: 4,
      });
    } else if (activeTool === "select" && !draggedAnnotation) {
      setSelectedAnnotationId(null);
    }
  };

  const handlePointerMove = (e) => {
    const { xPercent: rawX, yPercent: rawY } = getPointerPercents(e);
    const xPercent = Math.max(0, Math.min(100, rawX));
    const yPercent = Math.max(0, Math.min(100, rawY));

    if (isDrawingCrop && activeTool === "crop") {
      setCropCurrent({ x: xPercent, y: yPercent });
    } else if (currentDrawing) {
      setCurrentDrawing(prev => {
        if (!prev) return prev;
        if (prev.type === 'draw') {
          return { ...prev, points: [...prev.points, { xPercent, yPercent }] };
        } else {
          return { ...prev, current: { xPercent, yPercent } };
        }
      });
    } else if (draggedAnnotation && activeTool === "select") {
      // Need pointer percent diff in unrotated space
      const startPercents = getPointerPercents({ clientX: draggedAnnotation.pointerX, clientY: draggedAnnotation.pointerY });
      const currentPercents = getPointerPercents(e);
      const dxPercent = currentPercents.xPercent - startPercents.xPercent;
      const dyPercent = currentPercents.yPercent - startPercents.yPercent;

      updateAnnotation(selectedPage.id, draggedAnnotation.id, {
        xPercent: Math.max(
          0,
          Math.min(100, draggedAnnotation.startX + dxPercent),
        ),
        yPercent: Math.max(
          0,
          Math.min(100, draggedAnnotation.startY + dyPercent),
        ),
      });
    }
  };

  const handlePointerUp = () => {
    if (draggedAnnotation) {
      setDraggedAnnotation(null);
    }

    if (currentDrawing) {
      if (currentDrawing.type === 'draw' && currentDrawing.points.length > 1) {
        addPageAnnotation(selectedPage.id, {
          type: currentDrawing.type,
          id: currentDrawing.id,
          points: currentDrawing.points,
          color: currentDrawing.color,
          strokeWidth: currentDrawing.strokeWidth,
        });
      } else if (['shape-rect', 'shape-circle', 'highlight', 'redaction'].includes(currentDrawing.type)) {
        const xPercent = Math.min(currentDrawing.start.xPercent, currentDrawing.current.xPercent);
        const yPercent = Math.min(currentDrawing.start.yPercent, currentDrawing.current.yPercent);
        const widthPercent = Math.abs(currentDrawing.current.xPercent - currentDrawing.start.xPercent);
        const heightPercent = Math.abs(currentDrawing.current.yPercent - currentDrawing.start.yPercent);
        
        if (widthPercent > 0.5 && heightPercent > 0.5) {
          addPageAnnotation(selectedPage.id, {
            type: currentDrawing.type,
            id: currentDrawing.id,
            xPercent,
            yPercent,
            widthPercent,
            heightPercent,
            color: currentDrawing.color,
            strokeWidth: currentDrawing.strokeWidth,
          });
        }
      }
      setCurrentDrawing(null);
    }

    if (isDrawingCrop && activeTool === "crop") {
      setIsDrawingCrop(false);

      const xPercent = Math.min(cropStart.x, cropCurrent.x);
      const yPercent = Math.min(cropStart.y, cropCurrent.y);
      const widthPercent = Math.abs(cropCurrent.x - cropStart.x);
      const heightPercent = Math.abs(cropCurrent.y - cropStart.y);

      if (widthPercent > 2 && heightPercent > 2) {
        updatePageCropBox(selectedPage.id, {
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
        });
      }
    }
  };

  const renderCropBox = () => {
    if (isDrawingCrop) {
      const left = Math.min(cropStart.x, cropCurrent.x);
      const top = Math.min(cropStart.y, cropCurrent.y);
      const width = Math.abs(cropCurrent.x - cropStart.x);
      const height = Math.abs(cropCurrent.y - cropStart.y);

      return (
        <div
          className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
          }}
        />
      );
    }

    if (selectedPage.cropBox) {
      return (
        <div
          className="absolute border-2 border-slate-800 border-dashed bg-slate-900/5 pointer-events-none"
          style={{
            left: `${selectedPage.cropBox.xPercent}%`,
            top: `${selectedPage.cropBox.yPercent}%`,
            width: `${selectedPage.cropBox.widthPercent}%`,
            height: `${selectedPage.cropBox.heightPercent}%`,
          }}
        >
          <div className="absolute top-0 right-0 bg-slate-800 text-white text-[10px] px-1 translate-y-[-100%] rounded-t-sm">
            Crop Area
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full p-8 overflow-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
    >
      <div className="min-h-full min-w-full flex items-center justify-center">
        <div
          className="relative bg-white dark:bg-slate-900 shadow-2xl shrink-0"
          style={{
            width: `${selectedPage.width * zoomLevel}px`,
            height: `${selectedPage.height * zoomLevel}px`,
            cursor:
              activeTool === "text"
                ? "text"
                : ["crop", "shape-rect", "shape-circle", "highlight", "draw", "redaction"].includes(activeTool)
                  ? "crosshair"
                  : "default",
            transform: `rotate(${selectedPage.rotation}deg)`,
            transition: "transform 0.3s ease, width 0.1s, height 0.1s",
          }}
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            src={selectedPage.thumbnailUrl}
            alt={`Page ${selectedPage.pageNumber}`}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Render Text Annotations */}
          {selectedPage.annotations?.filter(a => a.type === 'text' || !a.type).map((annotation) => {
            const isSelected = annotation.id === selectedAnnotationId;

            return (
              <div
                key={annotation.id}
                onPointerDown={(e) => {
                  if (activeTool === "select") {
                    e.stopPropagation();
                    setSelectedAnnotationId(annotation.id);
                    setDraggedAnnotation({
                      id: annotation.id,
                      startX: annotation.xPercent,
                      startY: annotation.yPercent,
                      pointerX: e.clientX,
                      pointerY: e.clientY,
                    });
                  }
                }}
                className={`absolute truncate px-1.5 py-0.5 transform -translate-y-full select-none ${
                  isSelected
                    ? "ring-2 ring-emerald-500 bg-emerald-50/80 z-10"
                    : "hover:ring-1 hover:ring-slate-300"
                } ${activeTool === "select" ? "cursor-pointer" : "pointer-events-none"}`}
                style={{
                  left: `${annotation.xPercent}%`,
                  top: `${annotation.yPercent}%`,
                  color: annotation.color,
                  // Scale font size based on zoom level to match PDF points visually
                  fontSize: `${annotation.fontSize * zoomLevel}px`,
                  fontWeight: 600,
                }}
              >
                {annotation.text}
              </div>
            );
          })}

          {/* Render Shapes & Drawings via SVG Layer */}
          <svg
            viewBox={`0 0 ${selectedPage.width} ${selectedPage.height}`}
            className={`absolute inset-0 w-full h-full ${activeTool === "select" ? "" : "pointer-events-none"}`}
            style={{ zIndex: 5 }}
          >
            {[...(selectedPage.annotations || []), currentDrawing].filter(Boolean).map((annotation) => {
              const isSelected = annotation.id === selectedAnnotationId;
              const props = {
                key: annotation.id,
                onPointerDown: (e) => {
                  if (activeTool === "select") {
                    e.stopPropagation();
                    setSelectedAnnotationId(annotation.id);
                  }
                },
                className: `transition-colors ${activeTool === "select" ? "cursor-pointer" : ""} ${
                  isSelected ? "ring-2 ring-emerald-500 drop-shadow-md" : "hover:drop-shadow-sm"
                }`,
              };

              if (annotation.type === 'draw') {
                const points = annotation.points
                  .map(
                    (p) =>
                      `${(p.xPercent / 100) * selectedPage.width},${
                        (p.yPercent / 100) * selectedPage.height
                      }`
                  )
                  .join(' ');

                return (
                  <polyline
                    {...props}
                    points={points}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: isSelected ? "drop-shadow(0px 0px 2px rgba(16, 185, 129, 0.8))" : "none"
                    }}
                  />
                );
              }

              if (['shape-rect', 'shape-circle', 'highlight', 'redaction'].includes(annotation.type)) {
                let x = annotation.xPercent;
                let y = annotation.yPercent;
                let w = annotation.widthPercent;
                let h = annotation.heightPercent;

                // If currently drawing, calculate from start and current
                if (annotation.id === currentDrawing?.id) {
                  x = Math.min(annotation.start.xPercent, annotation.current.xPercent);
                  y = Math.min(annotation.start.yPercent, annotation.current.yPercent);
                  w = Math.abs(annotation.current.xPercent - annotation.start.xPercent);
                  h = Math.abs(annotation.current.yPercent - annotation.start.yPercent);
                }

                const px = (x / 100) * selectedPage.width;
                const py = (y / 100) * selectedPage.height;
                const pw = (w / 100) * selectedPage.width;
                const ph = (h / 100) * selectedPage.height;

                const isHighlight = annotation.type === 'highlight';
                const isRedaction = annotation.type === 'redaction';

                if (annotation.type === 'shape-rect' || isHighlight || isRedaction) {
                  return (
                    <rect
                      {...props}
                      x={px}
                      y={py}
                      width={pw}
                      height={ph}
                      stroke={isRedaction ? '#ef4444' : (isHighlight ? "none" : annotation.color)}
                      strokeWidth={isRedaction ? 2 : (isHighlight ? 0 : annotation.strokeWidth)}
                      fill={isRedaction ? annotation.color : (isHighlight ? annotation.color : "none")}
                      fillOpacity={isHighlight ? 0.4 : 1}
                      style={{
                        ...(isRedaction ? { strokeDasharray: "4 2" } : {}),
                        outline: isSelected ? "2px solid #10b981" : "none",
                        outlineOffset: "2px"
                      }}
                    />
                  );
                }

                if (annotation.type === 'shape-circle') {
                  return (
                    <ellipse
                      {...props}
                      cx={px + pw / 2}
                      cy={py + ph / 2}
                      rx={pw / 2}
                      ry={ph / 2}
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      fill="none"
                      style={{
                        outline: isSelected ? "2px solid #10b981" : "none",
                        outlineOffset: "2px"
                      }}
                    />
                  );
                }

                if (annotation.type === 'image' && annotation.dataUrl) {
                  return (
                    <image
                      {...props}
                      href={annotation.dataUrl}
                      x={px}
                      y={py}
                      width={pw}
                      height={ph}
                      preserveAspectRatio="none"
                      style={{
                        outline: isSelected ? "2px solid #10b981" : "none",
                        outlineOffset: "2px"
                      }}
                    />
                  );
                }
              }

              return null;
            })}

            {/* Render Search Highlight */}
            {activeSearchHighlight && (
              <rect
                x={(activeSearchHighlight.xPercent / 100) * selectedPage.width}
                y={(activeSearchHighlight.yPercent / 100) * selectedPage.height}
                width={(activeSearchHighlight.widthPercent / 100) * selectedPage.width}
                height={(activeSearchHighlight.heightPercent / 100) * selectedPage.height}
                fill="#fef08a" // yellow-200
                fillOpacity={0.5}
                stroke="#eab308" // yellow-500
                strokeWidth={2}
                className="animate-pulse"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>

          {/* Render Form Fields */}
          {selectedPage.formFields?.map((field) => {
            const isSelectable = activeTool === "select";
            
            const baseClasses = `absolute flex items-center justify-center border transition-all ${
              isSelectable ? 'pointer-events-auto' : 'pointer-events-none'
            } bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900`;

            const style = {
              left: `${field.xPercent}%`,
              top: `${field.yPercent}%`,
              width: `${field.widthPercent}%`,
              height: `${field.heightPercent}%`,
              fontSize: `${12 * zoomLevel}px`, // approximate base font size scaling
            };

            if (field.type === 'PDFTextField') {
              return (
                <textarea
                  key={field.id}
                  value={field.value || ''}
                  onChange={(e) => updateFormField(selectedPage.id, field.id, e.target.value)}
                  className={`${baseClasses} resize-none p-1 font-sans overflow-hidden`}
                  style={style}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              );
            }

            if (field.type === 'PDFCheckBox') {
              return (
                <div key={field.id} className={baseClasses} style={style}>
                  <input
                    type="checkbox"
                    checked={field.value === true}
                    onChange={(e) => updateFormField(selectedPage.id, field.id, e.target.checked)}
                    className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  {field.value === true && (
                    <svg className="w-4/5 h-4/5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              );
            }
            
            if (field.type === 'PDFRadioGroup') {
              return (
                <div key={field.id} className={`${baseClasses} rounded-full`} style={style}>
                   <input
                    type="radio"
                    checked={field.value !== ''}
                    // For a true PDF radio, we'd need to know the export value, but for now we'll just toggle it as checked string
                    onChange={(e) => updateFormField(selectedPage.id, field.id, e.target.checked ? 'Yes' : '')}
                    className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  {field.value !== '' && (
                    <div className="w-1/2 h-1/2 bg-emerald-600 rounded-full" />
                  )}
                </div>
              );
            }
            
            if (field.type === 'PDFDropdown' || field.type === 'PDFOptionList') {
              return (
                <input
                  key={field.id}
                  type="text"
                  value={field.value || ''}
                  onChange={(e) => updateFormField(selectedPage.id, field.id, e.target.value)}
                  className={`${baseClasses} px-1 font-sans truncate`}
                  style={style}
                  placeholder="Select/Type"
                  onPointerDown={(e) => e.stopPropagation()}
                />
              );
            }

            return null;
          })}

          {/* Render Crop Box */}
          {renderCropBox()}
        </div>
      </div>
    </div>
  );
}

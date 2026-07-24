import { useEffect, useRef, useState } from 'react';
import { usePdf } from '../hooks/usePdf';
import { loadPdfDocument, renderPageThumbnail } from '../utils/pdfjs';

const thumbnailCache = new Map();
const pdfDocCache = new Map();

/** Call on workspace reset to free memory from accumulated caches. */
export function clearThumbnailCaches() {
  // Revoke all cached Object URLs to free memory
  for (const url of thumbnailCache.values()) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  thumbnailCache.clear();
  // Destroy cached PDF documents
  for (const doc of pdfDocCache.values()) {
    try { doc.destroy(); } catch { /* ignore */ }
  }
  pdfDocCache.clear();
}

export function ThumbnailCanvas({ documentId, sourcePageIndex, height, rotation, width, src }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { getSourceDocument } = usePdf();
  
  const [internalSrc, setInternalSrc] = useState(() => src || thumbnailCache.get(`${documentId}-${sourcePageIndex}`) || null);

  useEffect(() => {
    if (internalSrc) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        
        const generate = async () => {
          const cacheKey = `${documentId}-${sourcePageIndex}`;
          if (thumbnailCache.has(cacheKey)) {
            setInternalSrc(thumbnailCache.get(cacheKey));
            return;
          }
          
          let pdfJsDoc = pdfDocCache.get(documentId);
          if (!pdfJsDoc) {
             const doc = getSourceDocument(documentId);
             if (!doc) return;
             pdfJsDoc = await loadPdfDocument(doc.bytes);
             pdfDocCache.set(documentId, pdfJsDoc);
          }
          
          const thumbnail = await renderPageThumbnail(pdfJsDoc, sourcePageIndex);
          thumbnailCache.set(cacheKey, thumbnail.thumbnailUrl);
          setInternalSrc(thumbnail.thumbnailUrl);
        };
        generate();
      }
    }, { rootMargin: '200px' });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [internalSrc, documentId, sourcePageIndex, getSourceDocument]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !internalSrc) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const image = new Image();
    const normalizedRotation = ((rotation % 360) + 360) % 360;

    image.onload = () => {
      const quarterTurn =
        normalizedRotation === 90 || normalizedRotation === 270;
      const canvasWidth = quarterTurn ? height : width;
      const canvasHeight = quarterTurn ? width : height;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`;

      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = '#fff9f1';
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      context.save();
      context.translate(canvasWidth / 2, canvasHeight / 2);
      context.rotate((normalizedRotation * Math.PI) / 180);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.restore();
    };

    image.src = internalSrc;

    return () => {
      image.onload = null;
    };
  }, [height, rotation, internalSrc, width]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center relative">
      <canvas
        className={`h-auto w-full rounded-[18px] border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${!internalSrc ? 'invisible' : ''}`}
        ref={canvasRef}
      />
      {!internalSrc && (
        <div className="absolute inset-0 m-2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
      )}
    </div>
  );
}

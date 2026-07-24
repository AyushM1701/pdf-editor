import { useCallback, useEffect, useRef } from 'react';

export function useExportWorker() {
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runWorkerTask = useCallback((type, payload, transferables = []) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/pdfExport.worker.js', import.meta.url),
        { type: 'module' },
      );
    }

    const worker = workerRef.current;
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        const { data } = event;
        if (data?.requestId !== requestId) {
          return;
        }

        if (data.status === 'success') {
          cleanup();
          resolve(data.payload);
        }

        if (data.status === 'error') {
          cleanup();
          reject(new Error(data.message));
        }
      };

      const handleError = (event) => {
        cleanup();
        reject(event.error ?? new Error('The PDF worker failed.'));
      };

      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      worker.postMessage(
        {
          requestId,
          type,
          payload,
        },
        transferables,
      );
    });
  }, []);

  const exportPdf = useCallback(
    (payload) => {
      const transferableDocuments = payload.documents.map((document) => ({
        ...document,
        bytes: new Uint8Array(document.bytes),
      }));

      return runWorkerTask(
        'EXPORT_PDF',
        {
          ...payload,
          documents: transferableDocuments,
        },
        transferableDocuments.map((document) => document.bytes.buffer),
      );
    },
    [runWorkerTask],
  );

  const createTextPdf = useCallback(
    (payload) => runWorkerTask('CREATE_TEXT_PDF', payload),
    [runWorkerTask],
  );

  const createImagePdf = useCallback(
    (payload) => {
      const transferableImages = payload.images.map((image) => ({
        ...image,
        bytes: new Uint8Array(image.bytes),
      }));

      return runWorkerTask(
        'CREATE_IMAGE_PDF',
        {
          ...payload,
          images: transferableImages,
        },
        transferableImages.map((image) => image.bytes.buffer),
      );
    },
    [runWorkerTask],
  );

  return {
    exportPdf,
    createTextPdf,
    createImagePdf,
  };
}

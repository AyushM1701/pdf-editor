import { useEffect, useState, useMemo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { toast } from 'react-hot-toast';
import { AIExtractionPanel } from '../features/ai-extraction/AIExtractionPanel';
import { runAIExtractionFlow } from '../api/apiClient';
import { validateExtractionResponse } from '../schemas/pdfState';

const INITIAL_AI_STATE = Object.freeze({
  status: 'idle',
  error: '',
  result: null,
});

export function AIExtractionPage() {
  const { documents, getSourceDocument } = usePdf();
  const navigate = useNavigate();
  const [aiState, setAiState] = useState(INITIAL_AI_STATE);

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  const aiDocuments = useMemo(
    () =>
      documents.map((document) => ({
        id: document.id,
        label: `${document.fileName} - ${document.pageCount} pages`,
      })),
    [documents],
  );

  const handleRunAIExtraction = async (documentId, options = { summarize: false }) => {
    const sourceDocument = getSourceDocument(documentId);
    if (!sourceDocument?.file) {
      toast.error('The selected source file is no longer available in memory.');
      setAiState({
        status: 'error',
        error: 'The selected source file is no longer available in memory.',
        result: null,
      });
      return;
    }

    setAiState({
      status: 'running',
      error: '',
      result: null,
    });

    let toastId;
    try {
      toastId = toast.loading('Initializing AI extraction...');
      
      const onProgress = (message) => {
        toast.loading(message, { id: toastId });
      };

      const result = await runAIExtractionFlow(sourceDocument.file, onProgress, options);
      validateExtractionResponse(result);
      
      toast.success('Extraction complete!', { id: toastId });

      startTransition(() => {
        setAiState({
          status: 'success',
          error: '',
          result,
        });
      });
    } catch (error) {
      toast.error(`Extraction failed: ${error.message || 'Unknown error'}`, { id: toastId });
      setAiState({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'The extraction request could not be completed.',
        result: null,
      });
    }
  };

  if (documents.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <AIExtractionPanel
        documents={aiDocuments}
        error={aiState.error}
        isRunning={aiState.status === 'running'}
        result={aiState.result}
        onRunExtraction={handleRunAIExtraction}
      />
    </div>
  );
}

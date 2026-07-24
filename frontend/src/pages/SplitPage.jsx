import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { SplitPanel } from '../components/SplitPanel';

export function SplitPage() {
  const { documents, pages, isExporting, splitDocument } = usePdf();
  const navigate = useNavigate();

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  if (documents.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <SplitPanel
        documents={documents}
        pages={pages}
        isBusy={isExporting}
        onSplitDocument={splitDocument}
      />
    </div>
  );
}

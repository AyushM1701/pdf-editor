import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { ConversionStudio } from '../features/conversions/ConversionStudio';

export function ConversionsPage() {
  const { documents, getSourceDocument, createTextPdf, createImagePdf } = usePdf();
  const navigate = useNavigate();

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  if (documents.length === 0) return null;

  return (
    <ConversionStudio
      createImagePdf={createImagePdf}
      createTextPdf={createTextPdf}
      documents={documents}
      getSourceDocument={getSourceDocument}
    />
  );
}

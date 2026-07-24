import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { MetadataEditor } from '../components/MetadataEditor';

export function MetadataPage() {
  const { documents, metadata, updateMetadata } = usePdf();
  const navigate = useNavigate();

  useEffect(() => {
    if (documents.length === 0) {
      navigate('/');
    }
  }, [documents.length, navigate]);

  if (documents.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <MetadataEditor metadata={metadata} onMetadataChange={updateMetadata} />
    </div>
  );
}

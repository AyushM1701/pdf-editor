import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { FileDropzone } from '../components/FileDropzone';
import { Layers, FileText, SplitSquareHorizontal, RefreshCw, Sparkles } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { MergeStagingArea } from '../components/MergeStagingArea';
import { useState } from 'react';

function ActionCard({ title, description, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-6 text-left rounded-3xl bg-white/60 dark:bg-slate-900/60 border border-white/80 hover:bg-white/90 dark:hover:!bg-slate-900/90 hover:border-slate-300 dark:hover:!border-slate-600 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition duration-300 group"
    >
      <div className="p-3 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-2xl group-hover:bg-slate-900 group-hover:text-white dark:group-hover:!bg-slate-700 dark:group-hover:!text-white transition">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-xl font-display font-semibold text-slate-900 dark:text-slate-100 tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </button>
  );
}

export function LandingPage() {
  const { documents, ingestFiles, isParsing, parseProgress, workspaceError } = usePdf();
  const navigate = useNavigate();
  const [pendingFiles, setPendingFiles] = useState([]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pt-8 relative">
      {documents.length === 0 && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
          <ThemeToggle />
        </div>
      )}
      <div className="space-y-4 text-center">
        <span className="section-kicker justify-center">Local-first editor</span>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.04em] text-slate-950 dark:text-slate-50 sm:text-6xl max-w-3xl mx-auto">
          Private editing and document intelligence.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:text-xl mx-auto">
          Start by dropping one or more PDF files below.
        </p>
      </div>

      {!pendingFiles.length && (
        <FileDropzone
          compact={documents.length > 0}
          disabled={isParsing}
          onFilesSelected={setPendingFiles}
        />
      )}

      {pendingFiles.length > 0 && (
        <MergeStagingArea
          files={pendingFiles}
          onConfirm={(configuredFiles) => {
            setPendingFiles([]);
            ingestFiles(configuredFiles);
          }}
          onCancel={() => setPendingFiles([])}
        />
      )}

      {isParsing && parseProgress && parseProgress.total > 0 && (
        <div className="text-center text-slate-600 dark:text-slate-400 font-medium">
          Parsing page {parseProgress.current} of {parseProgress.total}...
        </div>
      )}

      {workspaceError && (
        <div className="rounded-3xl border border-amber-300/70 bg-amber-100/80 px-4 py-3 text-sm text-amber-950 text-center shadow-[0_20px_45px_rgba(120,76,22,0.12)]">
          {workspaceError}
        </div>
      )}

      {!pendingFiles.length && documents.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-semibold text-slate-900 dark:text-slate-100 tracking-[-0.03em]">What would you like to do?</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionCard
              title="Organize Pages"
              description="Reorder, rotate, delete pages, and add text overlays locally."
              icon={Layers}
              onClick={() => navigate('/editor')}
            />
            <ActionCard
              title="Edit Metadata"
              description="Modify title, author, and subject properties."
              icon={FileText}
              onClick={() => navigate('/metadata')}
            />
            <ActionCard
              title="Split PDF"
              description="Extract specific pages or groups into new files."
              icon={SplitSquareHorizontal}
              onClick={() => navigate('/split')}
            />
            <ActionCard
              title="Conversions"
              description="Convert to Word, extract images, or create PDFs from images."
              icon={RefreshCw}
              onClick={() => navigate('/conversions')}
            />
            <ActionCard
              title="AI Extraction"
              description="Run OCR and document intelligence (requires backend)."
              icon={Sparkles}
              onClick={() => navigate('/ai-extraction')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

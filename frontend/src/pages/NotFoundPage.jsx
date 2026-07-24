import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 text-slate-400">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-display font-semibold text-slate-900 dark:text-slate-100 tracking-[-0.03em] mb-3">
        Page not found
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>
      <Link 
        to="/" 
        className="px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
      >
        Go to Homepage
      </Link>
    </div>
  );
}

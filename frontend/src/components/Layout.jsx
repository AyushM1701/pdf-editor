import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePdf } from '../hooks/usePdf';
import { Toolbar } from './Toolbar';
import { Layers, FileText, SplitSquareHorizontal, RefreshCw, Sparkles, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

function NavLink({ to, icon: Icon, label, isActive }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition shrink-0 whitespace-nowrap ${
        isActive
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-100'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function Layout() {
  const { documents, isParsing, isExporting, clearWorkspace, exportDocument, pages } = usePdf();
  const location = useLocation();
  const navigate = useNavigate();

  const handleClear = () => {
    clearWorkspace();
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(244,188,120,0.28),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(30,93,97,0.18),_transparent_28%),linear-gradient(180deg,_#f7f1e8_0%,_#efe7db_48%,_#e8dfd1_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.1),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#1e293b_100%)] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        
        {documents.length > 0 && (
          <header className="surface-card overflow-hidden px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,_#1f6f68_0%,_#d48d49_52%,_#304e7c_100%)]" />
            
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto max-w-full pb-2 sm:pb-0 hide-scrollbar scroll-smooth">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />
              <NavLink to="/editor" icon={Layers} label="Organize" isActive={location.pathname === '/editor'} />
              <NavLink to="/metadata" icon={FileText} label="Metadata" isActive={location.pathname === '/metadata'} />
              <NavLink to="/split" icon={SplitSquareHorizontal} label="Split" isActive={location.pathname === '/split'} />
              <NavLink to="/conversions" icon={RefreshCw} label="Convert" isActive={location.pathname === '/conversions'} />
              <NavLink to="/ai-extraction" icon={Sparkles} label="AI Extract" isActive={location.pathname === '/ai-extraction'} />
            </div>

            <div className="shrink-0 w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0">
              <ThemeToggle />
              <Toolbar
                documentCount={documents.length}
                isBusy={isParsing}
                isExporting={isExporting}
                onClear={handleClear}
                onExport={exportDocument}
                pageCount={pages.length}
                compact={true}
              />
            </div>
          </header>
        )}

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </main>
  );
}

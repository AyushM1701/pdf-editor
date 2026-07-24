import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { X, Lock } from 'lucide-react';

const PasswordModalContext = createContext(null);

export function usePasswordModal() {
  const context = useContext(PasswordModalContext);
  if (!context) {
    throw new Error('usePasswordModal must be used within a PasswordModalProvider');
  }
  return context;
}

export function PasswordModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolverRef = useRef(null);

  const requestPassword = useCallback((file_name, errorMessage = '') => {
    return new Promise((resolve, reject) => {
      setFilename(file_name);
      setPassword('');
      setError(errorMessage);
      setIsOpen(true);
      setIsSubmitting(false);

      resolverRef.current = { resolve, reject };
    });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) return;
    setIsSubmitting(true);
    if (resolverRef.current) {
      resolverRef.current.resolve(password);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    if (resolverRef.current) {
      resolverRef.current.reject(new Error('Password prompt cancelled.'));
      setIsOpen(false);
    }
  };

  return (
    <PasswordModalContext.Provider value={{ requestPassword }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md p-6 rounded-2xl shadow-xl border border-white/20 relative animate-in">
            <button 
              onClick={handleCancel}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-3">
                <Lock className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Password Required</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
                The file <strong>{filename}</strong> is protected. Please enter the password to open it.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="input-group">
                <span>Document Password</span>
                <input 
                  type="password" 
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  required
                  disabled={isSubmitting}
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 font-medium">
                  {error}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!password || isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Decrypting...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PasswordModalContext.Provider>
  );
}

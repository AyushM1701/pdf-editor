import { createContext, useContext } from 'react';
import { useLocalPDF } from '../hooks/useLocalPDF';

export const PdfContext = createContext(null);

export function PdfProvider({ children }) {
  const pdfState = useLocalPDF();

  return (
    <PdfContext.Provider value={pdfState}>
      {children}
    </PdfContext.Provider>
  );
}



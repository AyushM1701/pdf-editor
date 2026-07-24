import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { PdfProvider } from './context/PdfContext';
import { PasswordModalProvider } from './context/PasswordModalContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { EditorPage } from './pages/EditorPage';
import { MetadataPage } from './pages/MetadataPage';
import { SplitPage } from './pages/SplitPage';
import { ConversionsPage } from './pages/ConversionsPage';
import { AIExtractionPage } from './pages/AIExtractionPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <PasswordModalProvider>
      <PdfProvider>
        <Toaster position="bottom-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="metadata" element={<MetadataPage />} />
            <Route path="split" element={<SplitPage />} />
            <Route path="conversions" element={<ConversionsPage />} />
            <Route path="ai-extraction" element={<AIExtractionPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PdfProvider>
  </PasswordModalProvider>
  );
}

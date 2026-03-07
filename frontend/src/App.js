import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import PhotosPage from './pages/PhotosPage';
import WhatsAppPage from './pages/WhatsAppPage';
import OtherFilesPage from './pages/OtherFilesPage';

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/photos" element={<PhotosPage />} />
            <Route path="/library/whatsapp" element={<WhatsAppPage />} />
            <Route path="/library/files" element={<OtherFilesPage />} />
            <Route path="*" element={<Navigate to="/library" />} />
          </Routes>
        </BrowserRouter>
      )}
    </Authenticator>
  );
}


export default App;

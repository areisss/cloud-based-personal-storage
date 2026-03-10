import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import PhotosPage from './pages/PhotosPage';
import VideosPage from './pages/VideosPage';
import WhatsAppPage from './pages/WhatsAppPage';
import OtherFilesPage from './pages/OtherFilesPage';

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <BrowserRouter>
          <Nav signOut={signOut} user={user} />
          <div style={{ paddingTop: '60px', minHeight: '100vh' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/library/photos" element={<PhotosPage />} />
              <Route path="/library/videos" element={<VideosPage />} />
              <Route path="/library/whatsapp" element={<WhatsAppPage />} />
              <Route path="/library/files" element={<OtherFilesPage />} />
              <Route path="*" element={<Navigate to="/library" />} />
            </Routes>
          </div>
        </BrowserRouter>
      )}
    </Authenticator>
  );
}

export default App;

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

function AuthedLibrary() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <>
          <Nav signOut={signOut} user={user} />
          <div style={{ paddingTop: '60px', minHeight: '100vh' }}>
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="photos" element={<PhotosPage />} />
              <Route path="videos" element={<VideosPage />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="files" element={<OtherFilesPage />} />
              <Route path="*" element={<Navigate to="/library" />} />
            </Routes>
          </div>
        </>
      )}
    </Authenticator>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Nav />
              <div style={{ paddingTop: '60px', minHeight: '100vh' }}>
                <HomePage />
              </div>
            </>
          }
        />
        <Route path="/library/*" element={<AuthedLibrary />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

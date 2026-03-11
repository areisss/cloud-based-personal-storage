import { useState, useEffect } from 'react';
import { ThemeProvider } from './ThemeContext';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { fetchAuthSession } from 'aws-amplify/auth';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import PhotosPage from './pages/PhotosPage';
import VideosPage from './pages/VideosPage';
import WhatsAppPage from './pages/WhatsAppPage';
import OtherFilesPage from './pages/OtherFilesPage';

// Rendered after Cognito authentication. Detects whether the signed-in user
// belongs to the "demo" group and passes that flag to LibraryPage so the
// upload card and write actions can be hidden for demo accounts.
function AuthedApp({ signOut, user }) {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetchAuthSession()
      .then(session => {
        const groups = session.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
        setIsDemo(groups.includes('demo'));
      })
      .catch(() => {});
  }, [user]);

  return (
    <>
      <Nav signOut={signOut} user={user} />
      <div style={{ paddingTop: '60px', minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<LibraryPage isDemo={isDemo} />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="files" element={<OtherFilesPage />} />
          <Route path="*" element={<Navigate to="/library" />} />
        </Routes>
      </div>
    </>
  );
}

function AuthedLibrary() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AuthedApp signOut={signOut} user={user} />
      )}
    </Authenticator>
  );
}

function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;

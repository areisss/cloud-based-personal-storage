import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_PHOTOS_API_URL;

function PhotosPage() {
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens.idToken.toString();
        const response = await fetch(API_URL, { headers: { Authorization: idToken } });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        setPhotos(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, []);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: '#6366f1', fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <h1 style={{ margin: '16px 0 32px', fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>
        Photos
      </h1>

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: '15px' }}>
          Loading photos…
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: '#ef4444', fontSize: '15px' }}>Failed to load: {error}</p>
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>📷</div>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: '#475569' }}>
            No photos yet
          </p>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Upload a .jpg, .png, or .webp file from the home page.
          </p>
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {photos.map(photo => (
            <div key={photo.photo_id} style={{
              background: '#fff',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <img
                src={photo.thumbnail_url}
                alt={photo.filename}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '10px 12px' }}>
                {photo.tags?.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {photo.tags.map(tag => (
                      <span key={tag} style={{
                        background: '#eff6ff', color: '#3b82f6',
                        padding: '2px 8px', borderRadius: '999px',
                        fontSize: '11px', fontWeight: '500',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={photo.original_url}
                  download={photo.filename}
                  style={{
                    display: 'block', textAlign: 'center',
                    background: '#f1f5f9', color: '#475569',
                    padding: '7px', borderRadius: '7px',
                    fontSize: '13px', fontWeight: '500',
                  }}
                >
                  ⬇ Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotosPage;

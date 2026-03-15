import { useEffect, useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const API_URL = process.env.REACT_APP_PHOTOS_API_URL;
const PAGE_LIMIT = 50;

function PhotosPage() {
  const { t } = useTheme();
  const [photos, setPhotos]     = useState([]);
  const [total, setTotal]       = useState(null);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState(null);
  const tokenRef = useRef(null);

  async function getToken() {
    if (tokenRef.current) return tokenRef.current;
    const session = await fetchAuthSession();
    tokenRef.current = session.tokens.idToken.toString();
    return tokenRef.current;
  }

  async function fetchPage(pageNum, append = false) {
    try {
      const token = await getToken();
      const url = `${API_URL}?page=${pageNum}&limit=${PAGE_LIMIT}`;
      const response = await fetch(url, { headers: { Authorization: token } });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setPhotos(prev => append ? [...prev, ...data.items] : data.items);
      setTotal(data.total);
      setHasMore(data.has_more);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchPage(0).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(page + 1, true);
    setLoadingMore(false);
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: t.accent, fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '16px 0 32px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: t.text }}>
          Photos
        </h1>
        {total !== null && (
          <span style={{ fontSize: '14px', color: t.muted }}>
            {photos.length} of {total}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: t.subtle, fontSize: '15px' }}>
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
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: t.muted }}>
            No photos yet
          </p>
          <p style={{ margin: 0, color: t.subtle, fontSize: '14px' }}>
            Upload a .jpg, .png, or .webp file from the home page.
          </p>
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            {photos.map(photo => (
              <div key={photo.photo_id} style={{
                background: t.surface,
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${t.border}`,
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
                          background: t.photoTagBg, color: t.photoTagText,
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
                      background: t.downloadBg, color: t.downloadText,
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

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  padding: '10px 28px',
                  borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  color: t.text,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? 'Loading…' : `Load more (${total - photos.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PhotosPage;

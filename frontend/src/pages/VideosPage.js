import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const API_URL = process.env.REACT_APP_VIDEOS_API_URL;

function groupByDate(videos) {
  const groups = {};
  for (const video of videos) {
    const date = video.uploaded_at.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(video);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function formatDate(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatDuration(seconds) {
  const s = parseFloat(seconds);
  if (!s) return '';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function VideosPage() {
  const { t } = useTheme();
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens.idToken.toString();
        const response = await fetch(API_URL, { headers: { Authorization: idToken } });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        setVideos(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, []);

  const groups = groupByDate(videos);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: t.accent, fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <h1 style={{ margin: '16px 0 32px', fontSize: '28px', fontWeight: '800', color: t.text }}>
        Videos
      </h1>

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: t.subtle, fontSize: '15px' }}>
          Loading videos…
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: '#ef4444', fontSize: '15px' }}>Failed to load: {error}</p>
        </div>
      )}

      {!loading && !error && videos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>🎬</div>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: t.muted }}>
            No videos yet
          </p>
          <p style={{ margin: 0, color: t.subtle, fontSize: '14px' }}>
            Upload a .mp4, .mov, .avi, .mkv, or .webm file from the home page.
          </p>
        </div>
      )}

      {!loading && !error && groups.map(([date, dateVideos]) => (
        <div key={date} style={{ marginBottom: '48px' }}>
          <h2 style={{
            margin: '0 0 16px',
            fontSize: '13px', fontWeight: '700', color: t.muted,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            borderBottom: `1px solid ${t.border}`, paddingBottom: '8px',
          }}>
            {formatDate(date)}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {dateVideos.map(video => (
              <div key={video.video_id} style={{
                background: t.surface,
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${t.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={video.thumbnail_url}
                    alt={video.filename}
                    style={{
                      width: '100%', aspectRatio: '16/9',
                      objectFit: 'cover', display: 'block',
                      background: '#0f172a',
                    }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.15)',
                  }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.88)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', paddingLeft: '3px',
                    }}>
                      ▶
                    </div>
                  </div>
                  {video.duration_seconds && (
                    <span style={{
                      position: 'absolute', bottom: '6px', right: '8px',
                      background: 'rgba(0,0,0,0.72)', color: '#fff',
                      fontSize: '11px', fontWeight: '600',
                      padding: '2px 6px', borderRadius: '4px',
                    }}>
                      {formatDuration(video.duration_seconds)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '10px 12px' }}>
                  <p style={{
                    margin: '0 0 8px', fontSize: '12px', color: t.muted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {video.filename}
                  </p>
                  <a
                    href={video.original_url}
                    download={video.filename}
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
        </div>
      ))}
    </div>
  );
}

export default VideosPage;

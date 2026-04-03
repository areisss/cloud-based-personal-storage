import { useEffect, useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const API_URL = process.env.REACT_APP_VIDEOS_API_URL;
const PAGE_LIMIT = 30;

function formatDuration(seconds) {
  const s = parseFloat(seconds);
  if (!s) return '';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function VideosPage() {
  const { t } = useTheme();

  // "groups" = landing view with year+location cards; "detail" = paginated grid
  const [viewMode, setViewMode]       = useState('groups');
  const [detailGroup, setDetailGroup] = useState(null); // { year, location, count }

  // Groups view state
  const [groups, setGroups]           = useState([]);

  // Detail view state
  const [videos, setVideos]           = useState([]);
  const [total, setTotal]             = useState(null);
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editTitle, setEditTitle]     = useState('');
  const [saving, setSaving]           = useState(false);
  const tokenRef = useRef(null);

  async function getToken() {
    if (tokenRef.current) return tokenRef.current;
    const session = await fetchAuthSession();
    tokenRef.current = session.tokens.idToken.toString();
    return tokenRef.current;
  }

  async function fetchGroups() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}?view=groups`, { headers: { Authorization: token } });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setGroups(data.groups);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetailPage(group, pageNum, append = false) {
    const loc = encodeURIComponent(group.location);
    const url = `${API_URL}?year=${group.year}&location=${loc}&page=${pageNum}&limit=${PAGE_LIMIT}`;
    try {
      const token = await getToken();
      const response = await fetch(url, { headers: { Authorization: token } });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setVideos(prev => append ? [...prev, ...data.items] : data.items);
      setTotal(data.total);
      setHasMore(data.has_more);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openGroup(group) {
    setDetailGroup(group);
    setVideos([]);
    setTotal(null);
    setHasMore(false);
    setPage(0);
    setViewMode('detail');
    setLoading(true);
    setError(null);
    await fetchDetailPage(group, 0);
    setLoading(false);
  }

  function backToGroups() {
    setViewMode('groups');
    setDetailGroup(null);
  }

  async function loadMore() {
    setLoadingMore(true);
    await fetchDetailPage(detailGroup, page + 1, true);
    setLoadingMore(false);
  }

  async function saveGroupTitle(group) {
    setSaving(true);
    try {
      const token = await getToken();
      const loc = encodeURIComponent(group.location);
      const title = encodeURIComponent(editTitle.trim());
      const resp = await fetch(
        `${API_URL}?action=rename_group&year=${group.year}&location=${loc}&title=${title}`,
        { method: 'PATCH', headers: { Authorization: token } }
      );
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const newTitle = editTitle.trim();
      setGroups(prev => prev.map(g =>
        g.year === group.year && g.location === group.location
          ? { ...g, group_title: newTitle }
          : g
      ));
      if (detailGroup?.year === group.year && detailGroup?.location === group.location) {
        setDetailGroup(prev => ({ ...prev, group_title: newTitle }));
      }
      setEditingGroup(null);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchGroups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Groups view ──────────────────────────────────────────────────────────────
  if (viewMode === 'groups') {
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
            Loading…
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ color: '#ef4444', fontSize: '15px' }}>Failed to load: {error}</p>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
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

        {!loading && !error && groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {groups.map(group => {
              const isEditing = editingGroup?.year === group.year && editingGroup?.location === group.location;
              return (
                <div
                  key={`${group.year}-${group.location}`}
                  onClick={() => { if (!isEditing) openGroup(group); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: '14px', padding: '16px',
                    cursor: isEditing ? 'default' : 'pointer', textAlign: 'left', width: '100%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* 2×2 thumbnail strip */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '3px',
                    width: '120px', height: '120px',
                    flexShrink: 0, borderRadius: '8px', overflow: 'hidden',
                  }}>
                    {group.sample_thumbnails.slice(0, 4).map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {i === 0 && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)',
                          }}>
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: 'rgba(255,255,255,0.85)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '8px', paddingLeft: '2px',
                            }}>▶</div>
                          </div>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - group.sample_thumbnails.length) }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ background: t.border }} />
                    ))}
                  </div>

                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveGroupTitle(group); if (e.key === 'Escape') setEditingGroup(null); }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                          style={{
                            flex: 1, padding: '6px 10px', fontSize: '16px', fontWeight: '600',
                            border: `2px solid ${t.accent}`, borderRadius: '8px',
                            background: t.surface, color: t.text, outline: 'none',
                          }}
                        />
                        <button disabled={saving} onClick={e => { e.stopPropagation(); saveGroupTitle(group); }} style={{
                          background: t.accent, color: '#fff', border: 'none', borderRadius: '8px',
                          padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button onClick={e => { e.stopPropagation(); setEditingGroup(null); }} style={{
                          background: 'transparent', color: t.muted, border: `1px solid ${t.border}`,
                          borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
                        }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: t.text }}>
                          {group.group_title || `${group.year} · ${group.location}`}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingGroup(group); setEditTitle(group.group_title || `${group.year} · ${group.location}`); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '14px', color: t.subtle, padding: '4px',
                          }}
                          title="Edit title"
                        >&#9998;</button>
                      </div>
                    )}
                    {!isEditing && (
                      <div style={{ fontSize: '13px', color: t.subtle }}>
                        {group.count} {group.count === 1 ? 'video' : 'videos'}
                  </div>
                  )}
                </div>

                {!isEditing && <div style={{ color: t.muted, fontSize: '18px', flexShrink: 0 }}>→</div>}
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <button
        onClick={backToGroups}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.accent, fontSize: '14px', fontWeight: '500', padding: 0,
        }}
      >
        ← Back to Videos
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '16px 0 32px', flexWrap: 'wrap' }}>
        {editingGroup?.year === detailGroup.year && editingGroup?.location === detailGroup.location ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveGroupTitle(detailGroup); if (e.key === 'Escape') setEditingGroup(null); }}
              autoFocus
              style={{
                padding: '6px 12px', fontSize: '22px', fontWeight: '700',
                border: `1px solid ${t.accent}`, borderRadius: '8px',
                background: t.surface, color: t.text, outline: 'none', minWidth: '200px',
              }}
            />
            <button onClick={() => saveGroupTitle(detailGroup)} style={{
              background: t.accent, color: '#fff', border: 'none', borderRadius: '6px',
              padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>Save</button>
            <button onClick={() => setEditingGroup(null)} style={{
              background: 'transparent', color: t.muted, border: `1px solid ${t.border}`,
              borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: t.text }}>
              {detailGroup.group_title || `${detailGroup.year} · ${detailGroup.location}`}
            </h1>
            <button
              onClick={() => { setEditingGroup(detailGroup); setEditTitle(detailGroup.group_title || `${detailGroup.year} · ${detailGroup.location}`); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '16px', color: t.subtle, padding: '2px',
              }}
              title="Edit title"
            >&#9998;</button>
          </>
        )}
        {total !== null && (
          <span style={{ fontSize: '14px', color: t.muted }}>
            {videos.length} of {total}
          </span>
        )}
      </div>

      {videos.length > 0 && videos[0].source_zip && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: '8px', padding: '4px 12px', marginBottom: '16px',
          fontSize: '12px', color: t.muted,
        }}>
          From: <strong>{videos[0].source_zip}</strong>
        </div>
      )}

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
          <p style={{ color: t.muted, fontSize: '15px' }}>No videos found in this group.</p>
        </div>
      )}

      {!loading && !error && videos.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {videos.map(video => (
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
                    loading="lazy"
                    decoding="async"
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
                {loadingMore ? 'Loading…' : `Load more (${total - videos.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VideosPage;

import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const API_URL = process.env.REACT_APP_ZIP_PREVIEW_API_URL;

const SECTIONS = [
  { prefix: 'raw-zips/',         label: 'Archives (ZIP)',  emoji: '📦', expandable: true },
  { prefix: 'misc/',             label: 'Miscellaneous',   emoji: '📄', expandable: true },
  { prefix: 'uploads-landing/',  label: 'Other Uploads',   emoji: '📁', expandable: false },
];

const TYPE_ICONS = { photo: '🖼', video: '🎬', audio: '🎵', document: '📄', other: '📎' };

function GroupedTree({ t, scope, grouped, openMonths, openTypes, toggleMonth, toggleType }) {
  return (
    <div>
      {grouped.map(monthGroup => {
        const monthKey = `${scope}::${monthGroup.month}`;
        const isMonthOpen = !!openMonths[monthKey];
        return (
          <div key={monthGroup.month} style={{ marginBottom: '2px' }}>
            <button
              onClick={() => toggleMonth(scope, monthGroup.month)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 0', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: '10px', color: t.muted,
                transform: isMonthOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s', display: 'inline-block',
              }}>▶</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: t.text }}>
                {monthGroup.label}
              </span>
              <span style={{ fontSize: '11px', color: t.subtle }}>
                {monthGroup.count} files · {monthGroup.total_size_human}
              </span>
            </button>

            {isMonthOpen && (
              <div style={{ marginLeft: '18px' }}>
                {monthGroup.types.map(typeGroup => {
                  const typeKey = `${scope}::${monthGroup.month}::${typeGroup.type}`;
                  const isTypeOpen = !!openTypes[typeKey];
                  return (
                    <div key={typeGroup.type} style={{ marginBottom: '2px' }}>
                      <button
                        onClick={() => toggleType(scope, monthGroup.month, typeGroup.type)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '4px 0', width: '100%', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          fontSize: '10px', color: t.muted,
                          transform: isTypeOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s', display: 'inline-block',
                        }}>▶</span>
                        <span style={{ fontSize: '14px' }}>{TYPE_ICONS[typeGroup.type] || '📎'}</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: t.muted }}>
                          {typeGroup.type_label}
                        </span>
                        <span style={{ fontSize: '11px', color: t.subtle }}>
                          {typeGroup.count} · {typeGroup.total_size_human}
                        </span>
                      </button>

                      {isTypeOpen && (
                        <div style={{ marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {typeGroup.entries.map((entry, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              fontSize: '12px', padding: '2px 0',
                            }}>
                              {entry.url ? (
                                <a href={entry.url} target="_blank" rel="noreferrer"
                                  style={{ color: t.fileLinkText, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {entry.name}
                                </a>
                              ) : (
                                <span style={{ color: t.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {entry.name}
                                </span>
                              )}
                              <span style={{ color: t.subtle, fontSize: '11px', flexShrink: 0 }}>
                                {entry.size_human}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceGroupedTree({ t, scope, sources, openSources, openMonths, openTypes, toggleSource, toggleMonth, toggleType }) {
  // If there's only one source and it's "Direct uploads", skip the source level
  if (sources.length === 1 && !sources[0].has_source) {
    return (
      <GroupedTree t={t} scope={scope} grouped={sources[0].months}
        openMonths={openMonths} openTypes={openTypes}
        toggleMonth={toggleMonth} toggleType={toggleType} />
    );
  }

  return (
    <div>
      {sources.map(sourceGroup => {
        const sourceKey = `${scope}::${sourceGroup.source}`;
        const isOpen = !!openSources[sourceKey];
        return (
          <div key={sourceGroup.source} style={{ marginBottom: '2px' }}>
            <button
              onClick={() => toggleSource(scope, sourceGroup.source)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 0', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: '10px', color: t.muted,
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s', display: 'inline-block',
              }}>▶</span>
              <span style={{ fontSize: '16px' }}>{sourceGroup.has_source ? '📦' : '📁'}</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: t.text }}>
                {sourceGroup.source}
              </span>
              <span style={{ fontSize: '11px', color: t.subtle }}>
                {sourceGroup.count} files · {sourceGroup.total_size_human}
              </span>
            </button>

            {isOpen && (
              <div style={{ marginLeft: '24px' }}>
                <GroupedTree t={t} scope={`${scope}::${sourceGroup.source}`} grouped={sourceGroup.months}
                  openMonths={openMonths} openTypes={openTypes}
                  toggleMonth={toggleMonth} toggleType={toggleType} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OtherFilesPage() {
  const { t } = useTheme();
  const [files, setFiles]             = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [expanded, setExpanded]       = useState({});   // zipKey -> zip data
  const [openMonths, setOpenMonths]   = useState({});   // "scope::month" -> true
  const [openTypes, setOpenTypes]     = useState({});   // "scope::month::type" -> true
  const [loadingZip, setLoadingZip]   = useState(null);

  const [openSources, setOpenSources] = useState({});  // "scope::source" -> true

  function toggleSource(scope, source) {
    const k = `${scope}::${source}`;
    setOpenSources(prev => ({ ...prev, [k]: !prev[k] }));
  }
  function toggleMonth(scope, month) {
    const k = `${scope}::${month}`;
    setOpenMonths(prev => ({ ...prev, [k]: !prev[k] }));
  }
  function toggleType(scope, month, type) {
    const k = `${scope}::${month}::${type}`;
    setOpenTypes(prev => ({ ...prev, [k]: !prev[k] }));
  }

  useEffect(() => {
    async function fetchFiles() {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken.toString();
      const result = {};

      for (const { prefix } of SECTIONS) {
        try {
          const url = `${API_URL}?view=list&prefix=${encodeURIComponent(prefix)}`;
          const response = await fetch(url, { headers: { Authorization: token } });
          if (!response.ok) throw new Error(`API ${response.status}`);
          const data = await response.json();
          result[prefix] = data.items || [];
          if (data.grouped) result[`${prefix}_grouped`] = data.grouped;
        } catch (err) {
          console.warn(`Failed to list ${prefix}:`, err.message);
          result[prefix] = [];
        }
      }
      setFiles(result);
      setLoading(false);
    }
    fetchFiles().catch(err => { setError(err.message); setLoading(false); });
  }, []);

  async function toggleZipPreview(fileKey) {
    if (expanded[fileKey]) {
      setExpanded(prev => { const next = { ...prev }; delete next[fileKey]; return next; });
      return;
    }

    setLoadingZip(fileKey);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken.toString();
      const url = `${API_URL}?key=${encodeURIComponent(fileKey)}`;
      const response = await fetch(url, { headers: { Authorization: token } });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setExpanded(prev => ({ ...prev, [fileKey]: data }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingZip(null);
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 24px', color: t.subtle, fontSize: '15px' }}>
      Loading files…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px 24px', color: '#ef4444', fontSize: '15px' }}>
      Error: {error}
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: t.accent, fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <h1 style={{ margin: '16px 0 32px', fontSize: '28px', fontWeight: '800', color: t.text }}>
        Other Files
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {SECTIONS.map(({ prefix, label, emoji, expandable }) => {
          const items = files[prefix] ?? [];
          return (
            <div key={prefix} style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px',
                background: t.sectionHeaderBg,
                borderBottom: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '20px' }}>{emoji}</span>
                <span style={{ fontWeight: '700', fontSize: '15px', color: t.text }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: t.subtle }}>
                  {items.length} {items.length === 1 ? 'file' : 'files'}
                </span>
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: t.subtle, fontSize: '14px' }}>
                  No files yet
                </div>
              ) : (
                <div style={{ padding: '8px 20px 10px' }}>
                  {/* ZIP files pinned at top with expand button */}
                  {items.filter(f => (f.name || '').toLowerCase().endsWith('.zip')).map(file => {
                    const zipData = expanded[file.key];
                    const isLoading = loadingZip === file.key;
                    return (
                      <div key={file.key}>
                        <div style={{
                          padding: '8px 0', borderBottom: `1px solid ${t.border2}`,
                          display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                          <button
                            onClick={() => toggleZipPreview(file.key)}
                            disabled={isLoading}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '14px', color: t.muted, padding: '2px 4px',
                              transform: zipData ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s',
                            }}
                          >{isLoading ? '...' : '▶'}</button>
                          <span style={{ fontSize: '18px' }}>📦</span>
                          <a href={file.url} target="_blank" rel="noreferrer"
                            style={{ color: t.fileLinkText, fontSize: '14px', flex: 1 }}>{file.name}</a>
                          {file.size_human && (
                            <span style={{ fontSize: '11px', color: t.subtle, flexShrink: 0 }}>{file.size_human}</span>
                          )}
                        </div>
                        {zipData && (
                          <div style={{ padding: '6px 0 10px 16px', background: t.bg, borderBottom: `1px solid ${t.border2}` }}>
                            <div style={{ fontSize: '12px', color: t.subtle, marginBottom: '8px', display: 'flex', gap: '16px' }}>
                              <span>{zipData.total_entries} files</span>
                              <span>{zipData.total_size_human} total</span>
                            </div>
                            <GroupedTree t={t} scope={file.key} grouped={zipData.grouped || []}
                              openMonths={openMonths} openTypes={openTypes}
                              toggleMonth={toggleMonth} toggleType={toggleType} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Grouped tree for non-zip files: source -> month -> type -> files */}
                  {files[`${prefix}_grouped`] && files[`${prefix}_grouped`].length > 0 ? (
                    <SourceGroupedTree
                      t={t}
                      scope={prefix}
                      sources={files[`${prefix}_grouped`].map(sg => ({
                        ...sg,
                        // Exclude zip files from grouped tree (they're shown above)
                        months: sg.months.map(m => ({
                          ...m,
                          types: m.types.map(tp => ({
                            ...tp,
                            entries: tp.entries.filter(e => !e.name.toLowerCase().endsWith('.zip')),
                            count: tp.entries.filter(e => !e.name.toLowerCase().endsWith('.zip')).length,
                          })).filter(tp => tp.entries.length > 0),
                        })).filter(m => m.types.length > 0),
                        count: sg.count - (sg.months.reduce((acc, m) =>
                          acc + m.types.reduce((a2, tp) =>
                            a2 + tp.entries.filter(e => e.name.toLowerCase().endsWith('.zip')).length, 0), 0)),
                      })).filter(sg => sg.months.length > 0)}
                      openSources={openSources}
                      openMonths={openMonths}
                      openTypes={openTypes}
                      toggleSource={toggleSource}
                      toggleMonth={toggleMonth}
                      toggleType={toggleType}
                    />
                  ) : (
                    /* Flat list fallback */
                    items.map(file => {
                      const name = file.name || file.key.replace(prefix, '');
                      const isZip = expandable && name.toLowerCase().endsWith('.zip');
                      const zipData = expanded[file.key];
                      const isLoading = loadingZip === file.key;
                      return (
                        <div key={file.key}>
                          <div style={{
                            padding: '8px 0',
                            borderBottom: `1px solid ${t.border2}`,
                            display: 'flex', alignItems: 'center', gap: '12px',
                          }}>
                            {isZip && (
                              <button
                                onClick={() => toggleZipPreview(file.key)}
                                disabled={isLoading}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '14px', color: t.muted, padding: '2px 4px',
                                  transform: zipData ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.15s',
                                }}
                              >
                                {isLoading ? '...' : '▶'}
                              </button>
                            )}
                            <span style={{ fontSize: '18px' }}>{isZip ? '📦' : '📄'}</span>
                            <a href={file.url} target="_blank" rel="noreferrer"
                              style={{ color: t.fileLinkText, fontSize: '14px', flex: 1 }}>{name}</a>
                            {file.size_human && (
                              <span style={{ fontSize: '11px', color: t.subtle, flexShrink: 0 }}>{file.size_human}</span>
                            )}
                          </div>
                          {zipData && (
                            <div style={{ padding: '6px 0 10px 16px', background: t.bg, borderBottom: `1px solid ${t.border2}` }}>
                              <div style={{ fontSize: '12px', color: t.subtle, marginBottom: '8px', display: 'flex', gap: '16px' }}>
                                <span>{zipData.total_entries} files</span>
                                <span>{zipData.total_size_human} total</span>
                              </div>
                              <GroupedTree
                                t={t}
                                scope={file.key}
                                grouped={zipData.grouped || []}
                                openMonths={openMonths}
                                openTypes={openTypes}
                                toggleMonth={toggleMonth}
                                toggleType={toggleType}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OtherFilesPage;

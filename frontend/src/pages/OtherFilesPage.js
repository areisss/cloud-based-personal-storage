import { useEffect, useState } from 'react';
import { list, getUrl } from 'aws-amplify/storage';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const SECTIONS = [
  { prefix: 'misc/',             label: 'Miscellaneous', emoji: '📄' },
  { prefix: 'uploads-landing/', label: 'Archives',       emoji: '📦' },
];

function OtherFilesPage() {
  const { t } = useTheme();
  const [files, setFiles]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const result = {};
        for (const { prefix } of SECTIONS) {
          const { items } = await list({ prefix });
          result[prefix] = await Promise.all(
            items.map(async item => {
              const { url } = await getUrl({ path: item.path });
              return { key: item.path, url: url.toString() };
            })
          );
        }
        setFiles(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, []);

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
        {SECTIONS.map(({ prefix, label, emoji }) => {
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
                <ul style={{ margin: 0, padding: '8px 0', listStyle: 'none' }}>
                  {items.map(file => {
                    const name = file.key.replace(prefix, '');
                    return (
                      <li key={file.key} style={{
                        padding: '10px 20px',
                        borderBottom: `1px solid ${t.border2}`,
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                        <span style={{ fontSize: '18px' }}>📄</span>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: t.fileLinkText, fontSize: '14px', flex: 1 }}
                        >
                          {name}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OtherFilesPage;

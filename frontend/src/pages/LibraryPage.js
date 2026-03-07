import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    to: '/library/photos',
    emoji: '📷',
    label: 'Photos',
    description: 'Browse your photo collection with thumbnails and one-click downloads.',
    headerBg: '#eff6ff',
    accent: '#3b82f6',
  },
  {
    to: '/library/whatsapp',
    emoji: '💬',
    label: 'WhatsApp',
    description: 'Search and filter your exported WhatsApp conversations by sender or date.',
    headerBg: '#f0fdf4',
    accent: '#22c55e',
  },
  {
    to: '/library/files',
    emoji: '📁',
    label: 'Other Files',
    description: 'Miscellaneous files, ZIP archives, and anything else you have uploaded.',
    headerBg: '#faf5ff',
    accent: '#a855f7',
  },
];

function LibraryPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>
        Your Library
      </h1>
      <p style={{ margin: '0 0 40px', color: '#64748b', fontSize: '16px' }}>
        Everything you have uploaded, organised by type.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
      }}>
        {SECTIONS.map(({ to, emoji, label, description, headerBg, accent }) => (
          <Link
            key={to}
            to={to}
            style={{
              display: 'block',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              overflow: 'hidden',
              color: 'inherit',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              background: headerBg,
              padding: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px',
            }}>
              {emoji}
            </div>
            <div style={{ padding: '20px 22px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                {label}
              </h2>
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '14px', lineHeight: '1.55' }}>
                {description}
              </p>
              <span style={{ color: accent, fontSize: '14px', fontWeight: '600' }}>
                Browse →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default LibraryPage;

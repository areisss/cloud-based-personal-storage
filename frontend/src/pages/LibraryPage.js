import { useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { Link } from 'react-router-dom';

export function getPrefix(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'zip') return 'uploads-landing/';
  if (ext === 'txt') return 'raw-whatsapp-uploads/';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'raw-photos/';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'raw-videos/';
  return 'misc/';
}

const DEST_LABEL = {
  'raw-photos/':           'Photos',
  'raw-videos/':           'Videos',
  'raw-whatsapp-uploads/': 'WhatsApp',
  'uploads-landing/':      'Archives',
  'misc/':                 'Files',
};

const TIERS = [
  { value: 'STANDARD',    label: 'Standard',    hint: 'Default'    },
  { value: 'STANDARD_IA', label: 'Standard-IA', hint: 'Lower cost' },
  { value: 'GLACIER_IR',  label: 'Glacier',     hint: 'Archival'   },
];

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 14px',
              borderRadius: '999px',
              border: active ? 'none' : '1px solid #e2e8f0',
              background: active ? '#6366f1' : 'transparent',
              color: active ? '#fff' : '#64748b',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}
          >
            {opt.label}
            {opt.hint && (
              <span style={{ fontSize: '11px', opacity: 0.75, marginLeft: '5px' }}>
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function UploadCard() {
  const [status, setStatus]           = useState(null);
  const [dest, setDest]               = useState('');
  const [errMsg, setErrMsg]           = useState('');
  const [storageMode, setStorageMode] = useState('auto');
  const [storageTier, setStorageTier] = useState('STANDARD');

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const prefix = storageMode === 'raw' ? 'misc/' : getPrefix(file.name);
    setDest(DEST_LABEL[prefix]);
    setStatus('uploading');

    try {
      await uploadData({
        path: prefix + file.name,
        data: file,
        options: {
          metadata: { 'storage-tier': storageTier },
        },
      });
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
    e.target.value = '';
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      padding: '32px',
      textAlign: 'center',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      marginBottom: '48px',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>⬆</div>
      <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
        Upload a file
      </h2>

      <div style={{
        background: '#f8fafc', borderRadius: '10px',
        padding: '16px', marginBottom: '20px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Processing
          </p>
          <PillGroup
            options={[
              { value: 'auto', label: 'Auto-detect', hint: 'by file type' },
              { value: 'raw',  label: 'Store raw',   hint: 'no processing' },
            ]}
            value={storageMode}
            onChange={setStorageMode}
          />
          {storageMode === 'raw' && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              File will be stored as-is in Other Files, with no thumbnail or indexing.
            </p>
          )}
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Storage tier
          </p>
          <PillGroup
            options={TIERS}
            value={storageTier}
            onChange={setStorageTier}
          />
          {storageTier !== 'STANDARD' && storageMode !== 'raw' && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Applied to the original file. Thumbnails always use Standard.
            </p>
          )}
          {storageTier !== 'STANDARD' && storageMode === 'raw' && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#f59e0b' }}>
              Tier selection only applies to processed files (photos & videos).
            </p>
          )}
        </div>
      </div>

      <label style={{
        display: 'inline-block',
        background: '#6366f1', color: '#fff',
        padding: '10px 24px', borderRadius: '8px',
        fontWeight: '600', fontSize: '14px', cursor: 'pointer',
      }}>
        Choose file
        <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
      </label>

      {status === 'uploading' && (
        <p style={{ margin: '16px 0 0', color: '#6366f1', fontSize: '14px' }}>
          Uploading to {dest}…
        </p>
      )}
      {status === 'done' && (
        <p style={{ margin: '16px 0 0', color: '#10b981', fontSize: '14px' }}>
          ✓ Uploaded to {dest}
        </p>
      )}
      {status === 'error' && (
        <p style={{ margin: '16px 0 0', color: '#ef4444', fontSize: '14px' }}>
          ✗ {errMsg}
        </p>
      )}
    </div>
  );
}

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
    to: '/library/videos',
    emoji: '🎬',
    label: 'Videos',
    description: 'Browse your videos grouped by date, with thumbnails and duration.',
    headerBg: '#fff7ed',
    accent: '#f97316',
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

      <UploadCard />

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

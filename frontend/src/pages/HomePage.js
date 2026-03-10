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
  { value: 'STANDARD',    label: 'Standard',   hint: 'Default'     },
  { value: 'STANDARD_IA', label: 'Standard-IA', hint: 'Lower cost'  },
  { value: 'GLACIER_IR',  label: 'Glacier',     hint: 'Archival'    },
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

function HomePage() {
  const [status, setStatus]         = useState(null); // null | 'uploading' | 'done' | 'error'
  const [dest, setDest]             = useState('');
  const [errMsg, setErrMsg]         = useState('');
  const [storageMode, setStorageMode] = useState('auto');   // 'auto' | 'raw'
  const [storageTier, setStorageTier] = useState('STANDARD');

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 'raw' mode bypasses all processing — file goes straight to Other Files.
    const prefix = storageMode === 'raw' ? 'misc/' : getPrefix(file.name);
    setDest(DEST_LABEL[prefix]);
    setStatus('uploading');

    try {
      await uploadData({
        path: prefix + file.name,
        data: file,
        options: {
          // storage-tier is read by photo_processor / video_processor Lambdas
          // and applied as the S3 StorageClass of the original file.
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
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #312e81 60%, #0f172a 100%)',
        color: '#f8fafc',
        padding: '88px 24px 104px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '24px' }}>☁</div>
        <h1 style={{ margin: '0 0 16px', fontSize: '46px', fontWeight: '800', letterSpacing: '-1.5px' }}>
          Your Personal Cloud
        </h1>
        <p style={{
          margin: '0 auto 40px', fontSize: '18px', color: '#a5b4fc',
          maxWidth: '480px', lineHeight: '1.6',
        }}>
          Photos, WhatsApp exports, and files — stored privately, accessible anywhere.
        </p>
        <Link to="/library" style={{
          display: 'inline-block',
          background: '#6366f1', color: '#fff',
          padding: '13px 32px', borderRadius: '10px',
          fontWeight: '600', fontSize: '16px',
          boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
        }}>
          Open Library →
        </Link>
      </div>

      {/* Upload card */}
      <div style={{ maxWidth: '520px', margin: '-36px auto 64px', padding: '0 24px', position: 'relative' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.09)',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⬆</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
            Upload a file
          </h2>

          {/* Options */}
          <div style={{
            background: '#f8fafc', borderRadius: '10px',
            padding: '16px', marginBottom: '24px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {/* Processing mode */}
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

            {/* Storage tier */}
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
      </div>
    </div>
  );
}

export default HomePage;

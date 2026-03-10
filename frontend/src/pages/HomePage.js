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

function HomePage() {
  const [status, setStatus] = useState(null); // null | 'uploading' | 'done' | 'error'
  const [dest, setDest]     = useState('');
  const [errMsg, setErrMsg] = useState('');

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const prefix = getPrefix(file.name);
    setDest(DEST_LABEL[prefix]);
    setStatus('uploading');
    try {
      await uploadData({ path: prefix + file.name, data: file });
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

      {/* Upload card — floats up over the hero */}
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
          <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
            Photos (.jpg, .png) → Photos library<br />
            Videos (.mp4, .mov, .avi…) → Videos library<br />
            WhatsApp exports (.txt) → Messages<br />
            Archives (.zip) or anything else → Files
          </p>
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

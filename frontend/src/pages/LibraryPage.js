import { useState, useRef, useEffect } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

export function getPrefix(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'zip') return 'raw-zips/';
  if (ext === 'txt') return 'raw-whatsapp-uploads/';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'raw-photos/';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'raw-videos/';
  return 'misc/';
}

const DEST_LABEL = {
  'raw-photos/':           'Photos',
  'raw-videos/':           'Videos',
  'raw-whatsapp-uploads/': 'WhatsApp',
  'raw-zips/':             'Archives',
  'misc/':                 'Files',
};

// Processing stages shown after upload, per destination
const PROC_STAGES = {
  Photos:   ['Upload photo',  'Create thumbnail'],
  Videos:   ['Upload video',  'Create thumbnail'],
  WhatsApp: ['Upload export', 'Parse messages'],
  Archives: ['Upload zip',    'Extract contents', 'Process photos', 'Process videos'],
  Files:    ['Upload file'],
};

const TIERS = [
  { value: 'AUTO',        label: 'Auto',        hint: '→ Glacier after 1 day' },
  { value: 'STANDARD',    label: 'Standard',    hint: 'Keep in Standard'       },
  { value: 'STANDARD_IA', label: 'Standard-IA', hint: 'Lower cost'             },
  { value: 'GLACIER_IR',  label: 'Glacier IR',  hint: 'Archival'               },
];

function fmtBytes(n) {
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function PillGroup({ options, value, onChange }) {
  const { t } = useTheme();
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
              border: active ? 'none' : `1px solid ${t.border}`,
              background: active ? t.accent : 'transparent',
              color: active ? '#fff' : t.muted,
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

function StageList({ stages, activeIdx }) {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
      {stages.map((s, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={s}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px',
              color: done ? '#10b981' : active ? t.accent : t.muted,
            }}
          >
            <span style={{
              width: '18px', textAlign: 'center', flexShrink: 0,
              display: 'inline-block',
              animation: active ? 'spin 1s linear infinite' : 'none',
            }}>
              {done ? '✓' : active ? '⟳' : '○'}
            </span>
            <span style={{ fontWeight: active ? '600' : '400' }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

function UploadCard() {
  const { t } = useTheme();
  const inputRef   = useRef(null);
  const mountedRef = useRef(true);

  const [storageMode, setStorageMode] = useState('auto');
  const [storageTier, setStorageTier] = useState('AUTO');

  // phase: idle | confirm | uploading | processing | done | error
  const [phase,     setPhase]     = useState('idle');
  const [pending,   setPending]   = useState(null);   // { file, prefix, dest }
  const [uploadPct, setUploadPct] = useState(0);
  const [stageIdx,  setStageIdx]  = useState(0);
  const [errMsg,    setErrMsg]    = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Advance processing stages automatically while in processing phase
  useEffect(() => {
    if (phase !== 'processing' || !pending) return;
    const stages = PROC_STAGES[pending.dest] || ['Upload file'];
    if (stageIdx >= stages.length - 1) return; // already at last stage

    const delay = stageIdx === 0 ? 1000 : 3500;
    const timer = setTimeout(() => {
      if (mountedRef.current) setStageIdx(prev => prev + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, pending, stageIdx]);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const prefix = storageMode === 'raw' ? 'misc/' : getPrefix(file.name);
    setPending({ file, prefix, dest: DEST_LABEL[prefix] });
    setPhase('confirm');
    e.target.value = '';
  }

  function handleCancel() {
    setPending(null);
    setPhase('idle');
  }

  async function handleConfirm() {
    const { file, prefix, dest } = pending;
    setPhase('uploading');
    setUploadPct(0);
    try {
      const session  = await fetchAuthSession();
      const ownerSub = session.tokens.idToken.payload.sub;

      const task = uploadData({
        path: prefix + file.name,
        data: file,
        options: {
          metadata: { 'storage-tier': storageTier, 'owner-sub': ownerSub },
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes && mountedRef.current)
              setUploadPct(Math.round((transferredBytes / totalBytes) * 100));
          },
        },
      });

      await task.result; // must await .result — uploadData returns a task object, not a Promise

      const stages = PROC_STAGES[dest] || ['Upload file'];
      setStageIdx(0);
      setPhase(stages.length > 1 ? 'processing' : 'done');
    } catch (err) {
      if (mountedRef.current) {
        setErrMsg(err.message || 'Upload failed');
        setPhase('error');
      }
    }
  }

  function reset() {
    setPending(null);
    setPhase('idle');
    setUploadPct(0);
    setStageIdx(0);
    setErrMsg('');
  }

  const cardBase = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: '16px',
    padding: '32px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    marginBottom: '48px',
  };
  const btnPrimary = {
    padding: '10px 24px', borderRadius: '8px', border: 'none',
    background: t.accent, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  };
  const btnSecondary = {
    padding: '10px 24px', borderRadius: '8px', border: `1px solid ${t.border}`,
    background: 'transparent', color: t.text, fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  };

  // ─── Confirm ─────────────────────────────────────────────────────────────────
  if (phase === 'confirm') {
    const { file, dest } = pending;
    return (
      <div style={cardBase}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>📤</div>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: t.text }}>
          Upload this file?
        </h2>
        <div style={{
          background: t.bg2, borderRadius: '10px', padding: '14px 16px',
          marginBottom: '20px', textAlign: 'left',
        }}>
          <div style={{ fontWeight: '600', color: t.text, marginBottom: '6px', wordBreak: 'break-all' }}>
            {file.name}
          </div>
          <div style={{ fontSize: '13px', color: t.muted, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>{fmtBytes(file.size)}</span>
            <span>Destination: {dest}</span>
            <span>Tier: {storageTier === 'AUTO' ? 'Auto' : storageTier}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={handleCancel} style={btnSecondary}>Cancel</button>
          <button onClick={handleConfirm} style={btnPrimary}>Upload →</button>
        </div>
      </div>
    );
  }

  // ─── Uploading ───────────────────────────────────────────────────────────────
  if (phase === 'uploading') {
    const { file, dest } = pending;
    return (
      <div style={cardBase}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>⬆</div>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: t.text }}>
          Uploading to {dest}…
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.muted, wordBreak: 'break-all' }}>
          {file.name}
        </p>
        <div style={{
          width: '100%', height: '8px', background: t.border,
          borderRadius: '999px', overflow: 'hidden', marginBottom: '8px',
        }}>
          <div style={{
            height: '100%', width: `${uploadPct}%`, background: t.accent,
            borderRadius: '999px', transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: '13px', color: t.muted }}>{uploadPct}%</div>
      </div>
    );
  }

  // ─── Processing ──────────────────────────────────────────────────────────────
  if (phase === 'processing') {
    const { dest } = pending;
    const stages       = PROC_STAGES[dest] || ['Upload file'];
    const isLastStage  = stageIdx === stages.length - 1;
    return (
      <div style={cardBase}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚙️</div>
        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '700', color: t.text }}>
          Processing…
        </h2>
        <div style={{ marginBottom: '20px' }}>
          <StageList stages={stages} activeIdx={stageIdx} />
        </div>
        {isLastStage && (
          <p style={{ fontSize: '12px', color: t.muted, margin: '0 0 16px' }}>
            Processing continues in the background. You can safely close this page.
          </p>
        )}
        <button onClick={reset} style={btnPrimary}>Done</button>
      </div>
    );
  }

  // ─── Done ────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div style={cardBase}>
        <div style={{ fontSize: '32px', marginBottom: '10px', color: '#10b981' }}>✓</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
          Upload complete
        </h2>
        <p style={{ margin: '0 0 20px', color: t.muted, fontSize: '14px', wordBreak: 'break-all' }}>
          {pending.file.name} → {pending.dest}
        </p>
        <button onClick={reset} style={btnPrimary}>Upload another</button>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={cardBase}>
        <div style={{ fontSize: '32px', marginBottom: '10px', color: '#ef4444' }}>✗</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>
          Upload failed
        </h2>
        <p style={{ margin: '0 0 20px', color: t.muted, fontSize: '14px' }}>{errMsg}</p>
        <button onClick={reset} style={btnPrimary}>Try again</button>
      </div>
    );
  }

  // ─── Idle ────────────────────────────────────────────────────────────────────
  return (
    <div style={cardBase}>
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>⬆</div>
      <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '700', color: t.text }}>
        Upload a file
      </h2>

      <div style={{
        background: t.bg2, borderRadius: '10px',
        padding: '16px', marginBottom: '20px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: t.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: t.subtle }}>
              File will be stored as-is in Other Files, with no thumbnail or indexing.
            </p>
          )}
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: t.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Storage tier
          </p>
          <PillGroup
            options={TIERS}
            value={storageTier}
            onChange={setStorageTier}
          />
          {storageTier !== 'AUTO' && storageMode !== 'raw' && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: t.subtle }}>
              Applied to the original file. Thumbnails always use Standard.
            </p>
          )}
          {storageTier !== 'AUTO' && storageMode === 'raw' && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#f59e0b' }}>
              Tier selection only applies to processed files (photos & videos).
            </p>
          )}
        </div>
      </div>

      <label style={{
        display: 'inline-block',
        background: t.accent, color: '#fff',
        padding: '10px 24px', borderRadius: '8px',
        fontWeight: '600', fontSize: '14px', cursor: 'pointer',
      }}>
        Choose file
        <input ref={inputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} />
      </label>
    </div>
  );
}

const SECTIONS = [
  {
    to: '/library/photos',
    emoji: '📷',
    label: 'Photos',
    description: 'Browse your photo collection with thumbnails and one-click downloads.',
    headerBg: { light: '#eff6ff', dark: '#1e2a4a' },
    accent: '#3b82f6',
  },
  {
    to: '/library/videos',
    emoji: '🎬',
    label: 'Videos',
    description: 'Browse your videos grouped by date, with thumbnails and duration.',
    headerBg: { light: '#fff7ed', dark: '#2d1800' },
    accent: '#f97316',
  },
  {
    to: '/library/whatsapp',
    emoji: '💬',
    label: 'WhatsApp',
    description: 'Search and filter your exported WhatsApp conversations by sender or date.',
    headerBg: { light: '#f0fdf4', dark: '#052e16' },
    accent: '#22c55e',
  },
  {
    to: '/library/files',
    emoji: '📁',
    label: 'Other Files',
    description: 'Miscellaneous files, ZIP archives, and anything else you have uploaded.',
    headerBg: { light: '#faf5ff', dark: '#1a0a3d' },
    accent: '#a855f7',
  },
];

function DemoBanner() {
  const { t } = useTheme();
  return (
    <div style={{
      background: t.demoBannerBg,
      border: `1px solid ${t.demoBannerBorder}`,
      borderRadius: '10px',
      padding: '12px 20px',
      marginBottom: '32px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <span style={{ fontSize: '18px' }}>👁</span>
      <div>
        <span style={{ fontWeight: '700', color: t.demoBannerHeading, fontSize: '14px' }}>
          Demo mode — read only.
        </span>
        <span style={{ color: t.demoBannerBody, fontSize: '14px', marginLeft: '6px' }}>
          You can browse all content but uploads are disabled for this account.
        </span>
      </div>
    </div>
  );
}

function LibraryPage({ isDemo = false }) {
  const { dark, t } = useTheme();
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: '800', color: t.text }}>
        Your Library
      </h1>
      <p style={{ margin: '0 0 40px', color: t.muted, fontSize: '16px' }}>
        Everything you have uploaded, organised by type.
      </p>

      {isDemo && <DemoBanner />}
      {!isDemo && <UploadCard />}

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
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              overflow: 'hidden',
              color: 'inherit',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              background: headerBg[dark ? 'dark' : 'light'],
              padding: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px',
            }}>
              {emoji}
            </div>
            <div style={{ padding: '20px 22px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: t.text }}>
                {label}
              </h2>
              <p style={{ margin: '0 0 16px', color: t.muted, fontSize: '14px', lineHeight: '1.55' }}>
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

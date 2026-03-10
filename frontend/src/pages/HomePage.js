import { Link } from 'react-router-dom';

const FEATURES = [
  {
    emoji: '📷',
    title: 'Photos',
    description: 'Auto-processed with thumbnails, stored privately in S3. Browse by date with one-click downloads.',
    bg: '#eff6ff',
    accent: '#3b82f6',
  },
  {
    emoji: '🎬',
    title: 'Videos',
    description: 'Uploaded videos are processed by Lambda, generating thumbnails and extracting metadata for browsing.',
    bg: '#fff7ed',
    accent: '#f97316',
  },
  {
    emoji: '💬',
    title: 'WhatsApp',
    description: 'Export your chats as .txt and upload them here. Search by sender, filter by date.',
    bg: '#f0fdf4',
    accent: '#22c55e',
  },
  {
    emoji: '📁',
    title: 'Other Files',
    description: 'Store any file with configurable S3 storage tiers — Standard, Standard-IA, or Glacier.',
    bg: '#faf5ff',
    accent: '#a855f7',
  },
];

const STACK = [
  { label: 'React', color: '#61dafb', bg: '#0a1929' },
  { label: 'AWS Lambda', color: '#ff9900', bg: '#1a1200' },
  { label: 'DynamoDB', color: '#4db6ac', bg: '#011f1f' },
  { label: 'API Gateway', color: '#e040fb', bg: '#1a001f' },
  { label: 'S3', color: '#69f0ae', bg: '#001a0e' },
  { label: 'Cognito', color: '#f48fb1', bg: '#1a0009' },
  { label: 'Terraform', color: '#7c4dff', bg: '#0d0020' },
];

const ARCH_STEPS = [
  { icon: '🖥', label: 'React SPA', sub: 'hosted on S3 + CloudFront' },
  { icon: '→', label: '', sub: '' },
  { icon: '🔒', label: 'Cognito', sub: 'auth & identity' },
  { icon: '→', label: '', sub: '' },
  { icon: '⚡', label: 'API Gateway + Lambda', sub: 'REST API' },
  { icon: '→', label: '', sub: '' },
  { icon: '🗄', label: 'DynamoDB + S3', sub: 'metadata & files' },
];

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-block',
      background: bg,
      color,
      border: `1px solid ${color}33`,
      borderRadius: '6px',
      padding: '4px 12px',
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  );
}

export default function HomePage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #312e81 60%, #0f172a 100%)',
        color: '#f8fafc',
        padding: '96px 24px 120px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '24px' }}>☁</div>
        <h1 style={{ margin: '0 0 16px', fontSize: '48px', fontWeight: '800', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          Your Personal Cloud
        </h1>
        <p style={{
          margin: '0 auto 16px', fontSize: '18px', color: '#a5b4fc',
          maxWidth: '520px', lineHeight: '1.65',
        }}>
          A self-hosted media archive built on AWS. Photos, videos, WhatsApp exports,
          and files — stored privately in S3, browsable from anywhere.
        </p>
        <p style={{ margin: '0 auto 48px', fontSize: '14px', color: '#6366f1', maxWidth: '520px' }}>
          Portfolio project by Artur Reis · Infrastructure as Code with Terraform
        </p>
        <Link to="/library" style={{
          display: 'inline-block',
          background: '#6366f1', color: '#fff',
          padding: '14px 36px', borderRadius: '10px',
          fontWeight: '700', fontSize: '16px',
          textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
        }}>
          Sign in to your storage →
        </Link>
      </div>

      {/* Features */}
      <div style={{ background: '#f8fafc', padding: '80px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>
            What it stores
          </h2>
          <p style={{ textAlign: 'center', margin: '0 auto 56px', color: '#64748b', fontSize: '16px', maxWidth: '480px' }}>
            Upload any file. Lambdas take care of the rest — thumbnails, metadata, categorisation.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
          }}>
            {FEATURES.map(({ emoji, title, description, bg, accent }) => (
              <div key={title} style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                overflow: 'hidden',
              }}>
                <div style={{ background: bg, padding: '28px', fontSize: '40px', textAlign: 'center' }}>
                  {emoji}
                </div>
                <div style={{ padding: '20px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                    {title}
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
                    {description}
                  </p>
                  <div style={{ marginTop: '12px', width: '32px', height: '3px', background: accent, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture */}
      <div style={{ background: '#0f172a', padding: '80px 24px', color: '#f8fafc' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '32px', fontWeight: '800' }}>
            How it works
          </h2>
          <p style={{ textAlign: 'center', margin: '0 auto 56px', color: '#94a3b8', fontSize: '16px', maxWidth: '480px' }}>
            A fully serverless stack — no servers to manage, scales to zero when idle.
          </p>

          {/* Flow diagram */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexWrap: 'wrap', gap: '8px', marginBottom: '56px',
          }}>
            {ARCH_STEPS.map((step, i) =>
              step.label === '' ? (
                <span key={i} style={{ color: '#334155', fontSize: '20px' }}>→</span>
              ) : (
                <div key={i} style={{
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '10px', padding: '14px 20px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '26px', marginBottom: '4px' }}>{step.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{step.label}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{step.sub}</div>
                </div>
              )
            )}
          </div>

          {/* Architecture bullets */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px', marginBottom: '56px',
          }}>
            {[
              { icon: '📤', heading: 'Upload', body: 'Files land in S3. An S3 event triggers the appropriate Lambda processor based on key prefix.' },
              { icon: '⚙️', heading: 'Process', body: 'Lambdas generate thumbnails, extract metadata, and write records to DynamoDB.' },
              { icon: '🔍', heading: 'Browse', body: 'The React SPA queries API Gateway to list, search, and download files via pre-signed S3 URLs.' },
            ].map(({ icon, heading, body }) => (
              <div key={heading} style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '12px', padding: '24px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>
                  {heading}
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                  {body}
                </p>
              </div>
            ))}
          </div>

          {/* Tech stack badges */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#475569', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Tech stack
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {STACK.map(b => <Badge key={b.label} {...b} />)}
            </div>
          </div>
        </div>
      </div>

      {/* CTA footer */}
      <div style={{
        background: 'linear-gradient(135deg, #312e81 0%, #0f172a 100%)',
        padding: '72px 24px',
        textAlign: 'center',
        color: '#f8fafc',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '30px', fontWeight: '800' }}>
          Ready to explore?
        </h2>
        <p style={{ margin: '0 auto 36px', color: '#a5b4fc', fontSize: '16px', maxWidth: '400px' }}>
          Sign in with your account to access your personal library.
        </p>
        <Link to="/library" style={{
          display: 'inline-block',
          background: '#6366f1', color: '#fff',
          padding: '13px 32px', borderRadius: '10px',
          fontWeight: '600', fontSize: '16px',
          textDecoration: 'none',
          boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
        }}>
          Sign in to your storage →
        </Link>
      </div>

    </div>
  );
}

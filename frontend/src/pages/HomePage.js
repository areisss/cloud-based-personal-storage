import { Link } from 'react-router-dom';

const FEATURES = [
  {
    emoji: '📷',
    title: 'Photos',
    description: 'Auto-processed with thumbnails, stored privately in S3. Browse by date with one-click downloads. Configurable storage class per upload.',
    bg: '#eff6ff',
    accent: '#3b82f6',
  },
  {
    emoji: '🎬',
    title: 'Videos',
    description: 'Lambda + FFmpeg extract metadata and generate thumbnails on upload. Browse grouped by date with duration and resolution info.',
    bg: '#fff7ed',
    accent: '#f97316',
  },
  {
    emoji: '💬',
    title: 'WhatsApp',
    description: 'Export your chats as .txt and upload. A three-tier data pipeline (Bronze → Silver → Gold) converts them to Parquet and makes them queryable via Athena.',
    bg: '#f0fdf4',
    accent: '#22c55e',
  },
  {
    emoji: '📁',
    title: 'Other Files',
    description: 'Store any file with configurable S3 storage tiers — Standard, Standard-IA, or Glacier IR for long-term archiving.',
    bg: '#faf5ff',
    accent: '#a855f7',
  },
];

const STACK = [
  { label: 'React',        color: '#61dafb', bg: '#0a1929' },
  { label: 'AWS Lambda',   color: '#ff9900', bg: '#1a1200' },
  { label: 'DynamoDB',     color: '#4db6ac', bg: '#011f1f' },
  { label: 'API Gateway',  color: '#e040fb', bg: '#1a001f' },
  { label: 'S3',           color: '#69f0ae', bg: '#001a0e' },
  { label: 'Cognito',      color: '#f48fb1', bg: '#1a0009' },
  { label: 'AWS Glue',     color: '#ff9900', bg: '#1a0a00' },
  { label: 'Athena',       color: '#29b6f6', bg: '#001829' },
  { label: 'Parquet',      color: '#aed581', bg: '#0d1a00' },
  { label: 'Terraform',    color: '#7c4dff', bg: '#0d0020' },
  { label: 'FFmpeg',       color: '#f06292', bg: '#1a000d' },
  { label: 'Python',       color: '#ffee58', bg: '#1a1600' },
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

function ArchNode({ icon, label, sub, accent = '#6366f1' }) {
  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${accent}55`,
      borderRadius: '10px',
      padding: '14px 18px',
      textAlign: 'center',
      minWidth: '110px',
    }}>
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0', lineHeight: 1.3 }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function Arrow() {
  return <span style={{ color: '#475569', fontSize: '18px', flexShrink: 0 }}>→</span>;
}

export default function HomePage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Hero ── */}
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
          maxWidth: '560px', lineHeight: '1.65',
        }}>
          A self-hosted media archive built on AWS. Photos, videos, WhatsApp exports,
          and files — stored privately in S3, processed serverlessly, browsable from anywhere.
        </p>
        <p style={{ margin: '0 auto 48px', fontSize: '14px', color: '#6366f1', maxWidth: '560px' }}>
          Portfolio project by Artur Reis · Fully Infrastructure-as-Code with Terraform
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

      {/* ── Features ── */}
      <div style={{ background: '#f8fafc', padding: '80px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>
            What it stores
          </h2>
          <p style={{ textAlign: 'center', margin: '0 auto 56px', color: '#64748b', fontSize: '16px', maxWidth: '520px' }}>
            Upload any file. Lambda processors take care of the rest.
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

      {/* ── Data Pipeline (Glue / Athena) ── */}
      <div style={{ background: '#fff', padding: '80px 24px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', justifyContent: 'center' }}>
            <span style={{
              background: '#f0fdf4', color: '#22c55e',
              border: '1px solid #bbf7d0', borderRadius: '6px',
              padding: '3px 10px', fontSize: '12px', fontWeight: '700',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Data Engineering
            </span>
          </div>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>
            WhatsApp data pipeline
          </h2>
          <p style={{ textAlign: 'center', margin: '0 auto 56px', color: '#64748b', fontSize: '16px', maxWidth: '560px' }}>
            A serverless lakehouse pipeline transforms raw chat exports into
            structured, queryable data using a classic Bronze → Silver → Gold pattern.
          </p>

          {/* Pipeline tiers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1px',
            background: '#e2e8f0',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '48px',
          }}>
            {[
              {
                tier: 'Bronze',
                color: '#cd7c2f',
                bg: '#fff7ed',
                icon: '📥',
                heading: 'Raw ingestion',
                steps: [
                  'User uploads WhatsApp .txt export',
                  'S3 event triggers Lambda',
                  'Lambda validates format & partitions by year/month',
                  'Stored as-is at bronze/whatsapp/year=…/month=…/',
                ],
              },
              {
                tier: 'Silver',
                color: '#64748b',
                bg: '#f8fafc',
                icon: '⚙️',
                heading: 'ETL with AWS Glue',
                steps: [
                  'Glue Python Shell job reads bronze TXT files',
                  'Regex parser extracts date, time, sender, message, word_count',
                  'AWS Wrangler writes partitioned Parquet (Snappy) to silver/',
                  'Glue catalog table registered for Athena',
                ],
              },
              {
                tier: 'Gold',
                color: '#b59f3b',
                bg: '#fefce8',
                icon: '🔍',
                heading: 'Analytics via Athena',
                steps: [
                  'WhatsApp API Lambda runs parameterised SQL on Athena workgroup',
                  'Supports filters: date, sender LIKE, message LIKE, limit',
                  'Partition pruning keeps scanned data minimal',
                  'Results returned as JSON to React frontend',
                ],
              },
            ].map(({ tier, color, bg, icon, heading, steps }) => (
              <div key={tier} style={{ background: bg, padding: '28px 28px 32px' }}>
                <div style={{
                  display: 'inline-block',
                  background: color + '22',
                  color,
                  border: `1px solid ${color}44`,
                  borderRadius: '6px',
                  padding: '2px 10px',
                  fontSize: '12px', fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '12px',
                }}>
                  {tier}
                </div>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
                <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  {heading}
                </h3>
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  {steps.map((s, i) => (
                    <li key={i} style={{ color: '#475569', fontSize: '13px', lineHeight: '1.7', marginBottom: '2px' }}>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* Glue + Athena callout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {[
              {
                icon: '🔧',
                title: 'AWS Glue Python Shell',
                body: 'Minimum DPU (0.0625) keeps job costs near zero. AWS Wrangler handles the Parquet writes and schema inference. Glue Data Catalog registers the table so Athena can query it without any manual DDL.',
                accent: '#ff9900',
              },
              {
                icon: '📊',
                title: 'Amazon Athena',
                body: 'Serverless SQL over S3. Parquet + Snappy compression + Hive-style date partitions (date=YYYY-MM-DD) minimise scanned data per query. An isolated Athena workgroup keeps result storage and costs separate.',
                accent: '#29b6f6',
              },
            ].map(({ icon, title, body, accent }) => (
              <div key={title} style={{
                background: '#f8fafc',
                border: `1px solid ${accent}33`,
                borderRadius: '12px',
                padding: '24px',
                borderLeft: `4px solid ${accent}`,
              }}>
                <div style={{ fontSize: '26px', marginBottom: '10px' }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  {title}
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.65' }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Architecture ── */}
      <div style={{ background: '#0f172a', padding: '80px 24px', color: '#f8fafc' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '32px', fontWeight: '800' }}>
            Full-stack architecture
          </h2>
          <p style={{ textAlign: 'center', margin: '0 auto 56px', color: '#94a3b8', fontSize: '16px', maxWidth: '480px' }}>
            100% serverless. No EC2, no RDS, no idle costs.
          </p>

          {/* Upload flow */}
          <p style={{ color: '#475569', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            Upload flow
          </p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
            <ArchNode icon="🖥" label="React SPA" sub="S3 + CloudFront" accent="#6366f1" />
            <Arrow />
            <ArchNode icon="🔒" label="Cognito" sub="Auth + JWT" accent="#f48fb1" />
            <Arrow />
            <ArchNode icon="⚡" label="API Gateway" sub="REST + Cognito auth" accent="#e040fb" />
            <Arrow />
            <ArchNode icon="λ" label="Lambda" sub="Python 3.12" accent="#ff9900" />
            <Arrow />
            <ArchNode icon="🗄" label="DynamoDB" sub="metadata" accent="#4db6ac" />
            <Arrow />
            <ArchNode icon="🪣" label="S3" sub="presigned URLs" accent="#69f0ae" />
          </div>

          {/* WhatsApp / data flow */}
          <p style={{ color: '#475569', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            WhatsApp data pipeline
          </p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '56px' }}>
            <ArchNode icon="📤" label="S3 raw upload" sub=".txt export" accent="#22c55e" />
            <Arrow />
            <ArchNode icon="λ" label="Bronze Lambda" sub="partition by date" accent="#cd7c2f" />
            <Arrow />
            <ArchNode icon="🔧" label="AWS Glue" sub="Python Shell ETL" accent="#ff9900" />
            <Arrow />
            <ArchNode icon="📦" label="S3 Parquet" sub="silver layer" accent="#64748b" />
            <Arrow />
            <ArchNode icon="📊" label="Athena" sub="serverless SQL" accent="#29b6f6" />
            <Arrow />
            <ArchNode icon="λ" label="WhatsApp API" sub="filtered JSON" accent="#22c55e" />
          </div>

          {/* How it's deployed */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '56px',
          }}>
            {[
              {
                icon: '🏗',
                heading: 'Infrastructure as Code',
                body: 'Every resource — Lambda, API Gateway, DynamoDB, Glue, Athena, S3, IAM — is defined in Terraform. A single terraform apply stands the whole stack up from scratch.',
              },
              {
                icon: '📸',
                heading: 'Media Processing',
                body: 'Photo Lambda uses Pillow for thumbnails. Video Lambda bundles FFmpeg/ffprobe binaries and runs them in the Lambda execution environment.',
              },
              {
                icon: '🔐',
                heading: 'Security',
                body: 'All API routes require a valid Cognito JWT. S3 access is via short-lived presigned URLs. The data bucket has no public access; the frontend is a separate static site.',
              },
            ].map(({ icon, heading, body }) => (
              <div key={heading} style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '12px', padding: '24px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
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

      {/* ── Try the demo ── */}
      <div style={{ background: '#f8fafc', padding: '80px 24px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: '800', color: '#0f172a' }}>
            Try it yourself
          </h2>
          <p style={{ margin: '0 auto 36px', color: '#64748b', fontSize: '16px', maxWidth: '420px' }}>
            A read-only demo account lets you browse the app without creating your own account.
          </p>

          <div style={{
            background: '#0f172a',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'left',
            marginBottom: '28px',
          }}>
            <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Demo credentials
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Username', value: 'demo@example.com' },
                { label: 'Password', value: 'Demo2024!' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>{label}</span>
                  <code style={{
                    background: '#1e293b',
                    color: '#a5b4fc',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    letterSpacing: '0.04em',
                  }}>
                    {value}
                  </code>
                </div>
              ))}
            </div>
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>👁</span>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.55' }}>
                The demo account is <strong style={{ color: '#cbd5e1' }}>read-only</strong> — you can browse photos, videos, and WhatsApp chats but uploads are disabled. API calls are rate-limited to 10 req/s.
              </p>
            </div>
          </div>

          <Link to="/library" style={{
            display: 'inline-block',
            background: '#6366f1', color: '#fff',
            padding: '13px 32px', borderRadius: '10px',
            fontWeight: '600', fontSize: '15px',
            textDecoration: 'none',
            boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
          }}>
            Sign in with demo credentials →
          </Link>
        </div>
      </div>

      {/* ── CTA ── */}
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

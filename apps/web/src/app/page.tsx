import Link from 'next/link';

export default function Home() {
  return (
    <div className="auth-page">
      <div
        className="auth-card"
        style={{ textAlign: 'center' }}
      >
        <h1>Moni</h1>
        <p className="auth-subtitle">
          Privacy-focused personal finance management
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            marginTop: '1.5rem',
          }}
        >
          <Link
            href="/login"
            className="btn btn-primary"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="btn btn-secondary"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

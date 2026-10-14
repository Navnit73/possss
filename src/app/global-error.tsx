"use client";

// Catches errors thrown by the root layout itself, where app/error.tsx can't render. Must provide its own <html>/<body>.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#475569", marginBottom: 16 }}>The app failed to load. Please reload the page.</p>
          {error.digest && <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Reference: {error.digest}</p>}
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", cursor: "pointer" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

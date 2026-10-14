"use client";

// global-error replaces the root layout and does not inherit its global styles, so it pulls in the token sheet itself.
import "./globals.css";

// Catches errors thrown by the root layout itself, where app/error.tsx can't render. Must provide its own <html>/<body>.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body className="min-h-screen m-0 flex items-center justify-center bg-canvas text-ink font-sans antialiased px-4 sm:px-6 py-20">
        <div role="alert" className="max-w-[640px] w-full text-center">
          <h1 className="text-display-lg text-ink mb-4">Something went wrong</h1>
          <p className="text-body text-ink-48 mb-8">The app failed to load. Please reload the page.</p>
          {error.digest && <p className="text-fine-print text-ink-48 mb-8">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="press inline-flex items-center justify-center min-h-11 px-5.5 py-2.75 rounded-full bg-primary text-on-dark text-body cursor-pointer"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

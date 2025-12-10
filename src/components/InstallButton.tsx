import React, { useEffect, useState } from 'react';

type Props = {
  onInstalled?: () => void; // optional callback after install success
  className?: string;
};

export default function InstallButton({ onInstalled, className }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  // detect iOS Safari (or iOS webview where beforeinstallprompt won't fire)
  const isIos = typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !('standalone' in window.navigator && (window.navigator as any).standalone);

  useEffect(() => {
    const handler = (e: Event) => {
      // Save the event for later and show install UI
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // If iOS — show the hint button (no automatic prompt)
    if (isIos) {
      // We still show a small hint button rather than nothing
      setShowIOSHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, [isIos]);

  // Called when user clicks our Install button
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        // @ts-ignore - beforeinstallprompt type
        deferredPrompt.prompt();
        // @ts-ignore
        const result = await deferredPrompt.userChoice;
        // result.outcome === 'accepted' | 'dismissed'
        if (result && result.outcome === 'accepted') {
          setVisible(false);
          setDeferredPrompt(null);
          if (onInstalled) onInstalled();
        } else {
          // user dismissed - keep button visible for a while (or hide)
          setVisible(false);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Install prompt failed', err);
        setVisible(false);
        setDeferredPrompt(null);
      }
      return;
    }

    // iOS or no beforeinstallprompt — show tiny help overlay
    if (isIos) {
      setShowIOSHint(true);
      // optionally keep it visible briefly
      return;
    }

    // fallback for browsers that don't support beforeinstallprompt
    alert('This browser does not support automatic install prompts. Use the browser menu to "Add to Home screen".');
  };

  if (!visible && !showIOSHint) return null;

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} className={className}>
        {visible && (
          <button
            onClick={handleInstallClick}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
            }}
            aria-label="Install app"
          >
            Install
          </button>
        )}

        {showIOSHint && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowIOSHint(prev => !prev)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(0,0,0,0.06)',
                color: 'var(--text-primary)',
                fontWeight: 700,
              }}
              aria-label="Install instructions for iOS"
            >
              Add to Home
            </button>

            {/* Simple instruction overlay */}
            {showIOSHint && (
              <div
                role="dialog"
                aria-modal="false"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 260,
                  zIndex: 1200,
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--bg-surface)',
                  boxShadow: '0 8px 24px rgba(2,8,20,0.12)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Install on iPhone</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Open the browser menu (Share icon) → tap <strong>“Add to Home Screen”</strong>. The app will appear on your home screen.
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowIOSHint(false)} style={{ padding: '6px 8px', borderRadius: 8, background: 'transparent', border: '1px solid #eee' }}>Got it</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

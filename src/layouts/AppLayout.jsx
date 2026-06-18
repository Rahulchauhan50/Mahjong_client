import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { useResolutionScale } from '../hooks/useResolutionScale.js';

const routeBackgrounds = {
  [ROUTES.start]: '/assets/start-screen/bg.png',
  [ROUTES.login]: '/assets/mock-login/BG.png',
  [ROUTES.loading]: '/assets/loading-screen/BG.png',
  [ROUTES.mainMenu]: '/assets/main-menu/bg.png',
  [ROUTES.shop]: '/assets/shop/552134.png',
  [ROUTES.profile]: '/assets/profile/BG.png',
  [ROUTES.matchmaking]: '/assets/matchmaking/BG.png',
  [ROUTES.game]: '/assets/gameplay/BG.png',
  [ROUTES.result]: '/assets/win-screen/BG.png',
};

function getBackgroundForPath(pathname) {
  if (pathname.startsWith('/game/')) {
    return routeBackgrounds[ROUTES.game];
  }

  return routeBackgrounds[pathname] || routeBackgrounds[ROUTES.mainMenu];
}

function isPortraitViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia?.('(orientation: portrait)').matches ?? window.innerHeight > window.innerWidth;
}

async function tryLockLandscape() {
  if (typeof window === 'undefined') {
    return;
  }

  const isMobileDevice = document.documentElement.dataset.device === 'mobile';

  if (!isMobileDevice || !isPortraitViewport()) {
    return;
  }

  try {
    await window.screen?.orientation?.lock?.('landscape');
  } catch {
    // Browser support is inconsistent, especially on iOS/Safari.
    // The rotate overlay remains the primary fallback.
  }
}


function setKeyboardOpenState(isOpen) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('keyboard-open', isOpen);
  document.body?.classList.toggle('keyboard-open', isOpen);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

function shouldUseKeyboardMode() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const isMobileDevice = document.documentElement.dataset.device === 'mobile';
  const isLandscape = window.matchMedia?.('(orientation: landscape)').matches ?? window.innerWidth > window.innerHeight;

  return isMobileDevice && isLandscape && isEditableTarget(document.activeElement);
}

export default function AppLayout() {
  const location = useLocation();
  const { scale, width, height, device } = useResolutionScale();
  const backgroundImage = getBackgroundForPath(location.pathname);

  useEffect(() => {
    const updateKeyboardMode = () => {
      window.requestAnimationFrame(() => {
        setKeyboardOpenState(shouldUseKeyboardMode());
      });
    };

    window.addEventListener('pointerdown', tryLockLandscape, { passive: true });
    window.addEventListener('focusin', updateKeyboardMode);
    window.addEventListener('focusout', updateKeyboardMode);
    window.addEventListener('resize', updateKeyboardMode);
    window.visualViewport?.addEventListener('resize', updateKeyboardMode);

    updateKeyboardMode();

    return () => {
      window.removeEventListener('pointerdown', tryLockLandscape);
      window.removeEventListener('focusin', updateKeyboardMode);
      window.removeEventListener('focusout', updateKeyboardMode);
      window.removeEventListener('resize', updateKeyboardMode);
      window.visualViewport?.removeEventListener('resize', updateKeyboardMode);
      setKeyboardOpenState(false);
    };
  }, []);

  return (
    <main
      className="app-shell fixed-resolution-shell"
      data-device={device}
      style={{
        '--frame-scale': scale,
        '--design-width': `${width}px`,
        '--design-height': `${height}px`,
        '--scaled-width': `${width * scale}px`,
        '--scaled-height': `${height * scale}px`,
      }}
    >
      <div
        className="app-background"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden="true"
      />
      <section className="rotate-device-overlay" aria-live="polite" aria-label="Rotate device message">
        <div className="rotate-device-card">
          <div className="rotate-device-icon" aria-hidden="true">
            <span className="rotate-device-phone" />
            <span className="rotate-device-arrow">↻</span>
          </div>
          <h1 className="rotate-device-title">Rotate your device</h1>
          <p className="rotate-device-copy">This game is designed for landscape mode.</p>
        </div>
      </section>
      <div className="game-frame">
        <div className="game-stage">
          <Outlet />
        </div>
      </div>
    </main>
  );
}

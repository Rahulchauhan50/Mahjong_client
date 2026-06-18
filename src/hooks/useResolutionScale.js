import { useEffect, useState } from 'react';

export const DESIGN_RESOLUTION = {
  width: 1280,
  height: 720,
};

function getViewportSize() {
  if (typeof window === 'undefined') {
    return DESIGN_RESOLUTION;
  }

  // Use the layout viewport, not visualViewport.
  // visualViewport shrinks when the mobile keyboard opens, which makes the
  // 1280x720 game frame recalculate its scale and collapse upward.
  return {
    width: window.innerWidth || DESIGN_RESOLUTION.width,
    height: window.innerHeight || DESIGN_RESOLUTION.height,
  };
}

function getDeviceMode(viewport = getViewportSize()) {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const smallLandscape = viewport.width <= 980 || viewport.height <= 540;

  return coarsePointer || smallLandscape ? 'mobile' : 'desktop';
}

function calculateScale() {
  const viewport = getViewportSize();
  const widthRatio = viewport.width / DESIGN_RESOLUTION.width;
  const heightRatio = viewport.height / DESIGN_RESOLUTION.height;

  return Math.min(widthRatio, heightRatio);
}

function getResolutionState() {
  const viewport = getViewportSize();

  return {
    scale: calculateScale(),
    device: getDeviceMode(viewport),
    width: DESIGN_RESOLUTION.width,
    height: DESIGN_RESOLUTION.height,
  };
}

export function useResolutionScale() {
  const [state, setState] = useState(() => getResolutionState());

  useEffect(() => {
    const updateState = () => {
      const nextState = getResolutionState();
      document.documentElement.dataset.device = nextState.device;
      setState(nextState);
    };

    updateState();
    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', updateState);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
    };
  }, []);

  return state;
}

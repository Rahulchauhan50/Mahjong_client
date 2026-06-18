import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

function readCurrentLocation() {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hash: '', state: null };
  }

  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
    state: window.history.state?.usr ?? window.history.state ?? null,
  };
}

const RouterContext = createContext({
  location: { pathname: '/', search: '', hash: '', state: null },
  navigate: () => {},
});

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(readCurrentLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(readCurrentLocation());

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }

    const target = to || '/';
    const method = options.replace ? 'replaceState' : 'pushState';
    const state = options.state ?? null;

    window.history[method]({ usr: state }, '', target);
    setLocation(readCurrentLocation());
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useLocation() {
  return useContext(RouterContext).location;
}

export function useParams() {
  const { pathname } = useLocation();
  const gameMatch = pathname.match(/^\/game\/([^/]+)$/);

  if (gameMatch) {
    return { matchId: decodeURIComponent(gameMatch[1]) };
  }

  return {};
}

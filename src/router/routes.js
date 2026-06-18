export const ROUTES = {
  start: '/',
  login: '/login',
  loading: '/loading',
  mainMenu: '/main-menu',
  shop: '/shop',
  profile: '/profile',
  rooms: '/rooms',
  createRoom: '/create-room',
  joinRoom: '/join-room',
  matchmaking: '/matchmaking',
  game: '/game/:matchId',
  gameFallback: '/game',
  result: '/result',
};

export function buildGameRoute(matchId) {
  const safeMatchId = matchId || 'mock_match_001';
  return `/game/${encodeURIComponent(safeMatchId)}`;
}

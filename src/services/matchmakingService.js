import { deleteFromApi, getFromApi, isMockApiEnabled, postToApi } from './api.js';
import { normalizeMatchmakingSession } from './gameNormalizers.js';

export const MISSING_MATCHMAKING_API_MESSAGE = 'Matchmaking backend is not available yet. Using frontend waiting fallback.';

export function isMatchmakingApiAvailable() {
  // The UI should stay usable while the backend endpoints are being finished.
  // The service will try the real API first, then return a safe frontend fallback.
  return true;
}

function getFallbackPlayers(maxPlayers = 3) {
  const safeMaxPlayers = Math.max(2, Math.min(Number(maxPlayers) || 3, 3));

  return Array.from({ length: safeMaxPlayers }, (_, index) => ({
    id: index === 0 ? 'current_player' : `searching_${index}`,
    name: index === 0 ? 'You' : 'Searching',
    username: index === 0 ? 'You' : 'Searching',
    avatar: index === 0 ? null : 'icon_02_searching.png',
    ready: index === 0,
    isCurrentPlayer: index === 0,
    isSearching: index !== 0,
  }));
}

function createFallbackSession(payload = {}, overrides = {}) {
  return normalizeMatchmakingSession({
    id: payload.sessionId || payload.roomId || 'frontend_matchmaking_fallback',
    sessionId: payload.sessionId || payload.roomId || 'frontend_matchmaking_fallback',
    status: 'searching',
    roomId: payload.roomId || 'quick_match',
    roomCode: payload.roomCode || null,
    tierId: payload.tierId || null,
    maxPlayers: payload.maxPlayers || 3,
    estimatedWaitSeconds: 12,
    players: getFallbackPlayers(payload.maxPlayers || 3),
    backendFallback: true,
    ...overrides,
  });
}

export async function startMatchmaking(payload = {}) {
  if (isMockApiEnabled()) {
    const response = await postToApi('/matchmaking/start', payload, (mockApi) => mockApi.startMatchmaking(payload));
    return normalizeMatchmakingSession(response);
  }

  try {
    const response = await postToApi('/matchmaking/start', payload);
    return normalizeMatchmakingSession(response);
  } catch (error) {
    console.warn('Matchmaking start fallback:', error);
    return createFallbackSession(payload);
  }
}

export async function getMatchmakingStatus(sessionId, payload = {}) {
  if (!sessionId || sessionId === 'frontend_matchmaking_fallback') {
    return createFallbackSession(payload, { id: sessionId || 'frontend_matchmaking_fallback' });
  }

  if (isMockApiEnabled()) {
    const response = await getFromApi(`/matchmaking/${encodeURIComponent(sessionId)}/status`, (mockApi) => mockApi.getMatchmakingStatus(sessionId));
    return normalizeMatchmakingSession(response);
  }

  try {
    const response = await getFromApi(`/matchmaking/${encodeURIComponent(sessionId)}/status`);
    return normalizeMatchmakingSession(response);
  } catch (error) {
    console.warn('Matchmaking status fallback:', error);
    return createFallbackSession({ ...payload, sessionId });
  }
}

export async function cancelMatchmaking(sessionId) {
  if (!sessionId || sessionId === 'frontend_matchmaking_fallback') {
    return { success: true, skipped: true, reason: MISSING_MATCHMAKING_API_MESSAGE };
  }

  if (isMockApiEnabled()) {
    return deleteFromApi(`/matchmaking/${encodeURIComponent(sessionId)}`, (mockApi) => mockApi.cancelMatchmaking(sessionId));
  }

  try {
    return await deleteFromApi(`/matchmaking/${encodeURIComponent(sessionId)}`);
  } catch (error) {
    console.warn('Matchmaking cancel fallback:', error);
    return { success: true, skipped: true, reason: MISSING_MATCHMAKING_API_MESSAGE };
  }
}

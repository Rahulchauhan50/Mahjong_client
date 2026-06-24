import { apiRequest } from './api.js';
import { normalizeMatchmakingSession } from './gameNormalizers.js';

export const MISSING_MATCHMAKING_API_MESSAGE = 'Matchmaking is controlled by the live socket backend. No mock matchmaking data is used.';

export function isMatchmakingApiAvailable() {
  return true;
}

export async function startMatchmaking(payload = {}) {
  const response = await apiRequest('/matchmaking/start', {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
  return normalizeMatchmakingSession(response);
}

export async function getMatchmakingStatus(sessionId) {
  if (!sessionId) {
    throw new Error('getMatchmakingStatus requires a sessionId.');
  }

  const response = await apiRequest(`/matchmaking/${encodeURIComponent(sessionId)}/status`);
  return normalizeMatchmakingSession(response);
}

export async function cancelMatchmaking(sessionId) {
  if (!sessionId) {
    return { success: true, skipped: true, reason: 'No matchmaking session to cancel.' };
  }

  return apiRequest(`/matchmaking/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

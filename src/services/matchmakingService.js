import { deleteFromApi, getFromApi, isMockApiEnabled, postToApi } from './api.js';
import { normalizeMatchmakingSession } from './gameNormalizers.js';

export const MISSING_MATCHMAKING_API_MESSAGE = 'Backend API reference does not include matchmaking endpoints yet. Required: POST /api/matchmaking/start, GET /api/matchmaking/:sessionId/status, DELETE /api/matchmaking/:sessionId.';

export function isMatchmakingApiAvailable() {
  return isMockApiEnabled();
}

export async function startMatchmaking(payload) {
  if (!isMockApiEnabled()) {
    throw new Error(MISSING_MATCHMAKING_API_MESSAGE);
  }

  const response = await postToApi('/matchmaking/start', payload, (mockApi) => mockApi.startMatchmaking(payload));
  return normalizeMatchmakingSession(response);
}

export async function getMatchmakingStatus(sessionId) {
  if (!isMockApiEnabled()) {
    throw new Error(MISSING_MATCHMAKING_API_MESSAGE);
  }

  const response = await getFromApi(`/matchmaking/${encodeURIComponent(sessionId)}/status`, (mockApi) => mockApi.getMatchmakingStatus(sessionId));
  return normalizeMatchmakingSession(response);
}

export function cancelMatchmaking(sessionId) {
  if (!isMockApiEnabled()) {
    return Promise.resolve({ success: false, skipped: true, reason: MISSING_MATCHMAKING_API_MESSAGE });
  }

  return deleteFromApi(`/matchmaking/${encodeURIComponent(sessionId)}`, (mockApi) => mockApi.cancelMatchmaking(sessionId));
}

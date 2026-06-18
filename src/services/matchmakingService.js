import { deleteFromApi, getFromApi, postToApi } from './api.js';
import { normalizeMatchmakingSession } from './gameNormalizers.js';

export async function startMatchmaking(payload) {
  const response = await postToApi('/matchmaking/start', payload, (mockApi) => mockApi.startMatchmaking(payload));
  return normalizeMatchmakingSession(response);
}

export async function getMatchmakingStatus(sessionId) {
  const response = await getFromApi(`/matchmaking/${encodeURIComponent(sessionId)}/status`, (mockApi) => mockApi.getMatchmakingStatus(sessionId));
  return normalizeMatchmakingSession(response);
}

export function cancelMatchmaking(sessionId) {
  return deleteFromApi(`/matchmaking/${encodeURIComponent(sessionId)}`, (mockApi) => mockApi.cancelMatchmaking(sessionId));
}

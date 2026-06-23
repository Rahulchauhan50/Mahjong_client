import { getFromApi, isMockApiEnabled, postToApi } from './api.js';
import { normalizeGameResult, normalizeGameState } from './gameNormalizers.js';

export const MISSING_GAME_API_MESSAGE = 'Gameplay is unavailable right now. Please try again later.';

export function isGameApiAvailable() {
  return isMockApiEnabled();
}

export async function getGameState(matchId) {
  if (!matchId) {
    throw new Error('getGameState requires a matchId.');
  }

  if (!isMockApiEnabled()) {
    throw new Error(MISSING_GAME_API_MESSAGE);
  }

  const response = await getFromApi(`/games/${encodeURIComponent(matchId)}`, (mockApi) => mockApi.getGameState(matchId));
  return normalizeGameState(response);
}

export async function getGameResult(matchId) {
  if (!matchId) {
    throw new Error('getGameResult requires a matchId.');
  }

  if (!isMockApiEnabled()) {
    throw new Error(MISSING_GAME_API_MESSAGE);
  }

  const response = await getFromApi(`/games/${encodeURIComponent(matchId)}/result`, (mockApi) => mockApi.getGameResult(matchId));
  return normalizeGameResult(response);
}

export function sendGameAction(matchId, action) {
  if (!matchId) {
    throw new Error('sendGameAction requires a matchId.');
  }

  if (!isMockApiEnabled()) {
    return Promise.reject(new Error(MISSING_GAME_API_MESSAGE));
  }

  return postToApi(`/games/${encodeURIComponent(matchId)}/actions`, action, (mockApi) => mockApi.sendGameAction(matchId, action));
}

export function leaveGame(matchId) {
  if (!matchId) {
    throw new Error('leaveGame requires a matchId.');
  }

  if (!isMockApiEnabled()) {
    return Promise.resolve({ success: false, skipped: true, reason: MISSING_GAME_API_MESSAGE });
  }

  return postToApi(`/games/${encodeURIComponent(matchId)}/leave`, undefined, (mockApi) => mockApi.leaveGame(matchId));
}

export function finishGame(matchId, payload) {
  if (!matchId) {
    throw new Error('finishGame requires a matchId.');
  }

  if (!isMockApiEnabled()) {
    return Promise.reject(new Error(MISSING_GAME_API_MESSAGE));
  }

  return postToApi(`/games/${encodeURIComponent(matchId)}/finish`, payload, (mockApi) => mockApi.finishGame(matchId, payload));
}

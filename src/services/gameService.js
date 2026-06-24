import { apiRequest } from './api.js';
import { normalizeGameResult, normalizeGameState } from './gameNormalizers.js';
import { getActiveGameSocket } from './socket.js';

export const MISSING_GAME_API_MESSAGE = 'Gameplay is controlled by the live socket backend. No mock gameplay data is used.';

export function isGameApiAvailable() {
  // Gameplay must not use the frontend mock API. The board is driven by Socket.io events:
  // game:start, game:turn_start, player:drawn_tile, game:claim_window,
  // game:action_broadcast, game:sync_state, game:over.
  return false;
}

export async function getGameState(matchId) {
  if (!matchId) {
    throw new Error('getGameState requires a matchId.');
  }

  const response = await apiRequest(`/games/${encodeURIComponent(matchId)}`);
  return normalizeGameState(response);
}

export async function getGameResult(matchId) {
  if (!matchId) {
    throw new Error('getGameResult requires a matchId.');
  }

  const response = await apiRequest(`/games/${encodeURIComponent(matchId)}/result`);
  return normalizeGameResult(response);
}

export function sendGameAction(matchId, action) {
  if (!matchId) {
    throw new Error('sendGameAction requires a matchId.');
  }

  return apiRequest(`/games/${encodeURIComponent(matchId)}/actions`, {
    method: 'POST',
    body: JSON.stringify(action ?? {}),
  });
}

export function leaveGame(matchId) {
  if (!matchId) {
    throw new Error('leaveGame requires a matchId.');
  }

  const socket = getActiveGameSocket();
  if (socket?.connected || socket?.raw?.connected) {
    socket.emit?.('player:leave', { matchId });
    return Promise.resolve({ success: true, socket: true });
  }

  return Promise.resolve({ success: false, skipped: true, reason: 'No active gameplay socket.' });
}

export function finishGame(matchId, payload) {
  if (!matchId) {
    throw new Error('finishGame requires a matchId.');
  }

  return apiRequest(`/games/${encodeURIComponent(matchId)}/finish`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

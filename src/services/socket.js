import { getAuthToken, isMockApiEnabled } from './api.js';
import { normalizeGameState } from './gameNormalizers.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://mahjong-game-backend.onrender.com';

function toWebSocketUrl(matchId) {
  const baseUrl = SOCKET_URL.replace(/^http/, 'ws').replace(/\/$/, '');
  const token = getAuthToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${baseUrl}/games/${encodeURIComponent(matchId)}${query}`;
}

export function normalizeSocketMessage(message) {
  if (!message || typeof message !== 'object') {
    return { type: 'message', payload: message };
  }

  const type = message.type || message.event || message.eventName || 'message';
  const payload = message.payload || message.data || message;

  if (type === 'game_state' || type === 'gameState' || type === 'state:update' || type === 'game_state_updated' || type === 'gameStateUpdated') {
    return { type: 'game_state', payload: normalizeGameState(payload) };
  }

  if (type === 'turn_changed' || type === 'turnChanged') {
    return { type: 'turn_changed', payload };
  }

  if (type === 'tile_discarded' || type === 'tileDiscarded') {
    return { type: 'tile_discarded', payload };
  }

  if (type === 'game_finished' || type === 'gameFinished') {
    return { type: 'game_finished', payload };
  }

  return { type, payload };
}

export function connectGameSocket({ matchId, onMessage, onOpen, onClose, onError } = {}) {
  if (!matchId) {
    return {
      connected: false,
      mode: 'none',
      matchId,
      send() {},
      disconnect() {},
    };
  }

  if (isMockApiEnabled()) {
    const listeners = new Map();

    return {
      connected: true,
      mode: 'mock',
      matchId,
      on(eventName, callback) {
        listeners.set(eventName, callback);
      },
      emit(eventName, payload) {
        const message = normalizeSocketMessage({ eventName, payload, mock: true });
        const callback = listeners.get(eventName);
        if (callback) {
          window.setTimeout(() => callback(message), 80);
        }

        if (onMessage) {
          window.setTimeout(() => onMessage(message), 80);
        }
      },
      send(payload) {
        const message = normalizeSocketMessage(payload);
        if (onMessage) {
          window.setTimeout(() => onMessage(message), 80);
        }
      },
      disconnect() {
        listeners.clear();
      },
    };
  }

  const socket = new WebSocket(toWebSocketUrl(matchId));

  socket.addEventListener('open', () => {
    if (onOpen) onOpen();
  });

  socket.addEventListener('message', (event) => {
    if (!onMessage) {
      return;
    }

    try {
      onMessage(normalizeSocketMessage(JSON.parse(event.data)));
    } catch {
      onMessage(normalizeSocketMessage(event.data));
    }
  });

  socket.addEventListener('close', (event) => {
    if (onClose) onClose(event);
  });

  socket.addEventListener('error', (event) => {
    if (onError) onError(event);
  });

  return {
    connected: false,
    mode: 'websocket',
    matchId,
    send(payload) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    },
    disconnect() {
      socket.close();
    },
    raw: socket,
  };
}

const ACTIVE_MATCH_STORAGE_KEY = 'sakura_active_match';
const MATCHMAKING_STORAGE_KEY = 'sakura_matchmaking_context';

export const initialGameState = {
  selectedRoom: null,
  players: [],
  tiles: [],
  currentTurnPlayerId: null,
  timer: 30,
};

function safeRead(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    if (!value) {
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage is optional. Ignore quota/privacy errors.
  }
}

export function saveMatchmakingContext(context) {
  safeWrite(MATCHMAKING_STORAGE_KEY, context);
}

export function getMatchmakingContext() {
  return safeRead(MATCHMAKING_STORAGE_KEY);
}

export function clearMatchmakingContext() {
  safeWrite(MATCHMAKING_STORAGE_KEY, null);
}

export function saveActiveMatch(match) {
  safeWrite(ACTIVE_MATCH_STORAGE_KEY, match);
}

export function getActiveMatch() {
  return safeRead(ACTIVE_MATCH_STORAGE_KEY);
}

export function clearActiveMatch() {
  safeWrite(ACTIVE_MATCH_STORAGE_KEY, null);
}

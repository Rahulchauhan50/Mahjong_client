import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { getStoredAuthUser } from '../services/authService.js';
import { getGameState, isGameApiAvailable, leaveGame } from '../services/gameService.js';
import { normalizeGameState } from '../services/gameNormalizers.js';
import {
  claimDiscard,
  connectGameSocket,
  declareRiichi,
  declareWin,
  discardTile,
  disconnectGameSocket,
  getActiveGameSocket,
  passClaimWindow,
} from '../services/socket.js';
import { clearActiveMatch, getActiveMatch, saveActiveMatch } from '../store/gameStore.js';
import { mockGameState } from '../mocks/mockGameState.js';
import { useLanguage } from '../i18n/useLanguage.js';
import avatarBunbun from '../assets/profile/avatar-bunbun.png';
import avatarKiki from '../assets/profile/avatar-kiki.png';
import avatarPanda from '../assets/profile/avatar-panda.png';
import avatarStevie from '../assets/profile/avatar-stevie.png';

const asset = (name) => `/assets/gameplay/${name}`;

const PLAYER_AVATAR_FALLBACKS = {
  'Bunbun.png': avatarBunbun,
  'KIKI.png': avatarKiki,
  'Kiki.png': avatarKiki,
  'Stevie.png': avatarStevie,
  'STEIVE.png': avatarStevie,
  'Panda.png': avatarPanda,
};

const DEFAULT_GAMEPLAY_PLAYERS = [
  { id: 'player_top', name: 'Opponent', avatar: 'Bunbun.png', coins: '0', position: 'top', isPlaceholder: true },
  { id: 'player_you', name: 'Player', avatar: 'Stevie.png', coins: '0', position: 'left', isPlaceholder: true },
  { id: 'player_right', name: 'Opponent 2', avatar: 'KIKI.png', coins: '0', position: 'right', isPlaceholder: true },
];

const clampGameplayPlayerCount = (value, fallback = 3) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(2, Math.min(numberValue, 3));
};

const getGameplayPlayerCountFromId = (value) => {
  const match = String(value || '').match(/(\d+)p/i);
  return match ? clampGameplayPlayerCount(match[1]) : null;
};

const getExpectedGameplayPlayerCount = (...sources) => {
  for (const source of sources) {
    if (!source) continue;

    const explicitCount = source.maxPlayers
      ?? source.playerLimit
      ?? source.capacity
      ?? source.room?.maxPlayers
      ?? source.room?.playerLimit
      ?? source.room?.capacity;

    if (explicitCount !== undefined && explicitCount !== null && explicitCount !== '') {
      return clampGameplayPlayerCount(explicitCount);
    }

    const idCount = getGameplayPlayerCountFromId(source.tierId || source.roomId || source.room?.tierId || source.room?.id || source.room?.roomId);
    if (idCount) return idCount;

    if (Array.isArray(source.players) && source.players.length >= 2 && source.players.length <= 3) {
      return clampGameplayPlayerCount(source.players.length);
    }
  }

  return 3;
};


const getGameplayCurrentIdentity = (...sources) => {
  const storedUser = getStoredAuthUser() || {};

  for (const source of sources) {
    if (!source) continue;
    const candidate = source.me || source.currentUser || source.user || source.profile || source.selfPlayer || source.currentPlayer;
    if (candidate && typeof candidate === 'object') return candidate;
  }

  return storedUser;
};

const normalizeGameplayPlayer = (player = {}, index = 0) => ({
  ...player,
  id: player.id || player.userId || player._id || player.playerId || player.clientId || `player_${index + 1}`,
  userId: player.userId || player.id || player._id || player.playerId,
  name: player.name || player.username || player.displayName || player.nickname || player.email || `Player ${index + 1}`,
  username: player.username || player.name || player.displayName || player.nickname,
  avatar: player.avatar || player.avatarUrl || player.avatarId || player.imageUrl || player.photoUrl || player.icon || (index === 0 ? 'Stevie.png' : 'Bunbun.png'),
  coins: player.coins ?? player.balance ?? player.score ?? player.points ?? '0',
});

const collectGameplayPlayers = (...sources) => {
  for (const source of sources) {
    if (!source) continue;
    const list = source.players || source.room?.players || source.initialGameState?.players || source.gameState?.players;
    if (Array.isArray(list) && list.length) {
      const players = list.map(normalizeGameplayPlayer).filter((player) => !isGameplayPlaceholderPlayer(player));
      if (players.length) return players;
    }
  }

  return [];
};

const seatPlayersForGameplay = (sourcePlayers, expectedPlayerCount = 3, currentIds = [], currentSeat = '') => {
  const allowedPositions = expectedPlayerCount <= 2 ? ['left', 'top'] : ['left', 'top', 'right'];
  const normalizedPlayers = toArray(sourcePlayers)
    .filter(Boolean)
    .map(normalizeGameplayPlayer)
    .slice(0, expectedPlayerCount);

  if (!normalizedPlayers.length) return [];

  const playersWithPosition = normalizedPlayers.map((player, index) => {
    const requestedPosition = normalizePosition(player.position);
    const seatPosition = player.seat && currentSeat
      ? getRelativeSeatPosition(player.seat, currentSeat, expectedPlayerCount)
      : '';
    const isCurrent = player.isCurrentPlayer || player.isMe || player.isSelf || playerMatchesAnyId(player, currentIds);

    return {
      ...player,
      position: isCurrent ? 'left' : (requestedPosition || seatPosition || ''),
    };
  });

  const currentIndex = playersWithPosition.findIndex((player) => player.position === 'left' || player.isCurrentPlayer || player.isMe || player.isSelf || playerMatchesAnyId(player, currentIds));
  if (currentIndex > 0) {
    const [currentPlayer] = playersWithPosition.splice(currentIndex, 1);
    playersWithPosition.unshift({ ...currentPlayer, position: 'left' });
  } else if (currentIndex === 0) {
    playersWithPosition[0] = { ...playersWithPosition[0], position: 'left' };
  }

  const usedPositions = new Set();
  return playersWithPosition.map((player, index) => {
    let position = normalizePosition(player.position);

    if (!position || usedPositions.has(position) || !allowedPositions.includes(position)) {
      position = allowedPositions.find((candidate) => !usedPositions.has(candidate)) || allowedPositions[index] || 'top';
    }

    usedPositions.add(position);
    return { ...player, position };
  });
};

function resolvePlayerAvatar(avatar, fallbackAvatar = 'Stevie.png') {
  const value = String(avatar || '').trim();

  if (/^(https?:|data:|blob:|\/)/i.test(value)) {
    return value;
  }

  return PLAYER_AVATAR_FALLBACKS[value]
    || PLAYER_AVATAR_FALLBACKS[fallbackAvatar]
    || avatarStevie;
}

const DEFAULT_ACTIONS = ['chow', 'pong', 'kong', 'pass'];
const EMPTY_SOCKET_GAME_STATE = {
  status: 'waiting',
  players: [],
  handTiles: [],
  myHand: [],
  discards: {},
  centerTiles: [],
  availableActions: [],
  claimWindow: null,
  timer: 0,
  room: { name: 'Live Match' },
};
const CLAIM_ACTION_ALIASES = { pong: 'pung', pung: 'pung', chow: 'chow', kong: 'kong', ron: 'ron' };

const toArray = (value) => (Array.isArray(value) ? value : []);

const isGameplayPlaceholderPlayer = (player = {}) => {
  const id = String(player.id || player.userId || player.playerId || '').trim().toLowerCase();
  const name = String(player.name || player.username || player.displayName || '').trim().toLowerCase();
  const avatar = String(player.avatar || player.avatarUrl || player.avatarId || '').trim().toLowerCase();

  return Boolean(player.isSearching)
    || id.startsWith('searching_')
    || name === 'searching'
    || avatar.includes('icon_02_searching');
};

const parseTimerTimestampMs = (value) => {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    return value > 9999999999 ? value : value * 1000;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue > 9999999999 ? numericValue : numericValue * 1000;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSecondsRemaining = (deadlineMs) => {
  const deadline = Number(deadlineMs) || 0;
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};

const resolveTimerDeadlineMs = (payload = {}, fallbackSeconds = 0) => {
  const explicitDeadline = parseTimerTimestampMs(
    payload.turnEndsAt
    || payload.endsAt
    || payload.expiresAt
    || payload.deadline
    || payload.timerEndsAt
    || payload.claimEndsAt
  );

  if (explicitDeadline) return explicitDeadline;

  const seconds = Number(payload.timeLimit ?? payload.timer ?? payload.remainingSeconds ?? fallbackSeconds ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : 0;
};


const TILE_ASSET_ALIASES = {
  back: 'tile_back.png',
  tile_back: 'tile_back.png',
  Characters_1: 'm_1.png',
  Characters_2: 'm_2.png',
  Characters_3: 'm_3.png',
  Characters_4: 'm_4.png',
  Characters_5: 'm_5.png',
  Characters_6: 'm_6.png',
  Characters_7: 'm_7.png',
  Characters_8: 'm_8.png',
  Characters_9: 'm_9.png',
  'Circles-Dots_1': 'p_1.png',
  'Circles-Dots_2': 'p_2.png',
  'Circles-Dots_3': 'p_3.png',
  'Circles-Dots_4': 'p_4.png',
  'Circles-Dots_5': 'p_5.png',
  'Circles-Dots_6': 'p_6.png',
  'Circles-Dots_7': 'p_7.png',
  'Circles-Dots_8': 'p_8.png',
  'Circles-Dots_9': 'p_9.png',
  Bamboo_1: 's_1.png',
  Bamboo_2: 's_2.png',
  Bamboo_3: 's_3.png',
  Bamboo_4: 's_4.png',
  Bamboo_5: 's_5.png',
  Bamboo_6: 's_6.png',
  Bamboo_7: 's_7.png',
  Bamboo_8: 's_8.png',
  Bamboo_9: 's_9.png',
  Wind_East: 'w_e.png',
  Wind_South: 'w_s.png',
  Wind_West: 'w_w.png',
  Wind_North: 'w_n.png',
  Dragon_Red: 'd_r.png',
  Dragon_White: 'd_w.png',
  Dragon_Green: 'd_g.png',
};

const tileIdToAssetName = (tileId) => {
  const value = String(tileId || '').trim();
  if (!value) return '';

  const withoutExtension = value.replace(/\.(png|jpe?g|webp|gif|svg)$/i, '');
  if (TILE_ASSET_ALIASES[withoutExtension]) return TILE_ASSET_ALIASES[withoutExtension];

  const parts = withoutExtension.split('_');
  const suit = parts[0];
  const rank = parts[1];

  // Backend tile ids include a copy index, e.g. m_1_0 / p_7_2 / d_g_0.
  // The asset files are shared per tile face, so the copy index is intentionally ignored.
  if ((suit === 'm' || suit === 'p' || suit === 's') && /^\d+$/.test(rank)) {
    return `${suit}_${rank}.png`;
  }

  if (suit === 'w' && ['e', 's', 'w', 'n'].includes(rank)) {
    return `w_${rank}.png`;
  }

  if (suit === 'd' && ['r', 'w', 'g'].includes(rank)) {
    return `d_${rank}.png`;
  }

  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(value)) return value;
  return `${withoutExtension}.png`;
};

const getTileId = (tile) => {
  if (!tile) return '';
  if (typeof tile === 'string') return tile;
  return tile.id || tile.tileId || tile.value || tile.name || tile.tileName || tile.image || tile.asset || '';
};

const normalizeTileName = (tile) => tileIdToAssetName(getTileId(tile));

const normalizeTileList = (value) => toArray(value).map(normalizeTileName).filter(Boolean);
const getRawTileList = (value) => toArray(value).map(getTileId).filter(Boolean);

const getFirstRawTileList = (...values) => {
  for (const value of values) {
    const tiles = getRawTileList(value);
    if (tiles.length) return tiles;
  }

  return [];
};

const getFirstTileList = (...values) => {
  for (const value of values) {
    const tiles = normalizeTileList(value);
    if (tiles.length) return tiles;
  }

  return [];
};

const getPlayerTileList = (player, ...keys) => {
  if (!player) return [];

  for (const key of keys) {
    const tiles = normalizeTileList(player[key]);
    if (tiles.length) return tiles;
  }

  return [];
};

const getDiscardTilesByPosition = (state, player, position) => getFirstTileList(
  player?.discardTiles,
  player?.discards,
  player?.discardPile,
  player?.discardedTiles,
  state.discards?.[position],
  state.discardTiles?.[position],
  state.discardPiles?.[position],
  state[`${position}DiscardTiles`],
  state[`${position}Discards`]
);

const getAvailableActions = (state, useMockDefaults = false) => {
  const rawActions = [
    state.claimWindow?.yourValidActions,
    state.claimWindow?.validActions,
    state.claimWindow?.actions,
    state.validActions,
    state.availableActions,
    state.actions,
    state.allowedActions,
  ].find((actions) => Array.isArray(actions) && actions.length) || (useMockDefaults ? DEFAULT_ACTIONS : []);

  const actions = toArray(rawActions)
    .map((action) => (typeof action === 'string' ? action : action?.type || action?.key || action?.name || action?.action))
    .filter(Boolean)
    .map((action) => String(action).toLowerCase())
    .map((action) => (action === 'pung' ? 'pong' : action))
    .map((action) => (action === 'kan' ? 'kong' : action))
    .map((action) => (action === 'chi' ? 'chow' : action))
    .filter((action) => action !== 'win')
    .filter((action, index, list) => list.indexOf(action) === index);

  if (state.claimWindow && actions.length && !actions.includes('pass')) {
    return [...actions, 'pass'];
  }

  return actions;
};

const normalizeId = (value) => String(value ?? '').trim();

const getEntityIds = (source = {}) => [
  source.id,
  source._id,
  source.userId,
  source.playerId,
  source.uid,
  source.socketId,
  source.clientId,
  source.profileId,
].map(normalizeId).filter(Boolean);

const getCurrentPlayerIdCandidates = (...sources) => {
  const storedUser = getStoredAuthUser() || {};
  const ids = [];

  sources.filter(Boolean).forEach((source) => {
    // Only include identities that represent this browser/user.
    // Do not include activeUserId / turnPlayerId here, otherwise every client can
    // incorrectly resolve the current active player as "me".
    ids.push(
      source.myPlayerId,
      source.selfPlayerId,
      source.localPlayerId,
      source.me?.id,
      source.me?.userId,
      source.currentUser?.id,
      source.currentUser?.userId,
      source.room?.myPlayerId,
      source.room?.selfPlayerId,
      source.initialGameState?.myPlayerId,
      source.initialGameState?.selfPlayerId,
      source.initialGameState?.localPlayerId,
    );
  });

  ids.push(...getEntityIds(storedUser));

  return ids.map(normalizeId).filter(Boolean).filter((id, index, list) => list.indexOf(id) === index);
};

const playerMatchesAnyId = (player, ids = []) => {
  if (!player || !ids.length) return false;
  const playerIds = getEntityIds(player);
  return playerIds.some((id) => ids.includes(id));
};

const getCurrentPlayerSeat = (...sources) => {
  for (const source of sources) {
    const seat = source?.mySeat || source?.seat || source?.currentPlayerSeat || source?.selfSeat || source?.initialGameState?.mySeat || source?.initialGameState?.seat;
    if (seat) return seat;
  }

  return '';
};

const normalizePosition = (value) => {
  const position = String(value || '').toLowerCase();
  return ['left', 'top', 'right'].includes(position) ? position : '';
};

const resolveActiveTurnPosition = ({ state, players, locationState, storedMatch, useMockFallback = false }) => {
  const explicitPosition = normalizePosition(state.activeTurnPosition || state.currentTurnPosition || state.turnPosition);
  if (explicitPosition) return explicitPosition;

  const activeSeat = state.activeSeat || state.currentTurnSeat || state.turnSeat || state.turn?.seat;
  const seatPosition = getSeatPosition(activeSeat, state);
  if (seatPosition) return seatPosition;

  const activeIds = getEntityIds({
    id: state.currentTurnPlayerId || state.turnPlayerId || state.activeUserId || state.activePlayerId || state.turn?.playerId || state.turn?.userId,
  });

  if (activeIds.length) {
    const activePlayer = toArray(players).find((player) => playerMatchesAnyId(player, activeIds));
    if (activePlayer?.position) return activePlayer.position;

    const currentIds = getCurrentPlayerIdCandidates(state, locationState, storedMatch);
    if (activeIds.some((id) => currentIds.includes(id))) return 'left';
  }

  const currentSeat = getCurrentPlayerSeat(state, locationState, storedMatch);
  if (currentSeat && activeSeat && String(currentSeat).toLowerCase() === String(activeSeat).toLowerCase()) {
    return 'left';
  }

  return useMockFallback ? 'left' : '';
};

const actionDefinitions = {
  chow: { labelKey: 'chow', className: 'blue' },
  pong: { labelKey: 'pong', className: 'green' },
  kong: { labelKey: 'kong', className: 'purple' },
  pass: { labelKey: 'pass', className: 'black' },
  ron: { labelKey: 'win', className: 'purple' },
  tsumo: { labelKey: 'win', className: 'purple' },
  riichi: { labelKey: 'riichi', className: 'blue' },
};

function GameplayTile({ name, className = '', label = '' }) {
  return <img className={`gameplay-tile ${className}`} src={asset(name)} alt={label} draggable="false" />;
}

function TileWall({ count = 14, direction = 'horizontal', className = '' }) {
  return (
    <div className={`gameplay-tile-wall ${direction} ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <img src={asset('tile_back.png')} alt="" draggable="false" key={index} />
      ))}
    </div>
  );
}

function SideTool({ icon, label, onClick, className = '' }) {
  return (
    <button
      className={`gameplay-side-tool ${className}`}
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      <span className="gameplay-side-icon-shell">
        <img src={asset(icon)} alt="" draggable="false" />
      </span>
      <span className="gameplay-side-label">{label}</span>
    </button>
  );
}

function PlayerBadge({ variant = 'small', avatar, name, coins, className = '', isActiveTurn = false, turnLabel = '' }) {
  return (
    <article className={`gameplay-player-badge ${variant} ${className} ${isActiveTurn ? 'active-turn' : ''}`}>
      {isActiveTurn ? (
        <>
          <span className="gameplay-turn-badge">{turnLabel}</span>
          <span className="gameplay-turn-arrow" aria-hidden="true">➤</span>
        </>
      ) : null}
      <img src={resolvePlayerAvatar(avatar)} alt="" className="gameplay-player-avatar" draggable="false" />
      <div className="gameplay-player-info">
        <strong>{name}</strong>
        {coins ? (
          <span>
            <i aria-hidden="true" />
            {coins}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Compass({ round = 'East 1', timer = 18, turnLabel = 'YOUR TURN' }) {
  return (
    <div className="gameplay-center-compass" aria-label={`Round ${round}. ${turnLabel}`}>
      <span className="timer">{timer}</span>
      <span className="north">N</span>
      <span className="east">E</span>
      <strong>{round}</strong>
      <em>{turnLabel}</em>
      <span className="south">S</span>
      <span className="west">W</span>
    </div>
  );
}


function normalizeSeat(value) {
  const seat = String(value || '').trim().toLowerCase();
  const aliases = { east: 'e', south: 's', west: 'w', north: 'n' };
  return aliases[seat] || seat;
}

function getRelativeSeatPosition(activeSeat, ownSeat, playerCount = 3) {
  const active = normalizeSeat(activeSeat);
  const own = normalizeSeat(ownSeat);

  if (!active || !own) return '';
  if (active === own) return 'left';

  const seats = ['e', 's', 'w', 'n'];
  const activeIndex = seats.indexOf(active);
  const ownIndex = seats.indexOf(own);

  if (activeIndex < 0 || ownIndex < 0) return '';
  if (playerCount <= 2) return 'top';

  const offset = (activeIndex - ownIndex + seats.length) % seats.length;
  if (offset === 1) return 'right';
  if (offset === 2) return 'top';
  if (offset === 3) return 'top';

  return '';
}

function getSeatPosition(seat, state = {}) {
  if (!seat) return '';

  const playerWithSeat = toArray(state.players).find((player) => normalizeSeat(player.seat) === normalizeSeat(seat));
  if (playerWithSeat?.position) return playerWithSeat.position;

  const ownSeat = state.mySeat || state.seat || state.currentPlayerSeat || state.selfSeat;
  const playerCount = getExpectedGameplayPlayerCount(state);
  return getRelativeSeatPosition(seat, ownSeat, playerCount);
}

function mergeTurnStart(current, payload = {}) {
  const activeUserId = payload.activeUserId || payload.currentTurnPlayerId || payload.turnPlayerId || payload.activePlayerId || payload.playerId;
  const activeSeat = payload.activeSeat || payload.currentTurnSeat || payload.turnSeat || payload.seat;
  const activeIds = getEntityIds({ id: activeUserId });
  const playerWithActiveId = activeIds.length
    ? toArray(current.players).find((player) => playerMatchesAnyId(player, activeIds))
    : null;
  const activeTurnPosition = getSeatPosition(activeSeat, current)
    || playerWithActiveId?.position
    || '';

  const nextTimeLimit = Number(payload.timeLimit ?? payload.timer ?? payload.remainingSeconds ?? current.timeLimit ?? current.timer ?? 0) || 0;
  const timerDeadlineMs = resolveTimerDeadlineMs(payload, nextTimeLimit);

  return {
    ...current,
    status: 'playing',
    activeSeat: activeSeat || current.activeSeat,
    activeUserId: activeUserId || current.activeUserId,
    activeTurnPosition,
    currentTurnPlayerId: activeUserId || current.currentTurnPlayerId,
    timer: timerDeadlineMs ? getSecondsRemaining(timerDeadlineMs) : nextTimeLimit,
    timeLimit: nextTimeLimit || current.timeLimit,
    timerDeadlineMs,
    wallRemaining: payload.wallRemaining ?? current.wallRemaining,
    turnStartedAt: Date.now(),
    availableActions: [],
    validActions: [],
    claimWindow: null,
  };
}

function mergeDrawnTile(current, payload = {}) {
  const tile = payload.tileId || payload.tile || payload.drawnTile;
  if (!tile) return current;

  const handTiles = getFirstRawTileList(current.handTiles, current.myHand, current.playerHand);

  return {
    ...current,
    drawnTile: tile,
    handTiles: [...handTiles, tile],
    myHand: [...handTiles, tile],
  };
}

function mergeClaimWindow(current, payload = {}) {
  const validActions = toArray(payload.yourValidActions || payload.validActions || payload.actions)
    .map((action) => (typeof action === 'string' ? action : action?.type || action?.action || action?.key))
    .filter(Boolean)
    .map((action) => String(action).toLowerCase())
    .map((action) => (action === 'pung' ? 'pong' : action));

  const nextTimeLimit = Number(payload.timeLimit ?? payload.timer ?? payload.remainingSeconds ?? current.timer ?? 0) || 0;
  const timerDeadlineMs = resolveTimerDeadlineMs(payload, nextTimeLimit);

  return {
    ...current,
    status: 'resolving',
    claimWindow: payload,
    availableActions: validActions,
    timer: timerDeadlineMs ? getSecondsRemaining(timerDeadlineMs) : nextTimeLimit,
    timeLimit: nextTimeLimit || current.timeLimit,
    timerDeadlineMs,
  };
}

function mergeActionBroadcast(current, payload = {}) {
  const action = String(payload.action || '').toLowerCase();
  const tileId = payload.tileId || payload.tile || payload.discardedTile;
  const actionUserId = payload.userId || payload.playerId || payload.activeUserId || payload.discardedBy || payload.discardedByUserId || payload.discardedByPlayerId;
  const actionIds = getEntityIds({ id: actionUserId });
  const playerWithActionId = actionIds.length
    ? toArray(current.players).find((player) => playerMatchesAnyId(player, actionIds))
    : null;
  const seatPosition = getSeatPosition(payload.seat || payload.discardedBySeat, current)
    || playerWithActionId?.position
    || payload.position;

  if (!action) return current;

  const next = {
    ...current,
    lastAction: payload,
    status: action === 'disconnected' || action === 'reconnected' ? current.status : 'playing',
    claimWindow: null,
    availableActions: [],
  };

  if (action === 'discard' && tileId) {
    const renderedTile = tileIdToAssetName(tileId);
    const discards = { ...(current.discards || {}) };
    const key = seatPosition || 'center';
    const currentIds = getCurrentPlayerIdCandidates(current);
    const isLocalDiscard = seatPosition === 'left' || (actionIds.length && actionIds.some((id) => currentIds.includes(id)));

    discards[key] = [...normalizeTileList(discards[key]), renderedTile];
    next.discards = discards;

    if (isLocalDiscard) {
      const discardedRawId = String(tileId);
      next.handTiles = getFirstRawTileList(current.handTiles, current.myHand, current.playerHand)
        .filter((tile) => String(tile) !== discardedRawId && normalizeTileName(tile) !== renderedTile);
      next.myHand = next.handTiles;
    }
  }

  if ((action === 'pung' || action === 'pong' || action === 'kong' || action === 'chow') && payload.meldTiles) {
    const currentMelds = Array.isArray(current.centerTiles) ? current.centerTiles : [];
    next.centerTiles = [...currentMelds, ...normalizeTileList(payload.meldTiles)];
  }

  return next;
}

function normalizeInitialSocketState(payload = {}, fallbackMatchId = '') {
  const normalized = normalizeGameState(payload);
  return {
    ...normalized,
    matchId: normalized.matchId || payload.matchId || payload.gameId || payload.roomId || fallbackMatchId,
    status: normalized.status || 'playing',
    mySeat: payload.mySeat || payload.seat || normalized.mySeat || normalized.seat,
    seat: payload.seat || normalized.seat,
    players: collectGameplayPlayers(payload, normalized),
    handTiles: getFirstRawTileList(payload.initialHand, payload.myHand, payload.handTiles, normalized.handTiles),
    myHand: getFirstRawTileList(payload.initialHand, payload.myHand, payload.handTiles, normalized.myHand, normalized.handTiles),
    wallRemaining: payload.wallRemaining ?? normalized.wallRemaining,
    playerCount: payload.playerCount ?? normalized.playerCount,
    maxPlayers: payload.maxPlayers ?? payload.room?.maxPlayers ?? normalized.maxPlayers ?? normalized.room?.maxPlayers,
  };
}

export default function MahjongGamePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const location = useLocation();
  const { matchId: routeMatchId } = useParams();
  const [storedMatch] = useState(() => getActiveMatch());
  const gameApiAvailable = isGameApiAvailable();
  const initialSocketPayload = location.state?.initialGameState || storedMatch?.initialGameState || null;
  const socketGameplayEnabled = Boolean(location.state?.socketMode || storedMatch?.socketMode || initialSocketPayload || !gameApiAvailable);
  const resolvedMatchId = routeMatchId
    || location.state?.matchId
    || storedMatch?.matchId
    || initialSocketPayload?.matchId
    || initialSocketPayload?.gameId
    || initialSocketPayload?.roomId
    || (gameApiAvailable ? mockGameState.matchId : 'live_match');

  const [selectedAction, setSelectedAction] = useState(null);
  const [gameState, setGameState] = useState(() => ({
    ...(gameApiAvailable ? mockGameState : EMPTY_SOCKET_GAME_STATE),
    ...(initialSocketPayload ? normalizeInitialSocketState(initialSocketPayload, resolvedMatchId) : {}),
    matchId: resolvedMatchId,
  }));
  const [gameError, setGameError] = useState('');
  const [displayTimer, setDisplayTimer] = useState(() => Number(gameState.timer ?? gameState.timeLimit ?? 0) || 0);

  useEffect(() => {
    if (!routeMatchId && resolvedMatchId) {
      navigate(buildGameRoute(resolvedMatchId), { replace: true, state: location.state });
      return undefined;
    }

    let isMounted = true;
    const activeMatchBase = {
      ...storedMatch,
      matchId: resolvedMatchId,
      roomId: location.state?.roomId || storedMatch?.roomId,
      roomCode: location.state?.roomCode || storedMatch?.roomCode,
      socketMode: socketGameplayEnabled,
      maxPlayers: location.state?.maxPlayers || storedMatch?.maxPlayers || initialSocketPayload?.maxPlayers,
      players: location.state?.players || storedMatch?.players || initialSocketPayload?.players,
    };

    if (!gameApiAvailable && !socketGameplayEnabled && !getActiveGameSocket()) {
      setGameError('No active gameplay session found. Start from matchmaking or join a room first.');
      setGameState((current) => ({ ...(current || EMPTY_SOCKET_GAME_STATE), status: 'waiting', handTiles: [], myHand: [], availableActions: [] }));
      return () => {
        isMounted = false;
      };
    }

    if (initialSocketPayload) {
      const normalizedInitial = normalizeInitialSocketState(initialSocketPayload, resolvedMatchId);
      setGameState((current) => ({ ...(current || {}), ...normalizedInitial, matchId: normalizedInitial.matchId || resolvedMatchId }));
      saveActiveMatch({ ...activeMatchBase, initialGameState: normalizedInitial });
    }

    if (gameApiAvailable) {
      getGameState(resolvedMatchId)
        .then((state) => {
          if (isMounted && state) {
            setGameState((current) => ({ ...(current || {}), ...state, matchId: state.matchId || resolvedMatchId }));
            saveActiveMatch({
              ...activeMatchBase,
              matchId: state.matchId || resolvedMatchId,
              roomId: state.room?.id || activeMatchBase.roomId,
            });
          }
        })
        .catch((error) => {
          console.error('Failed to load game state:', error);
          if (isMounted && !socketGameplayEnabled) {
            setGameError(error.message || t('gameLoadFailed'));
          }
        });
    }

    const handleSocketMessage = (message = {}) => {
      if (!isMounted) return;
      const payload = message.payload || {};

      switch (message.type) {
        case 'game_start':
        case 'game_state':
          setGameState((current) => ({
            ...(current || {}),
            ...normalizeInitialSocketState(payload, resolvedMatchId),
            matchId: payload.matchId || payload.gameId || payload.roomId || current?.matchId || resolvedMatchId,
          }));
          setGameError('');
          break;
        case 'turn_changed':
          setGameState((current) => mergeTurnStart(current || {}, payload));
          setGameError('');
          break;
        case 'drawn_tile':
          setGameState((current) => mergeDrawnTile(current || {}, payload));
          break;
        case 'claim_window':
          setGameState((current) => mergeClaimWindow(current || {}, payload));
          break;
        case 'action_broadcast':
        case 'tile_discarded':
          setGameState((current) => mergeActionBroadcast(current || {}, payload));
          break;
        case 'game_finished':
          setGameState((current) => ({
            ...(current || {}),
            ...payload,
            status: 'finished',
            result: payload,
            winner: payload.winner || payload.winnerId || current?.winner,
            winnerId: payload.winnerId || payload.winner?.id || current?.winnerId,
            matchId: payload.matchId || current?.matchId || resolvedMatchId,
          }));
          break;
        case 'error':
          setGameError(payload.message || payload.error || 'Gameplay socket error.');
          break;
        default:
          break;
      }
    };

    const existingSocket = getActiveGameSocket();
    const gameSocket = existingSocket || connectGameSocket({
      matchId: resolvedMatchId,
      onError(error) {
        console.error('Game socket error:', error);
        if (isMounted) setGameError(error?.message || 'Unable to connect to gameplay server.');
      },
      onClose() {
        if (isMounted) setGameError('Gameplay socket disconnected. Reconnect will sync state if the backend supports it.');
      },
    });

    const socketHandlers = [
      ['game:start', (payload) => handleSocketMessage({ type: 'game_start', payload })],
      ['game:sync_state', (payload) => handleSocketMessage({ type: 'game_state', payload })],
      ['game:turn_start', (payload) => handleSocketMessage({ type: 'turn_changed', payload })],
      ['player:drawn_tile', (payload) => handleSocketMessage({ type: 'drawn_tile', payload })],
      ['game:claim_window', (payload) => handleSocketMessage({ type: 'claim_window', payload })],
      ['game:action_broadcast', (payload) => handleSocketMessage({ type: 'action_broadcast', payload })],
      ['game:over', (payload) => handleSocketMessage({ type: 'game_finished', payload })],
      ['error', (payload) => handleSocketMessage({ type: 'error', payload })],
      ['connect', () => { if (isMounted) setGameError(''); }],
      ['disconnect', () => { if (isMounted) setGameError('Gameplay socket disconnected. Reconnect will sync state if the backend supports it.'); }],
    ];

    if (gameSocket?.on) {
      socketHandlers.forEach(([eventName, handler]) => gameSocket.on(eventName, handler));
    }

    return () => {
      isMounted = false;
      if (gameSocket?.off) {
        socketHandlers.forEach(([eventName, handler]) => gameSocket.off(eventName, handler));
      }
      // Keep the live socket alive while navigating from the game to the result screen.
      if (!socketGameplayEnabled) {
        gameSocket?.disconnect?.();
      }
    };
  }, [gameApiAvailable, initialSocketPayload, location.state, navigate, resolvedMatchId, routeMatchId, socketGameplayEnabled, storedMatch, t]);

  useEffect(() => {
    const deadline = Number(gameState.timerDeadlineMs || 0);

    if (deadline) {
      setDisplayTimer(getSecondsRemaining(deadline));
      return;
    }

    const nextTimer = Number(gameState.timer ?? gameState.remainingSeconds ?? gameState.timeLimit ?? 0);
    setDisplayTimer(Number.isFinite(nextTimer) ? nextTimer : 0);
  }, [gameState.timerDeadlineMs, gameState.timer, gameState.remainingSeconds, gameState.timeLimit, gameState.activeTurnPosition, gameState.claimWindow]);

  const expectedPlayerCount = useMemo(() => getExpectedGameplayPlayerCount(
    gameState,
    location.state,
    storedMatch
  ), [gameState, location.state, storedMatch]);

  const currentPlayerIds = useMemo(() => getCurrentPlayerIdCandidates(gameState, location.state, storedMatch), [gameState, location.state, storedMatch]);
  const currentPlayerSeat = getCurrentPlayerSeat(gameState, location.state, storedMatch);

  const players = useMemo(() => {
    const livePlayers = collectGameplayPlayers(gameState, location.state, storedMatch, initialSocketPayload);
    const currentIdentity = normalizeGameplayPlayer(getGameplayCurrentIdentity(gameState, location.state, storedMatch, initialSocketPayload), 0);
    const sourcePlayers = livePlayers.length
      ? livePlayers
      : gameApiAvailable
        ? mockGameState.players
        : [{ ...currentIdentity, isCurrentPlayer: true }, ...DEFAULT_GAMEPLAY_PLAYERS.filter((player) => player.position !== 'left')];

    return seatPlayersForGameplay(sourcePlayers, expectedPlayerCount, currentPlayerIds, currentPlayerSeat);
  }, [currentPlayerIds, currentPlayerSeat, expectedPlayerCount, gameApiAvailable, gameState, initialSocketPayload, location.state, storedMatch]);

  const fallbackCurrentPlayer = normalizeGameplayPlayer(getGameplayCurrentIdentity(gameState, location.state, storedMatch, initialSocketPayload), 0);
  const topPlayer = players.find((player) => player.position === 'top') || DEFAULT_GAMEPLAY_PLAYERS[0];
  const leftPlayer = players.find((player) => player.position === 'left') || { ...fallbackCurrentPlayer, position: 'left' };
  const rightPlayer = players.find((player) => player.position === 'right') || null;
  const hasRightPlayer = expectedPlayerCount >= 3 && Boolean(rightPlayer);

  const activeTurnPosition = resolveActiveTurnPosition({
    state: gameState,
    players,
    locationState: location.state,
    storedMatch,
    useMockFallback: gameApiAvailable,
  });
  const isUserTurn = activeTurnPosition === 'left';
  const activeTurnName = activeTurnPosition === 'top'
    ? (topPlayer.name === 'BUNBUN' ? 'Bunbun' : topPlayer.name)
    : activeTurnPosition === 'right'
      ? (rightPlayer?.name || 'Player')
      : 'Your';
  const activeTurnLabel = activeTurnPosition
    ? (isUserTurn ? t('yourTurn') : `${activeTurnName}${t('turnSuffix')}`)
    : t('pleaseWaitMatch');

  const rawPlayerHandTiles = getFirstRawTileList(
    gameState.handTiles,
    gameState.playerHand,
    gameState.myHand,
    gameState.currentPlayerHand,
    ...(gameApiAvailable ? [getPlayerTileList(leftPlayer, 'handTiles', 'hand', 'tiles')] : [])
  );
  const playerHandTiles = rawPlayerHandTiles.map((tile) => normalizeTileName(tile));
  const topDiscardTiles = getDiscardTilesByPosition(gameState, topPlayer, 'top');
  const rightDiscardTiles = hasRightPlayer ? getDiscardTilesByPosition(gameState, rightPlayer, 'right') : [];
  const centerDiscardTiles = getFirstTileList(
    gameState.centerTiles,
    gameState.centerDiscardTiles,
    gameState.centerMeldTiles,
    gameState.meldTiles,
    gameState.melds?.center,
    gameState.discards?.center,
    gameState.discardTiles?.center
  );
  const isClaimWindowOpen = Boolean(gameState.claimWindow);
  const availableActions = getAvailableActions(gameState, gameApiAvailable);


  useEffect(() => {
    const status = String(gameState.status || '').toLowerCase();
    const shouldRunTimer = ['playing', 'resolving', 'active'].includes(status) || isUserTurn || isClaimWindowOpen;
    const deadline = Number(gameState.timerDeadlineMs || 0);

    if (!shouldRunTimer) {
      return undefined;
    }

    if (deadline) {
      const updateTimer = () => setDisplayTimer(getSecondsRemaining(deadline));
      updateTimer();
      const intervalId = window.setInterval(updateTimer, 250);
      return () => window.clearInterval(intervalId);
    }

    if (displayTimer <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDisplayTimer((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [displayTimer, gameState.timerDeadlineMs, gameState.status, isClaimWindowOpen, isUserTurn]);


  useEffect(() => {
    const status = String(gameState.status || '').toLowerCase();
    const winner = gameState.winner || gameState.winnerId || gameState.result?.winner || gameState.result?.winnerId;

    if (status === 'finished' || status === 'completed' || winner) {
      navigate(ROUTES.result, {
        replace: true,
        state: {
          matchId: gameState.matchId || resolvedMatchId,
          result: gameState.result || gameState,
          winner,
        },
      });
    }
  }, [gameState.matchId, gameState.result, gameState.status, gameState.winner, gameState.winnerId, navigate, resolvedMatchId]);

  const handleTileDiscard = (tile) => {
    if (!isUserTurn) return;

    const tileId = getTileId(tile);
    if (!tileId) return;

    const sent = discardTile(tileId);
    if (!sent) {
      setGameError('Unable to discard tile. Waiting for gameplay socket connection.');
    }
  };

  const handleMahjongAction = (actionKey) => {
    setSelectedAction(actionKey);

    if (actionKey === 'pass') {
      const sent = passClaimWindow();
      if (!sent) setGameError('Unable to pass. Waiting for gameplay socket connection.');
      return;
    }

    if (actionKey === 'tsumo') {
      const sent = declareWin('tsumo');
      if (!sent) setGameError('Unable to declare win. Waiting for gameplay socket connection.');
      return;
    }

    if (actionKey === 'riichi') {
      const drawnTile = gameState.drawnTile || rawPlayerHandTiles[rawPlayerHandTiles.length - 1];
      const sent = declareRiichi(getTileId(drawnTile));
      if (!sent) setGameError('Unable to declare Riichi. Waiting for gameplay socket connection.');
      return;
    }

    const claimAction = CLAIM_ACTION_ALIASES[actionKey] || actionKey;
    const sent = claimDiscard(claimAction);
    if (!sent) {
      setGameError('Unable to send claim action. Waiting for gameplay socket connection.');
    }
  };

  return (
    <section className="gameplay-screen" aria-label="Mahjong gameplay screen">
      <img className="gameplay-bg" src={asset('BG.png')} alt="" draggable="false" />
      <div className="gameplay-vignette" aria-hidden="true" />
      <div className="gameplay-sakura-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>

      {gameError ? <div className="gameplay-error" role="alert">{gameError}</div> : null}

      <header className="gameplay-room-title">
        <span>{t('room')}</span>
        <strong>{gameState.room?.name || 'My Sakura Room'}</strong>
      </header>

      <PlayerBadge
        className="top-player"
        variant="top"
        avatar={topPlayer.avatar}
        name={topPlayer.name === 'BUNBUN' ? 'Bunbun' : topPlayer.name}
        coins={topPlayer.coins}
        isActiveTurn={activeTurnPosition === 'top'}
        turnLabel={activeTurnPosition === 'top' ? activeTurnLabel : ''}
      />

      <PlayerBadge
        className="left-player"
        variant="left"
        avatar={leftPlayer.avatar}
        name={leftPlayer.name === 'STEIVE' ? 'Stevie' : leftPlayer.name}
        coins={leftPlayer.coins}
        isActiveTurn={activeTurnPosition === 'left'}
        turnLabel={activeTurnPosition === 'left' ? activeTurnLabel : ''}
      />

      {hasRightPlayer ? (
        <PlayerBadge
          className="right-player"
          variant="right"
          avatar={rightPlayer.avatar}
          name={rightPlayer.name}
          coins={rightPlayer.coins}
          isActiveTurn={activeTurnPosition === 'right'}
          turnLabel={activeTurnPosition === 'right' ? activeTurnLabel : ''}
        />
      ) : null}

      <main className="gameplay-table-zone">
        <img className="gameplay-table" src={asset('table.png')} alt="Mahjong table" draggable="false" />

        <TileWall count={14} direction="horizontal" className="wall-top" />
        {hasRightPlayer ? <TileWall count={13} direction="vertical" className="wall-right" /> : null}

        <Compass round={gameState.round || 'East 1'} timer={displayTimer} turnLabel={activeTurnLabel} />

        <div className="gameplay-upper-discard" aria-label="Top discard tiles">
          {topDiscardTiles.map((tile, index) => (
            <GameplayTile name={tile} key={`${tile}-${index}`} />
          ))}
        </div>

        {hasRightPlayer ? (
          <div className="gameplay-right-discard" aria-label="Right discard tiles">
            {rightDiscardTiles.map((tile, index) => (
              <GameplayTile name={tile} key={`${tile}-${index}`} />
            ))}
          </div>
        ) : null}

        <div className="gameplay-center-discard" aria-label="Center meld tiles">
          {centerDiscardTiles.map((tile, index) => (
            <GameplayTile name={tile} key={`${tile}-${index}`} />
          ))}
        </div>

        <div className="gameplay-hand" aria-label="Player hand tiles">
          {playerHandTiles.map((tile, index) => (
            <button
              className="gameplay-hand-tile"
              type="button"
              key={`${tile}-${index}`}
              aria-label={`Tile ${index + 1}`}
              disabled={!isUserTurn}
              onClick={() => handleTileDiscard(rawPlayerHandTiles[index] || tile)}
            >
              <GameplayTile name={tile} />
            </button>
          ))}
        </div>
      </main>

      <nav className={`gameplay-actions ${isUserTurn ? 'player-turn' : 'waiting-turn'} ${isClaimWindowOpen ? 'claim-window' : ''}`} aria-label={t('mahjongActions')}>
        {availableActions.map((actionKey) => {
          const action = actionDefinitions[actionKey];

          if (!action) {
            return null;
          }

          const isActive = selectedAction === actionKey;

          return (
            <button
              className={`gameplay-action ${action.className} ${isActive ? 'active' : ''}`}
              type="button"
              key={actionKey}
              onClick={() => handleMahjongAction(actionKey)}
              aria-pressed={isActive}
              disabled={!isClaimWindowOpen && !isUserTurn}
            >
              {t(action.labelKey)}
            </button>
          );
        })}
      </nav>

      <aside className="gameplay-side-menu" aria-label="Gameplay side menu">
        <SideTool
          icon="exit.png"
          label={t('leave')}
          className="leave"
          onClick={async () => {
            await leaveGame(gameState.matchId || resolvedMatchId);
            disconnectGameSocket();
            clearActiveMatch();
            navigate(ROUTES.mainMenu);
          }}
        />
      </aside>
    </section>
  );
}

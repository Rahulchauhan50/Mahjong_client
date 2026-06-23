import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { getGameState, isGameApiAvailable, leaveGame } from '../services/gameService.js';
import { normalizeGameState } from '../services/gameNormalizers.js';
import {
  claimDiscard,
  connectGameSocket,
  declareRiichi,
  declareWin,
  discardTile,
  getActiveGameSocket,
  passClaimWindow,
} from '../services/socket.js';
import { clearActiveMatch, getActiveMatch, saveActiveMatch } from '../store/gameStore.js';
import { mockGameState } from '../mocks/mockGameState.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/gameplay/${name}`;


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


const tileIdToAssetName = (tileId) => {
  const value = String(tileId || '').trim();
  if (!value) return '';
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(value)) return value;

  const parts = value.split('_');
  const suit = parts[0];
  const rank = parts[1];

  if (suit === 'm' && /^\d+$/.test(rank)) return `Characters_${rank}.png`;
  if (suit === 'p' && /^\d+$/.test(rank)) return `Circles-Dots_${rank}.png`;
  if (suit === 's' && /^\d+$/.test(rank)) return `Bamboo_${rank}.png`;

  // Honour tiles depend on the final art asset names. Keep the backend id as a fallback
  // instead of dropping the tile, so integration bugs are visible during testing.
  return value;
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

const getAvailableActions = (state, useMockDefaults = true) => {
  const rawActions = [
    state.claimWindow?.yourValidActions,
    state.validActions,
    state.availableActions,
    state.actions,
    state.allowedActions,
  ].find((actions) => Array.isArray(actions) && actions.length) || (useMockDefaults ? DEFAULT_ACTIONS : []);

  return toArray(rawActions)
    .map((action) => (typeof action === 'string' ? action : action?.type || action?.key || action?.name || action?.action))
    .filter(Boolean)
    .map((action) => String(action).toLowerCase())
    .map((action) => (action === 'pung' ? 'pong' : action))
    .filter((action) => action !== 'win')
    .filter((action, index, list) => list.indexOf(action) === index);
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
        <img src={asset('card back.png')} alt="" draggable="false" key={index} />
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
      <img src={asset(avatar)} alt="" className="gameplay-player-avatar" draggable="false" />
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


function getSeatPosition(seat, state = {}) {
  if (!seat) return '';
  const normalizedSeat = String(seat).toLowerCase();
  const ownSeat = String(state.mySeat || state.seat || '').toLowerCase();

  if (ownSeat && normalizedSeat === ownSeat) return 'left';

  const playerWithSeat = toArray(state.players).find((player) => String(player.seat || '').toLowerCase() === normalizedSeat);
  if (playerWithSeat?.position) return playerWithSeat.position;

  const fallbackSeatPositions = { e: 'left', east: 'left', s: 'right', south: 'right', w: 'top', west: 'top', n: 'top', north: 'top' };
  return fallbackSeatPositions[normalizedSeat] || '';
}

function mergeTurnStart(current, payload = {}) {
  const activeTurnPosition = getSeatPosition(payload.activeSeat, current)
    || current.activeTurnPosition
    || current.currentTurnPosition
    || current.turnPosition;

  return {
    ...current,
    status: current.status || 'playing',
    activeSeat: payload.activeSeat || current.activeSeat,
    activeUserId: payload.activeUserId || current.activeUserId,
    activeTurnPosition,
    currentTurnPlayerId: payload.activeUserId || current.currentTurnPlayerId,
    timer: payload.timeLimit ?? payload.timer ?? current.timer,
    timeLimit: payload.timeLimit ?? current.timeLimit,
    wallRemaining: payload.wallRemaining ?? current.wallRemaining,
    availableActions: [],
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

  return {
    ...current,
    status: 'resolving',
    claimWindow: payload,
    availableActions: validActions,
    timer: payload.timeLimit ?? current.timer,
  };
}

function mergeActionBroadcast(current, payload = {}) {
  const action = String(payload.action || '').toLowerCase();
  const tileId = payload.tileId || payload.tile || payload.discardedTile;
  const seatPosition = getSeatPosition(payload.seat || payload.discardedBySeat, current) || payload.position;

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
    discards[key] = [...normalizeTileList(discards[key]), renderedTile];
    next.discards = discards;

    if (seatPosition === 'left' || !seatPosition) {
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
    handTiles: getFirstRawTileList(payload.initialHand, payload.myHand, payload.handTiles, normalized.handTiles),
    myHand: getFirstRawTileList(payload.initialHand, payload.myHand, payload.handTiles, normalized.myHand, normalized.handTiles),
    wallRemaining: payload.wallRemaining ?? normalized.wallRemaining,
    playerCount: payload.playerCount ?? normalized.playerCount,
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
      onMessage: handleSocketMessage,
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

  const players = useMemo(
    () => (Array.isArray(gameState.players) && gameState.players.length ? gameState.players : mockGameState.players),
    [gameState.players]
  );
  const topPlayer = players.find((player) => player.position === 'top') || mockGameState.players[0];
  const leftPlayer = players.find((player) => player.position === 'left') || mockGameState.players[1];
  const rightPlayer = players.find((player) => player.position === 'right') || mockGameState.players[2];

  const activeTurnPosition = gameState.activeTurnPosition || gameState.currentTurnPosition || gameState.turnPosition || (gameApiAvailable ? 'left' : '');
  const isUserTurn = activeTurnPosition === 'left';
  const activeTurnName = activeTurnPosition === 'top'
    ? (topPlayer.name === 'BUNBUN' ? 'Bunbun' : topPlayer.name)
    : activeTurnPosition === 'right'
      ? rightPlayer.name
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
  const rightDiscardTiles = getDiscardTilesByPosition(gameState, rightPlayer, 'right');
  const centerDiscardTiles = getFirstTileList(
    gameState.centerTiles,
    gameState.centerDiscardTiles,
    gameState.centerMeldTiles,
    gameState.meldTiles,
    gameState.melds?.center,
    gameState.discards?.center,
    gameState.discardTiles?.center
  );
  const availableActions = getAvailableActions(gameState, gameApiAvailable);
  const isClaimWindowOpen = Boolean(gameState.claimWindow);

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

      <PlayerBadge
        className="right-player"
        variant="right"
        avatar={rightPlayer.avatar}
        name={rightPlayer.name}
        coins={rightPlayer.coins}
        isActiveTurn={activeTurnPosition === 'right'}
        turnLabel={activeTurnPosition === 'right' ? activeTurnLabel : ''}
      />

      <main className="gameplay-table-zone">
        <img className="gameplay-table" src={asset('table.png')} alt="Mahjong table" draggable="false" />

        <TileWall count={14} direction="horizontal" className="wall-top" />
        <TileWall count={13} direction="vertical" className="wall-right" />

        <Compass round={gameState.round || 'East 1'} timer={gameState.timer || 18} turnLabel={activeTurnLabel} />

        <div className="gameplay-upper-discard" aria-label="Top discard tiles">
          {topDiscardTiles.map((tile, index) => (
            <GameplayTile name={tile} key={`${tile}-${index}`} />
          ))}
        </div>

        <div className="gameplay-right-discard" aria-label="Right discard tiles">
          {rightDiscardTiles.map((tile, index) => (
            <GameplayTile name={tile} key={`${tile}-${index}`} />
          ))}
        </div>

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
            clearActiveMatch();
            navigate(ROUTES.mainMenu);
          }}
        />
      </aside>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { getGameState, leaveGame, sendGameAction } from '../services/gameService.js';
import { connectGameSocket } from '../services/socket.js';
import { clearActiveMatch, getActiveMatch, saveActiveMatch } from '../store/gameStore.js';
import { mockGameState } from '../mocks/mockGameState.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/gameplay/${name}`;


const DEFAULT_ACTIONS = ['chow', 'pong', 'kong', 'pass'];

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeTileName = (tile) => {
  if (!tile) return '';
  if (typeof tile === 'string') return tile;
  return tile.image || tile.asset || tile.file || tile.filename || tile.name || tile.tileName || tile.id || '';
};

const normalizeTileList = (value) => toArray(value).map(normalizeTileName).filter(Boolean);

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

const getAvailableActions = (state) => {
  const rawActions = [state.availableActions, state.actions, state.allowedActions]
    .find((actions) => Array.isArray(actions) && actions.length) || DEFAULT_ACTIONS;

  return toArray(rawActions)
    .map((action) => (typeof action === 'string' ? action : action?.type || action?.key || action?.name))
    .filter(Boolean)
    .map((action) => String(action).toLowerCase())
    .filter((action) => action !== 'win');
};

const actionDefinitions = {
  chow: { labelKey: 'chow', className: 'blue' },
  pong: { labelKey: 'pong', className: 'green' },
  kong: { labelKey: 'kong', className: 'purple' },
  pass: { labelKey: 'pass', className: 'black' },
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

export default function MahjongGamePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const location = useLocation();
  const { matchId: routeMatchId } = useParams();
  const [storedMatch] = useState(() => getActiveMatch());
  const resolvedMatchId = routeMatchId || location.state?.matchId || storedMatch?.matchId || mockGameState.matchId;

  const [selectedAction, setSelectedAction] = useState(null);
  const [gameState, setGameState] = useState({
    ...mockGameState,
    matchId: resolvedMatchId,
  });
  const [gameError, setGameError] = useState('');

  useEffect(() => {
    if (!routeMatchId && resolvedMatchId) {
      navigate(buildGameRoute(resolvedMatchId), { replace: true, state: location.state });
      return undefined;
    }

    let isMounted = true;

    getGameState(resolvedMatchId)
      .then((state) => {
        if (isMounted && state) {
          setGameState((current) => ({ ...current, ...state, matchId: state.matchId || resolvedMatchId }));
          saveActiveMatch({
            ...storedMatch,
            matchId: state.matchId || resolvedMatchId,
            roomId: state.room?.id || storedMatch?.roomId,
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load game state:', error);
        if (isMounted) {
          setGameError(error.message || t('gameLoadFailed'));
        }
      });

    const gameSocket = connectGameSocket({
      matchId: resolvedMatchId,
      onMessage(message) {
        if (!isMounted) {
          return;
        }

        if (message.type === 'game_state' || message.type === 'game_state_updated' || message.type === 'turn_changed' || message.type === 'tile_discarded' || message.type === 'game_finished') {
          setGameState((current) => ({ ...current, ...message.payload, matchId: message.payload.matchId || resolvedMatchId }));
        }
      },
      onError(error) {
        console.error('Game socket error:', error);
      },
    });

    return () => {
      isMounted = false;
      gameSocket.disconnect();
    };
  }, [location.state, navigate, resolvedMatchId, routeMatchId]);

  const players = useMemo(
    () => (Array.isArray(gameState.players) && gameState.players.length ? gameState.players : mockGameState.players),
    [gameState.players]
  );
  const topPlayer = players.find((player) => player.position === 'top') || mockGameState.players[0];
  const leftPlayer = players.find((player) => player.position === 'left') || mockGameState.players[1];
  const rightPlayer = players.find((player) => player.position === 'right') || mockGameState.players[2];

  // Change this value from the backend later: 'left' = Stevie / user, 'top' = Bunbun, 'right' = Kiki.
  const activeTurnPosition = gameState.activeTurnPosition || gameState.currentTurnPosition || gameState.turnPosition || 'left';
  const isUserTurn = activeTurnPosition === 'left';
  const activeTurnName = activeTurnPosition === 'top'
    ? (topPlayer.name === 'BUNBUN' ? 'Bunbun' : topPlayer.name)
    : activeTurnPosition === 'right'
      ? rightPlayer.name
      : 'Your';
  const activeTurnLabel = isUserTurn ? t('yourTurn') : `${activeTurnName}${t('turnSuffix')}`;

  const playerHandTiles = getFirstTileList(
    gameState.handTiles,
    gameState.playerHand,
    gameState.myHand,
    gameState.currentPlayerHand,
    getPlayerTileList(leftPlayer, 'handTiles', 'hand', 'tiles')
  );
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
  const availableActions = getAvailableActions(gameState);

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

  const handleMahjongAction = async (actionKey) => {
    setSelectedAction(actionKey);
    await sendGameAction(gameState.matchId || resolvedMatchId, { type: actionKey });
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
            >
              <GameplayTile name={tile} />
            </button>
          ))}
        </div>
      </main>

      <nav className={`gameplay-actions ${isUserTurn ? 'player-turn' : 'waiting-turn'}`} aria-label={t('mahjongActions')}>
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
              disabled={!isUserTurn}
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

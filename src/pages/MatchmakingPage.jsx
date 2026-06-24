import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { getStoredAuthUser } from '../services/authService.js';
import { clearMatchmakingContext, getMatchmakingContext, saveActiveMatch } from '../store/gameStore.js';
import { connectGameSocket, disconnectGameSocket, startPrivateGame } from '../services/socket.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/matchmaking/${name}`;
const DEFAULT_TIER_ID = ''; // No hardcoded tier. Real tierId must come from backend room tier selection.

const PROFILE_ASSET_ROOT = '/assets/profile/';
const PROFILE_AVATAR_STORAGE_KEY = 'sakura_profile_avatar';
const DEFAULT_PROFILE_AVATAR = 'ICO.png';
const GUEST_PLAYER_ID_STORAGE_KEY = 'sakura_guest_player_id';

function getStableGuestPlayerId() {
  try {
    const existingId = window.sessionStorage.getItem(GUEST_PLAYER_ID_STORAGE_KEY);
    if (existingId) return existingId;

    const nextId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(GUEST_PLAYER_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `guest_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function getStoredProfileAvatar() {
  try {
    return window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function getCurrentPlayerIdentity() {
  const storedUser = getStoredAuthUser() || {};
  const storedAvatar = getStoredProfileAvatar();

  return {
    id: storedUser.id || storedUser.userId || storedUser._id || getStableGuestPlayerId(),
    userId: storedUser.userId || storedUser.id || storedUser._id,
    name: storedUser.username || storedUser.name || storedUser.displayName || 'You',
    avatar: storedAvatar || storedUser.avatarUrl || storedUser.imageUrl || storedUser.avatar || storedUser.avatarId || DEFAULT_PROFILE_AVATAR,
  };
}

const normalizeId = (value) => String(value ?? '').trim();

function getPlayerIds(player = {}) {
  return [player.id, player._id, player.userId, player.playerId, player.uid, player.socketId, player.clientId]
    .map(normalizeId)
    .filter(Boolean);
}

function playersShareIdentity(player, ids = []) {
  if (!player || !ids.length) return false;
  return getPlayerIds(player).some((id) => ids.includes(id));
}

function isSearchingPlaceholder(player = {}) {
  const id = normalizeId(player.id || player.userId || player.playerId).toLowerCase();
  const name = normalizeId(player.name || player.username || player.displayName).toLowerCase();
  const avatar = normalizeId(player.avatar || player.avatarUrl || player.avatarId).toLowerCase();

  return Boolean(player.isSearching)
    || id.startsWith('searching_')
    || name === 'searching'
    || avatar.includes('icon_02_searching');
}

function normalizeLobbyPlayer(player = {}, index = 0) {
  const normalized = {
    ...player,
    id: player.id || player.userId || player._id || player.playerId || player.uid || `player_${index + 1}`,
    userId: player.userId || player.id || player._id || player.playerId || player.uid,
    name: player.name || player.username || player.displayName || player.nickname || player.email || (player.isSearching ? 'Searching' : `Player ${index + 1}`),
    username: player.username || player.name || player.displayName || player.nickname,
    avatar: player.avatar || player.avatarUrl || player.avatarId || player.imageUrl || player.photoUrl || player.icon,
  };

  const placeholder = isSearchingPlaceholder(normalized);
  return {
    ...normalized,
    ready: placeholder ? false : Boolean(player.ready ?? player.isReady ?? true),
    isSearching: placeholder,
  };
}

function getRealLobbyPlayers(players = []) {
  return (Array.isArray(players) ? players : [])
    .map(normalizeLobbyPlayer)
    .filter((player) => !isSearchingPlaceholder(player));
}

function getProfileAvatarSrc(avatar) {
  if (typeof avatar !== 'string' || !avatar.trim()) {
    return `${PROFILE_ASSET_ROOT}${DEFAULT_PROFILE_AVATAR}`;
  }

  const value = avatar.trim();

  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) {
    return value;
  }

  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(value)) {
    return `${PROFILE_ASSET_ROOT}${value}`;
  }

  const avatarMap = {
    stevie: 'avatar-stevie.png',
    kiki: 'avatar-kiki.png',
    bunbun: 'avatar-bunbun.png',
    panda: 'avatar-panda.png',
  };

  return `${PROFILE_ASSET_ROOT}${avatarMap[value] || DEFAULT_PROFILE_AVATAR}`;
}

function getMatchAvatarSrc(player) {
  if (player?.isCurrentPlayer) {
    return getProfileAvatarSrc(player.avatar);
  }

  const avatar = player?.avatar;

  if (typeof avatar === 'string' && avatar.trim()) {
    const value = avatar.trim();

    if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) {
      return value;
    }

    if (/^(avatar-|ICO\.png)/i.test(value)) {
      return getProfileAvatarSrc(value);
    }

    return asset(value);
  }

  return asset('icon_02_searching.png');
}

function createFrontendSession(context) {
  const currentPlayer = getCurrentPlayerIdentity();
  const maxPlayers = Math.max(2, Math.min(Number(context.maxPlayers) || 2, 4));

  return {
    id: context.roomId || context.roomCode || 'socket_matchmaking',
    sessionId: context.roomId || context.roomCode || 'socket_matchmaking',
    status: context.roomCode ? 'waiting' : 'searching',
    roomId: context.roomId,
    roomCode: context.roomCode,
    tierId: context.tierId,
    maxPlayers,
    socketMode: true,
    isHost: Boolean(context.isHost),
    players: Array.from({ length: maxPlayers }, (_, index) => (
      index === 0
        ? {
          id: currentPlayer.id,
          name: currentPlayer.name,
          username: currentPlayer.name,
          avatar: currentPlayer.avatar,
          ready: true,
          isCurrentPlayer: true,
          isHost: Boolean(context.isHost),
        }
        : {
          id: `searching_${index}`,
          name: 'Searching',
          username: 'Searching',
          avatar: 'icon_02_searching.png',
          ready: false,
          isSearching: true,
        }
    )),
  };
}

function mergeCurrentPlayerIntoSession(session, context) {
  const fallbackSession = createFrontendSession(context);
  const currentPlayer = getCurrentPlayerIdentity();
  const currentIds = getPlayerIds(currentPlayer);
  const incomingPlayers = Array.isArray(session?.players) && session.players.length
    ? session.players.map(normalizeLobbyPlayer)
    : fallbackSession.players.map(normalizeLobbyPlayer);

  const maxPlayers = Math.max(2, Math.min(Number(session?.maxPlayers || context.maxPlayers) || 2, 4));
  const realIncomingPlayers = incomingPlayers.filter((player) => !isSearchingPlaceholder(player));
  const currentFromBackend = realIncomingPlayers.find((player) => player.isCurrentPlayer || player.isMe || player.isSelf || playersShareIdentity(player, currentIds));
  const normalizedCurrentPlayer = normalizeLobbyPlayer({
    ...currentPlayer,
    ...(currentFromBackend || {}),
    name: currentFromBackend?.name || currentFromBackend?.username || currentPlayer.name,
    avatar: currentFromBackend?.avatar || currentPlayer.avatar,
    ready: true,
    isCurrentPlayer: true,
    isHost: Boolean(context.isHost || currentFromBackend?.isHost || currentFromBackend?.host),
  }, 0);

  const otherPlayers = realIncomingPlayers
    .filter((player) => !playersShareIdentity(player, getPlayerIds(normalizedCurrentPlayer)))
    .map((player) => ({ ...player, isCurrentPlayer: false, ready: Boolean(player.ready ?? true) }));

  const players = [normalizedCurrentPlayer, ...otherPlayers].slice(0, maxPlayers);

  while (players.length < maxPlayers) {
    const fallbackPlayer = fallbackSession.players[players.length];
    players.push(fallbackPlayer);
  }

  return {
    ...fallbackSession,
    ...(session || {}),
    players,
  };
}

function AnimatedDots({ base, className = '' }) {
  const [dotCount, setDotCount] = useState(3);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((current) => (current === 3 ? 1 : current + 1));
    }, 430);

    return () => window.clearInterval(timer);
  }, []);

  return <span className={className}>{base}{'.'.repeat(dotCount)}</span>;
}

function PlayerSlot({ variant, avatar, name, ready, isCurrentPlayer = false, delay = 0, t }) {
  return (
    <article className={`match-slot match-slot-${variant}`} style={{ '--slot-delay': `${delay}ms` }}>
      <div className="match-avatar-wrap">
        <img src={getMatchAvatarSrc({ avatar, isCurrentPlayer })} alt="" />
      </div>
      <h2>{name}</h2>
      {ready ? (
        <p className="match-ready"><span>✓</span>{t('ready')}</p>
      ) : (
        <p className="match-searching"><AnimatedDots base={t('searching')} /></p>
      )}
    </article>
  );
}

function getRequestedMatchmakingContext(locationState) {
  const storedContext = getMatchmakingContext() || {};

  return {
    roomId: locationState?.roomId || storedContext.roomId || '',
    roomCode: locationState?.roomCode || storedContext.roomCode || null,
    tierId: locationState?.tierId || storedContext.tierId || DEFAULT_TIER_ID,
    maxPlayers: Number(locationState?.maxPlayers || storedContext.maxPlayers) || 2,
    source: locationState?.source || storedContext.source || 'unknown',
    isHost: Boolean(locationState?.isHost ?? storedContext.isHost),
  };
}

export default function MatchmakingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const location = useLocation();
  const [seconds, setSeconds] = useState(12);
  const initialContext = getRequestedMatchmakingContext(location.state);
  const [session, setSession] = useState(() => createFrontendSession(initialContext));
  const latestSessionRef = useRef(session);
  const [errorMessage, setErrorMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    let gameWasStarted = false;
    const context = getRequestedMatchmakingContext(location.state);

    setSession(createFrontendSession(context));
    setErrorMessage('');
    setConnectionStatus('connecting');

    const intervalId = window.setInterval(() => {
      setSeconds((current) => (current >= 59 ? 0 : current + 1));
    }, 1000);

    const responseTimeoutId = window.setTimeout(() => {
      if (isMounted && !gameWasStarted) {
        setErrorMessage('Connected, but the gameplay server has not returned a lobby event yet.');
      }
    }, 18000);

    const updateLobbySession = (payload = {}) => {
      if (!isMounted || gameWasStarted) return;

      lobbyEventReceived = true;
      window.clearTimeout(joinRetryId);
      window.clearTimeout(joinSecondRetryId);
      window.clearTimeout(controllerJoinGuardId);
      setConnectionStatus(payload.status || 'waiting');
      setErrorMessage('');
      window.clearTimeout(responseTimeoutId);

      setSession((currentSession) => {
        const nextSession = mergeCurrentPlayerIntoSession({
          ...currentSession,
          ...payload,
          id: payload.roomId || payload.id || currentSession?.id || context.roomId,
          sessionId: payload.roomId || payload.sessionId || currentSession?.sessionId || context.roomId,
          roomId: payload.roomId || currentSession?.roomId || context.roomId,
          roomCode: payload.roomCode || currentSession?.roomCode || context.roomCode,
          tierId: payload.tierId || currentSession?.tierId || context.tierId,
          maxPlayers: payload.maxPlayers || currentSession?.maxPlayers || context.maxPlayers,
          status: payload.status || currentSession?.status || 'searching',
          players: payload.players || currentSession?.players,
          hostUserId: payload.hostUserId || currentSession?.hostUserId,
          isHost: context.isHost || payload.isHost || currentSession?.isHost,
        }, context);

        latestSessionRef.current = nextSession;
        return nextSession;
      });
    };

    const openGame = (payload = {}) => {
      if (!isMounted || gameWasStarted) return;

      const matchId = payload.matchId || payload.gameId || payload.id || payload.roomId || context.roomId || context.roomCode || 'live_match';
      const latestSession = latestSessionRef.current || createFrontendSession(context);
      const payloadPlayers = getRealLobbyPlayers(payload.players);
      const sessionPlayers = getRealLobbyPlayers(latestSession.players);
      const realPlayers = payloadPlayers.length ? payloadPlayers : sessionPlayers;
      lobbyEventReceived = true;
      gameWasStarted = true;
      window.clearTimeout(responseTimeoutId);
      window.clearTimeout(joinRetryId);
      window.clearTimeout(joinSecondRetryId);
      window.clearTimeout(controllerJoinGuardId);
      setConnectionStatus('starting');
      clearMatchmakingContext();
      saveActiveMatch({
        matchId,
        roomId: payload.roomId || context.roomId,
        roomCode: payload.roomCode || context.roomCode,
        tierId: payload.tierId || context.tierId,
        maxPlayers: payload.maxPlayers || latestSession.maxPlayers || context.maxPlayers,
        players: realPlayers,
        initialGameState: {
          ...payload,
          players: realPlayers,
          maxPlayers: payload.maxPlayers || latestSession.maxPlayers || context.maxPlayers,
          myPlayerId: getCurrentPlayerIdentity().id,
        },
        socketMode: true,
      });

      window.setTimeout(() => {
        if (isMounted) {
          navigate(buildGameRoute(matchId), {
            state: {
              matchId,
              roomId: payload.roomId || context.roomId,
              roomCode: payload.roomCode || context.roomCode,
              maxPlayers: payload.maxPlayers || latestSession.maxPlayers || context.maxPlayers,
              players: realPlayers,
              initialGameState: {
                ...payload,
                players: realPlayers,
                maxPlayers: payload.maxPlayers || latestSession.maxPlayers || context.maxPlayers,
                myPlayerId: getCurrentPlayerIdentity().id,
              },
              socketMode: true,
            },
          });
        }
      }, 450);
    };

    const handleSocketMessage = (message) => {
      const payload = message?.payload || {};

      switch (message?.type) {
        case 'queue_joined':
          updateLobbySession({ ...payload, status: payload.status || 'searching' });
          break;
        case 'private_joined':
          updateLobbySession({ ...payload, status: payload.status || 'waiting' });
          break;
        case 'room_state_update':
          updateLobbySession({ ...payload, status: payload.status || 'waiting' });
          break;
        case 'game_start':
          openGame(payload);
          break;
        case 'error':
          if (isMounted) {
            setConnectionStatus('error');
            setErrorMessage(payload.message || payload.error || 'Socket error. Please try again.');
          }
          break;
        default:
          break;
      }
    };

    let lobbyEventReceived = false;
    let joinRetryId = null;
    let joinSecondRetryId = null;
    let controllerJoinGuardId = null;
    let socket = null;

    const emitRoomJoin = (rawSocket = null) => {
      const code = String(context.roomCode || '').trim();
      const eventName = 'room:join';
      const tierId = String(context.tierId || '').trim();
      const payload = code
        ? { roomCode: code }
        : tierId
          ? { tierId }
          : null;

      if (!payload) {
        console.error('[matchmaking] room:join blocked: missing tierId/roomCode', context);
        if (isMounted) {
          setConnectionStatus('error');
          setErrorMessage('Missing tierId or roomCode. Select a real backend room tier first.');
        }
        return false;
      }

      let joined = false;

      if (rawSocket?.connected && typeof rawSocket.emit === 'function') {
        rawSocket.emit(eventName, payload);
        joined = true;
      } else if (socket?.raw?.connected && typeof socket.raw.emit === 'function') {
        socket.raw.emit(eventName, payload);
        joined = true;
      } else if (socket?.connected && typeof socket.emit === 'function') {
        joined = Boolean(socket.emit(eventName, payload));
      }

      console.info('[matchmaking] emit room:join', payload, {
        joined,
        rawConnected: Boolean(rawSocket?.connected),
        controllerConnected: Boolean(socket?.connected),
        hasRaw: Boolean(socket?.raw),
      });

      if (!joined && isMounted) {
        setConnectionStatus('connected');
        setErrorMessage('Socket connected, waiting to send room:join...');
        return false;
      }

      return true;
    };

    const joinRequestedRoom = (rawSocket = null) => {
      const code = String(context.roomCode || '').trim();
      setConnectionStatus(code ? 'joining_private' : 'searching');
      emitRoomJoin(rawSocket);

      // Safety retry: the socket can connect before React's controller state is visible in DevTools.
      // If no lobby event comes back, send room:join again so the backend definitely receives it.
      window.clearTimeout(joinRetryId);
      window.clearTimeout(joinSecondRetryId);
      window.clearTimeout(controllerJoinGuardId);

      joinRetryId = window.setTimeout(() => {
        if (isMounted && !gameWasStarted && !lobbyEventReceived) {
          emitRoomJoin(rawSocket);
        }
      }, 1500);

      joinSecondRetryId = window.setTimeout(() => {
        if (isMounted && !gameWasStarted && !lobbyEventReceived) {
          emitRoomJoin(rawSocket);
        }
      }, 5000);
    };

    socket = connectGameSocket({
      onOpen: (rawSocket) => {
        if (!isMounted) return;
        setConnectionStatus('connected');
        joinRequestedRoom(rawSocket);
      },
      onMessage: handleSocketMessage,
      onError: (error) => {
        console.error('Game socket failed:', error);
        if (isMounted) {
          setConnectionStatus('error');
          setErrorMessage(error?.message || 'Unable to connect to gameplay server.');
        }
      },
      onClose: () => {
        if (isMounted && !gameWasStarted) {
          setConnectionStatus('disconnected');
          setErrorMessage('Gameplay socket disconnected. Reconnecting if the server allows it.');
        }
      },
    });

    // Extra guard: if the connect callback was missed because of a hot reload or StrictMode remount,
    // still send room:join on the active connected controller.
    controllerJoinGuardId = window.setTimeout(() => {
      if (isMounted && !gameWasStarted && !lobbyEventReceived && socket?.raw?.connected) {
        joinRequestedRoom(socket.raw);
      }
    }, 800);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.clearTimeout(responseTimeoutId);
      window.clearTimeout(joinRetryId);
      window.clearTimeout(joinSecondRetryId);
      window.clearTimeout(controllerJoinGuardId);

      if (!gameWasStarted) {
        socket?.disconnect?.();
      }
    };
  }, [location.state, navigate]);

  const currentContext = getRequestedMatchmakingContext(location.state);
  const canStartPrivateGame = Boolean(currentContext.isHost && (session.roomId || currentContext.roomId));

  const handleStartPrivateGame = () => {
    const roomId = session.roomId || currentContext.roomId;

    if (!roomId) {
      setConnectionStatus('error');
      setErrorMessage('Room ID is missing. Wait for the private lobby event before starting.');
      return;
    }

    setConnectionStatus('starting');
    const started = startPrivateGame(roomId);

    if (!started) {
      setConnectionStatus('error');
      setErrorMessage('Unable to start private game. Waiting for socket connection.');
    }
  };

  const waitTime = useMemo(() => `00:${String(seconds).padStart(2, '0')}`, [seconds]);
  const statusText = errorMessage || {
    connecting: 'Connecting to gameplay server...',
    connected: 'Connected. Joining lobby...',
    joining_private: 'Joining private lobby...',
    searching: t('pleaseWaitMatch'),
    waiting: t('pleaseWaitMatch'),
    starting: 'Starting game...',
    disconnected: 'Gameplay socket disconnected. Reconnecting...',
  }[connectionStatus] || t('pleaseWaitMatch');

  return (
    <section className="matchmaking-screen">
      <img className="match-bg" src={asset('BG.png')} alt="" />
      <div className="match-vignette" aria-hidden="true" />

      <header className="matchmaking-header">
        <button type="button" className="match-back-button" onClick={() => navigate(ROUTES.mainMenu)} aria-label={t('backToMainMenu')}>
          ←
        </button>
        <h1>{t('matchmakingTitle')}</h1>
      </header>

      <main className="matchmaking-content">
        <div className="matchmaking-title-block">
          <h2><AnimatedDots base={t('findingPlayers')} /></h2>
          <p>{statusText}</p>
        </div>

        <section className="match-slots" aria-label={t('matchmaking')}>
          <div className="match-line" aria-hidden="true" />
          {(session.players?.length ? session.players : createFrontendSession(initialContext).players).map((player, index) => (
            <PlayerSlot
              key={player.id || `${player.name}-${index}`}
              variant={player.isCurrentPlayer ? 'current' : player.ready ? 'ready' : 'search'}
              avatar={player.avatar}
              name={player.name}
              ready={player.ready}
              isCurrentPlayer={player.isCurrentPlayer}
              delay={index * 110}
              t={t}
            />
          ))}
        </section>

        <div className="match-wait-time">
          <span>{t('estimatedWait')}</span>
          <strong>{waitTime}</strong>
        </div>

        {canStartPrivateGame && (
          <button
            type="button"
            className="match-start-button"
            onClick={handleStartPrivateGame}
          >
            START GAME
          </button>
        )}

        <button
          type="button"
          className="match-cancel-button"
          onClick={() => {
            disconnectGameSocket();
            clearMatchmakingContext();
            navigate(ROUTES.mainMenu);
          }}
        >
          {t('cancel')}
        </button>
      </main>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { cancelMatchmaking, getMatchmakingStatus, startMatchmaking } from '../services/matchmakingService.js';
import { getStoredAuthUser } from '../services/authService.js';
import { clearMatchmakingContext, getMatchmakingContext, saveActiveMatch } from '../store/gameStore.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/matchmaking/${name}`;

const PROFILE_ASSET_ROOT = '/assets/profile/';
const PROFILE_AVATAR_STORAGE_KEY = 'sakura_profile_avatar';
const DEFAULT_PROFILE_AVATAR = 'ICO.png';

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
    id: storedUser.id || storedUser.userId || storedUser._id || 'current_player',
    name: storedUser.username || storedUser.name || storedUser.displayName || 'You',
    avatar: storedAvatar || storedUser.avatarUrl || storedUser.imageUrl || storedUser.avatar || storedUser.avatarId || DEFAULT_PROFILE_AVATAR,
  };
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
  const maxPlayers = Math.max(2, Math.min(Number(context.maxPlayers) || 3, 3));

  return {
    id: 'frontend_matchmaking_fallback',
    sessionId: 'frontend_matchmaking_fallback',
    status: 'searching',
    roomId: context.roomId,
    roomCode: context.roomCode,
    tierId: context.tierId,
    maxPlayers,
    backendFallback: true,
    players: Array.from({ length: maxPlayers }, (_, index) => (
      index === 0
        ? {
          id: currentPlayer.id,
          name: currentPlayer.name,
          username: currentPlayer.name,
          avatar: currentPlayer.avatar,
          ready: true,
          isCurrentPlayer: true,
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
  const incomingPlayers = Array.isArray(session?.players) && session.players.length
    ? session.players
    : fallbackSession.players;

  const maxPlayers = Math.max(2, Math.min(Number(session?.maxPlayers || context.maxPlayers) || 3, 3));
  const players = Array.from({ length: maxPlayers }, (_, index) => {
    if (index === 0) {
      return fallbackSession.players[0];
    }

    const incomingPlayer = incomingPlayers[index];

    if (incomingPlayer && !incomingPlayer.isCurrentPlayer && !incomingPlayer.isSearching && incomingPlayer.name !== 'Searching') {
      return incomingPlayer;
    }

    return fallbackSession.players[index];
  });

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
  return {
    roomId: locationState?.roomId || getMatchmakingContext()?.roomId || 'quick_match',
    roomCode: locationState?.roomCode || getMatchmakingContext()?.roomCode || null,
    tierId: locationState?.tierId || getMatchmakingContext()?.tierId || null,
    maxPlayers: locationState?.maxPlayers || getMatchmakingContext()?.maxPlayers || 3,
    source: locationState?.source || getMatchmakingContext()?.source || 'quick_match',
  };
}

export default function MatchmakingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const location = useLocation();
  const [seconds, setSeconds] = useState(12);
  const initialContext = getRequestedMatchmakingContext(location.state);
  const [session, setSession] = useState(() => createFrontendSession(initialContext));
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    let activeSessionId = null;
    let matchWasFound = false;
    let statusTimerId = null;
    const context = getRequestedMatchmakingContext(location.state);
    setSession(createFrontendSession(context));
    setErrorMessage('');

    const intervalId = window.setInterval(() => {
      setSeconds((current) => (current >= 59 ? 0 : current + 1));
    }, 1000);

    const openGameWhenReady = (status) => {
      if (!isMounted || !status) {
        return;
      }

      setSession(mergeCurrentPlayerIntoSession(status, context));

      if (!status.matchId) {
        return;
      }

      matchWasFound = true;
      clearMatchmakingContext();
      saveActiveMatch({
        matchId: status.matchId,
        sessionId: status.id || status.sessionId || activeSessionId,
        roomId: status.roomId || context.roomId,
        players: status.players,
      });

      window.setTimeout(() => {
        if (isMounted) {
          navigate(buildGameRoute(status.matchId), {
            state: {
              matchId: status.matchId,
              roomId: status.roomId || context.roomId,
            },
          });
        }
      }, 700);
    };

    const pollStatus = () => {
      if (!activeSessionId || matchWasFound) {
        return;
      }

      getMatchmakingStatus(activeSessionId, context)
        .then(openGameWhenReady)
        .catch((error) => {
          console.error('Matchmaking status failed:', error);
          if (isMounted) {
            setSession(createFrontendSession(context));
            setErrorMessage('');
          }
        });
    };


    startMatchmaking({
      roomId: context.roomId,
      roomCode: context.roomCode,
      tierId: context.tierId,
      maxPlayers: context.maxPlayers,
      source: context.source,
    })
      .then((createdSession) => {
        if (!isMounted) {
          return;
        }

        activeSessionId = createdSession.id || createdSession.sessionId;
        openGameWhenReady(createdSession);

        if (!createdSession.matchId && activeSessionId) {
          pollStatus();
          statusTimerId = window.setInterval(pollStatus, 2000);
        }
      })
      .catch((error) => {
        console.error('Matchmaking failed:', error);
        if (isMounted) {
          setSession(createFrontendSession(context));
          setErrorMessage('');
        }
      });

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      if (statusTimerId) {
        window.clearInterval(statusTimerId);
      }

      if (activeSessionId && !matchWasFound) {
        cancelMatchmaking(activeSessionId).catch(() => {});
      }
    };
  }, [location.state, navigate, t]);

  const waitTime = useMemo(() => `00:${String(seconds).padStart(2, '0')}`, [seconds]);

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
          <p>{errorMessage || t('pleaseWaitMatch')}</p>
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

        <button
          type="button"
          className="match-cancel-button"
          onClick={async () => {
            if (session?.id || session?.sessionId) {
              await cancelMatchmaking(session.id || session.sessionId);
            }

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

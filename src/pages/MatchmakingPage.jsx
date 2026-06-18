import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, buildGameRoute } from '../router/routes.js';
import { cancelMatchmaking, getMatchmakingStatus, startMatchmaking } from '../services/matchmakingService.js';
import { mockMatchmakingSession } from '../mocks/mockMatchmaking.js';
import { clearMatchmakingContext, getMatchmakingContext, saveActiveMatch } from '../store/gameStore.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/matchmaking/${name}`;

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

function PlayerSlot({ variant, avatar, name, ready, delay = 0, t }) {
  return (
    <article className={`match-slot match-slot-${variant}`} style={{ '--slot-delay': `${delay}ms` }}>
      <div className="match-avatar-wrap">
        <img src={asset(avatar)} alt="" />
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
  const [session, setSession] = useState(mockMatchmakingSession);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    let activeSessionId = null;
    let matchWasFound = false;
    const context = getRequestedMatchmakingContext(location.state);

    const intervalId = window.setInterval(() => {
      setSeconds((current) => (current >= 59 ? 0 : current + 1));
    }, 1000);

    startMatchmaking({
      roomId: context.roomId,
      roomCode: context.roomCode,
      tierId: context.tierId,
      maxPlayers: context.maxPlayers,
      source: context.source,
    })
      .then((createdSession) => {
        if (!isMounted) {
          return null;
        }

        activeSessionId = createdSession.id || createdSession.sessionId;
        setSession(createdSession);

        if (createdSession.matchId) {
          return createdSession;
        }

        return getMatchmakingStatus(activeSessionId);
      })
      .then((status) => {
        if (!isMounted || !status) {
          return;
        }

        setSession(status);

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
      })
      .catch((error) => {
        console.error('Matchmaking failed:', error);
        if (isMounted) {
          setErrorMessage(error.message || t('matchmakingFailed'));
        }
      });

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);

      if (activeSessionId && !matchWasFound) {
        cancelMatchmaking(activeSessionId).catch(() => {});
      }
    };
  }, [location.state, navigate]);

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
          {(session.players?.length ? session.players : mockMatchmakingSession.players).map((player, index) => (
            <PlayerSlot
              key={player.id || `${player.name}-${index}`}
              variant={player.ready ? 'ready' : 'search'}
              avatar={player.avatar}
              name={player.name}
              ready={player.ready}
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

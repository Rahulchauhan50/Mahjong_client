import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { clearActiveMatch, getActiveMatch, saveMatchmakingContext } from '../store/gameStore.js';
import { useLanguage } from '../i18n/useLanguage.js';
import { getGameResult } from '../services/gameService.js';
import { normalizeGameResult } from '../services/gameNormalizers.js';

const asset = (name) => `/assets/win-screen/${name}`;

const EMPTY_RESULT = {
  matchId: '',
  result: '',
  title: 'Result unavailable',
  winner: null,
  players: [],
  summaryRows: [],
  totalScore: '',
};
function formatScore(value, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toLocaleString('en-US')}`;
  }
  return String(value);
}

function resolveAvatarSrc(avatar, fallback = 'ic1.png') {
  const value = avatar || fallback;

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return value;
  }

  return asset(value);
}

function translateMaybe(t, value) {
  if (!value) return '';
  const translated = t(value);
  return translated === value ? value : translated;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const location = useLocation();
  const activeMatch = getActiveMatch();
  const matchId = location.state?.matchId || activeMatch?.matchId;
  const [resultState, setResultState] = useState(() => normalizeGameResult(location.state?.result || location.state || EMPTY_RESULT));
  const [isLoading, setIsLoading] = useState(Boolean(matchId));

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      if (!matchId) {
        setIsLoading(false);
        return;
      }

      try {
        const serverResult = await getGameResult(matchId);
        if (!cancelled) {
          setResultState(serverResult);
        }
      } catch (error) {
        console.warn('Failed to load game result:', error);
        if (!cancelled) {
          setResultState((current) => normalizeGameResult({
            ...(current || EMPTY_RESULT),
            matchId,
            title: current?.title || 'Result unavailable',
          }));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadResult();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const result = useMemo(() => normalizeGameResult(resultState || EMPTY_RESULT), [resultState]);
  const winner = result.winner || result.players.find((player) => player.isWinner) || null;
  const losers = result.players.filter((player) => player.id !== winner?.id && !player.isWinner);
  const summaryRows = result.summaryRows.length ? result.summaryRows : [];
  const totalScore = result.totalScore !== undefined && result.totalScore !== null && result.totalScore !== '' ? formatScore(result.totalScore ?? winner?.score, '0') : '';
  const didCurrentUserWin = result.result && result.result !== 'lose' && result.result !== 'loss' && result.result !== 'defeat';
  const hasResultPlayers = Boolean(winner || result.players.length);

  return (
    <section className="win-screen" aria-label="Round result win screen">
      <img className="win-screen-bg" src={asset('BG.png')} alt="" />
      <div className="win-screen-vignette" aria-hidden="true" />

      <header className='win-header lui-0221aed4'>      </header>

      <main className="win-content">
        <h2 className="win-title">{isLoading ? t('loading') : (result.title || (result.titleKey ? t(result.titleKey) : didCurrentUserWin ? t('youWin') : 'Result unavailable'))}</h2>

        <section className="win-layout" aria-label="Win screen details">
          <section className="winner-panel" aria-label="Player results">
            {hasResultPlayers ? (
              <>
                <div className="winner-main-row">
                  <img className='winner-avatar lui-c8bd0ff4' src={resolveAvatarSrc(winner?.avatar, 'ic1.png')} alt={`${winner?.name || 'Winner'} avatar`} />

                  <div className="winner-info">
                    <strong className='winner-name lui-3a1371cc'>{winner?.name || 'Winner'}</strong>
                    <span className='winner-score lui-28150694'>{formatScore(winner?.score ?? winner?.scoreDelta, '+0')}</span>
                    <em className='winner-badge lui-208c9614'>{t('winner')}</em>
                  </div>
                </div>

                <div className="loser-list">
                  {losers.map((player, index) => (
                    <article className="loser-row" key={player.id || player.name || index}>
                      <img className='loser-avatar lui-95d32e6f' src={resolveAvatarSrc(player.avatar, index === 0 ? 'ic2.png' : 'ic3.png')} alt={`${player.name} avatar`} />
                      <strong className='loser-name lui-f155ac3b'>{player.name}</strong>
                      <span className="loser-score">{formatScore(player.score ?? player.scoreDelta, '0')}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="winner-info">
                <strong className='winner-name lui-3a1371cc'>Waiting for backend result</strong>
              </div>
            )}
          </section>

          <section className="round-summary-panel" aria-label="Round summary">
            <div className="summary-panel-content">
              <h3 className='lui-6395eacc'><span>✽</span> {t('roundSummary')} <span>✽</span></h3>
              <div className="summary-divider" aria-hidden="true" />

              <div className="summary-rows">
                {summaryRows.map((row, index) => (
                  <div className="summary-row" key={`${row.labelKey || row.label || index}-${row.value}`}>
                    <span>{row.labelKey ? t(row.labelKey) : row.label}</span>
                    <strong className='lui-be221808'>{row.valueKey ? t(row.valueKey) : translateMaybe(t, row.value)}</strong>
                  </div>
                ))}
              </div>

              <div className="summary-footer-divider" aria-hidden="true"><span>✽</span></div>
              <div className="summary-total">
                <strong className='lui-613d8f20'>{t('totalScore')}</strong>
                <span className='summary-total-value lui-8d5746d0'>
                  <span className="summary-coin" aria-hidden="true">✿</span>
                  {String(totalScore || '0').replace(/^\+/, '')}
                </span>
              </div>
            </div>
          </section>
        </section>

        <footer className="win-actions">
          <button
            type="button"
            className="win-image-button lobby"
            onClick={() => {
              clearActiveMatch();
              navigate(ROUTES.mainMenu);
            }}
          >
            {t('backToMainMenuCaps')}
          </button>

          <button
            type="button"
            className="win-image-button again lui-85f70a04"
            onClick={() => {
              saveMatchmakingContext({
                roomId: activeMatch?.roomId || result.roomId || 'quick_match',
                maxPlayers: activeMatch?.maxPlayers || result.maxPlayers || 3,
                source: 'play-again',
                previousMatchId: matchId || result.matchId,
              });
              navigate(ROUTES.matchmaking, {
                state: {
                  roomId: activeMatch?.roomId || result.roomId || 'quick_match',
                  maxPlayers: activeMatch?.maxPlayers || result.maxPlayers || 3,
                  source: 'play-again',
                  previousMatchId: matchId || result.matchId,
                },
              });
            }}
          >
            {t('playAgain')}
          </button>
        </footer>
      </main>
    </section>
  );
}

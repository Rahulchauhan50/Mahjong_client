import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { saveMatchmakingContext } from '../store/gameStore.js';
import { isMockApiEnabled } from '../services/api.js';
import { useLanguage } from '../i18n/useLanguage.js';

const MAX_ROOM_PLAYERS = 3;

const recentRooms = [
  { id: 'ld_4729', code: 'LD-4729', name: 'Emma’s Room', players: 2, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_2814', code: 'LD-2814', name: 'Noah’s Room', players: 1, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_9031', code: 'LD-9031', name: 'Luca’s Room', players: 1, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_3142', code: 'LD-3142', name: 'Sakura Garden', players: 2, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_8851', code: 'LD-8851', name: 'Lucky Bamboo', players: 1, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_9207', code: 'LD-9207', name: 'Dragon Pavilion', players: 2, maxPlayers: MAX_ROOM_PLAYERS },
  { id: 'ld_1620', code: 'LD-1620', name: 'Blossom Table', players: 1, maxPlayers: MAX_ROOM_PLAYERS },
];

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const { t, tx } = useLanguage();
  const [roomCode, setRoomCode] = useState(isMockApiEnabled() ? 'LD-4729' : '');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizedRoomCode = useMemo(() => roomCode.trim().toUpperCase(), [roomCode]);
  const visibleRecentRooms = isMockApiEnabled() ? recentRooms : [];

  const joinRoom = async (room) => {
    const requestedCode = room?.code || normalizedRoomCode;
    const fallbackRoomId = room?.id || requestedCode || 'joined_room';
    const maxPlayers = room?.maxPlayers || MAX_ROOM_PLAYERS;

    setErrorMessage('');
    setIsJoining(true);

    try {
      const matchmakingState = {
        roomId: fallbackRoomId,
        roomCode: requestedCode,
        maxPlayers,
        source: room ? 'join-room-list' : 'join-room-code',
        isHost: false,
      };

      saveMatchmakingContext(matchmakingState);
      navigate(ROUTES.matchmaking, { state: matchmakingState });
    } catch (error) {
      console.error('Join room failed:', error);
      setErrorMessage(error.message || t('joinRoomUnavailable'));
    } finally {
      setIsJoining(false);
    }
  };


  return (
    <section className="join-room-screen">
      <button type="button" className="join-room-back-button" onClick={() => navigate(ROUTES.mainMenu)} aria-label={t('backToMainMenu')}>
        ←
      </button>

      <header className="join-room-header">
        <h1>{t('joinRoom')}</h1>
        <p>{t('joinRoomPageText')}</p>
      </header>

      <main className="join-room-panel">
        <section className="join-room-code-panel" aria-label={t('roomCode')}>
          <h2>{t('roomCode')}</h2>

          <div className="join-room-code-entry">
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder={t('enterRoomCode')}
              aria-label={t('roomCode')}
              spellCheck="false"
            />
          </div>
        </section>

        <div className="join-room-divider"><span>{t('or')}</span></div>

        <section className="join-room-list-panel" aria-label={t('availableRooms')}>
          <h2>{t('recentRooms')}</h2>

          <div className="join-room-scroll-shell">
            <div className="join-room-list">
              {visibleRecentRooms.length ? visibleRecentRooms.map((room) => (
                <article className="join-room-row" key={room.id}>
                  <strong>{room.code}</strong>
                  <span>{tx(room.name)}</span>
                  <em>{room.players} / {room.maxPlayers}</em>
                  <button type="button" onClick={() => joinRoom(room)}>{t('join')}</button>
                </article>
              )) : (
                <article className="join-room-row">
                  <strong>API</strong>
                  <span>{t('joinRoomUnavailable')}</span>
                  <em>0 / 3</em>
                  <button type="button" disabled>{t('join')}</button>
                </article>
              )}
            </div>
          </div>
        </section>

        <p className="join-room-helper">✿ {errorMessage || t('validRoomCodeHint')} ✿</p>

        <div className="join-room-actions">
          <button type="button" className="join-room-primary-action" onClick={() => joinRoom(null)} disabled={!normalizedRoomCode || isJoining}>
            {isJoining ? t('connecting') : t('joinRoom')}
          </button>
          <button type="button" className="join-room-secondary-action" onClick={() => navigate(ROUTES.mainMenu)}>
            <span>←</span> {t('back')}
          </button>
        </div>
      </main>
    </section>
  );
}

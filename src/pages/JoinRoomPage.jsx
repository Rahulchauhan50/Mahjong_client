import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { saveMatchmakingContext } from '../store/gameStore.js';
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
  const [roomCode, setRoomCode] = useState('LD-4729');

  const normalizedRoomCode = useMemo(() => roomCode.trim().toUpperCase(), [roomCode]);

  const joinRoom = (room) => {
    const roomId = room?.id || normalizedRoomCode || 'joined_room';
    const maxPlayers = room?.maxPlayers || MAX_ROOM_PLAYERS;

    saveMatchmakingContext({ roomId, maxPlayers, source: room ? 'join-room-list' : 'join-room-code' });
    navigate(ROUTES.matchmaking, {
      state: { roomId, maxPlayers, source: room ? 'join-room-list' : 'join-room-code' },
    });
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
              {recentRooms.map((room) => (
                <article className="join-room-row" key={room.id}>
                  <strong>{room.code}</strong>
                  <span>{tx(room.name)}</span>
                  <em>{room.players} / {room.maxPlayers}</em>
                  <button type="button" onClick={() => joinRoom(room)}>{t('join')}</button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <p className="join-room-helper">✿ {t('validRoomCodeHint')} ✿</p>

        <div className="join-room-actions">
          <button type="button" className="join-room-primary-action" onClick={() => joinRoom(null)} disabled={!normalizedRoomCode}>
            {t('joinRoom')}
          </button>
          <button type="button" className="join-room-secondary-action" onClick={() => navigate(ROUTES.mainMenu)}>
            <span>←</span> {t('back')}
          </button>
        </div>
      </main>
    </section>
  );
}

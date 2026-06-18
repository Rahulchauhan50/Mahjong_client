import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import ScreenHeader from '../components/ScreenHeader.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import FlowNav from '../components/FlowNav.jsx';
import { getRooms, joinRoom } from '../services/roomService.js';
import { useLanguage } from '../i18n/useLanguage.js';

const fallbackRooms = [
  { name: 'Beginner Room', bet: '100 coins', status: 'Available' },
  { name: 'Classic Room', bet: '500 coins', status: 'Available' },
  { name: 'Expert Room', bet: '1,000 coins', status: 'Locked placeholder' },
];

export default function RoomSelectPage() {
  const navigate = useNavigate();
  const { t, tx } = useLanguage();
  const [rooms, setRooms] = useState(fallbackRooms);

  useEffect(() => {
    let isMounted = true;

    getRooms()
      .then((response) => {
        if (isMounted && response?.length) {
          setRooms(response);
        }
      })
      .catch((error) => console.error('Failed to load rooms:', error));

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectRoom = async (room) => {
    if (String(room.status || '').includes('Locked')) {
      return;
    }

    await joinRoom(room.roomId || room.tierId || room.id || room.name);
    navigate(ROUTES.matchmaking);
  };

  return (
    <section className="screen">
      <ScreenHeader
        eyebrow={t('lobby')}
        title={t('selectRoom')}
        description={t('roomDescription')}
      />

      <div className="room-grid">
        {rooms.map((room) => (
          <article className="room-card" key={room.name}>
            <h2>{tx(room.name)}</h2>
            <p>{tx(room.bet)}</p>
            <span>{tx(room.status)}</span>
            <PrimaryButton onClick={() => handleSelectRoom(room)} disabled={String(room.status || '').includes('Locked')}>
              {t('select')}
            </PrimaryButton>
          </article>
        ))}
      </div>

      <div className="split-actions">
        <PrimaryButton onClick={() => navigate(ROUTES.createRoom)}>{t('createRoom')}</PrimaryButton>
        <PrimaryButton variant="secondary" onClick={() => navigate(ROUTES.joinRoom)}>{t('joinRoom')}</PrimaryButton>
      </div>

      <FlowNav backTo={ROUTES.mainMenu} />
    </section>
  );
}

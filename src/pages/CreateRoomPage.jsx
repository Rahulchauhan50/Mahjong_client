import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { createPrivateRoom, getRoomTiers } from '../services/roomService.js';
import { saveMatchmakingContext } from '../store/gameStore.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/create-room/${name}`;

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { t, tx } = useLanguage();
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState('sakura_garden_3p');
  const [roomType, setRoomType] = useState('Private');
  const [roomName, setRoomName] = useState('My Sakura Room');
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);

  useEffect(() => {
    let isMounted = true;

    getRoomTiers()
      .then((roomTiers) => {
        if (!isMounted) return;
        setTiers(roomTiers || []);

        if (roomTiers?.[0]?.tierId) {
          setSelectedTierId(roomTiers[0].tierId);
          setMaxPlayers(roomTiers[0].maxPlayers || 3);
        }
      })
      .catch((error) => {
        console.error('Failed to load room tiers:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTier = useMemo(
    () => tiers.find((tier) => tier.tierId === selectedTierId) || tiers[0] || null,
    [selectedTierId, tiers]
  );

  const bet = selectedTier?.entryFee?.amount ?? 100;
  const formattedBet = useMemo(() => Number(bet || 0).toLocaleString('en-US'), [bet]);

  const handleCreateRoom = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsCreatingRoom(true);

    try {
      const room = await createPrivateRoom({
        tierId: selectedTierId || selectedTier?.tierId || 'sakura_garden_3p',
        maxPlayers,
      });

      const nextRoomCode = room.roomCode || '';
      const roomId = room.roomId || room.id || nextRoomCode || selectedTierId || 'private_room';
      setRoomCode(nextRoomCode);

      const matchmakingState = {
        roomId,
        roomCode: nextRoomCode,
        tierId: room.tierId || selectedTierId,
        maxPlayers: room.maxPlayers || maxPlayers,
        source: 'private-room',
      };

      setCreatedRoom(matchmakingState);
      saveMatchmakingContext(matchmakingState);
      setSuccessMessage(t('roomCreatedSuccessfully'));
    } catch (error) {
      console.error('Failed to create private room:', error);
      setErrorMessage(error.message || 'Failed to create private room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard?.writeText(roomCode);
      setSuccessMessage(t('roomCodeCopied'));
    } catch (error) {
      console.warn('Failed to copy room code:', error);
      setSuccessMessage(`${t('roomCode')}: ${roomCode}`);
    }
  };

  return (
    <section className="create-room-screen">
      <header className="create-room-header">
        <button type="button" className="create-back-button" onClick={() => navigate(ROUTES.mainMenu)} aria-label={t('backToMainMenu')}>
          ←
        </button>
        <h1>{t('createRoomTitle')}</h1>
      </header>

      <main className="create-room-layout">
        <section className='create-settings-card lui-c8c2bb58'>
          <h2>{t('roomSettings')}</h2>

          <div className="create-form-row">
            <label htmlFor="room-name">{t('roomName')}</label>
            <input
              id="room-name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              aria-label={t('roomName')}
            />
          </div>

          <div className="create-form-row">
            <label htmlFor="room-code">{t('roomCode')}</label>
            <input
              id="room-code"
              value={roomCode}
              readOnly
              placeholder="Auto generated after create"
              aria-label={t('roomCode')}
            />
          </div>


          <div className="create-form-row">
            <label htmlFor="room-tier">{t('gameMode')}</label>
            <div className="create-select-wrap">
              <select
                id="room-tier"
                value={selectedTierId}
                onChange={(event) => {
                  const tierId = event.target.value;
                  const tier = tiers.find((item) => item.tierId === tierId);
                  setSelectedTierId(tierId);
                  setMaxPlayers(tier?.maxPlayers || 3);
                }}
                aria-label={t('gameMode')}
              >
                {(tiers.length ? tiers : [{ tierId: 'sakura_garden_3p', name: 'Sakura Garden', maxPlayers: 3 }]).map((tier) => (
                  <option key={tier.tierId} value={tier.tierId}>{tx(tier.name || tier.tierId)}</option>
                ))}
              </select>
              <span>⌄</span>
            </div>
          </div>

          <div className="create-form-row players-row">
            <label>{t('maxPlayers')}</label>
            <div className="segmented-options">
              {[2, 3].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={maxPlayers === value ? 'active' : ''}
                  onClick={() => setMaxPlayers(value)}
                >
                  {value} {t('players')}
                </button>
              ))}
            </div>
          </div>

          <div className="create-form-row bet-row">
            <label>{t('bet')}</label>
            <div className="bet-controls">
              <div className="bet-value"><span>●</span>{formattedBet}</div>
            </div>
          </div>

          <div className="create-form-row">
            <label htmlFor="room-password">{t('passwordOptional')}</label>
            <input
              id="room-password"
              type="password"
              placeholder={t('enterPassword')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label={t('passwordOptional')}
            />
          </div>

          <div className="create-form-row room-type-row">
            <label>{t('roomType')}</label>
            <div className="segmented-options room-type-options">
              {['Private'].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={roomType === type ? 'active' : ''}
                  onClick={() => setRoomType(type)}
                >
                  <span>●</span>{tx(type)}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && <p className="create-error-message">{errorMessage}</p>}
          {successMessage && <p className="create-success-message">{successMessage}</p>}

          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-submit"
              onClick={handleCreateRoom}
              disabled={isCreatingRoom}
            >
              {isCreatingRoom ? t('creatingRoom') : createdRoom ? t('createAnotherRoom') : t('createRoom')}
            </button>

            {roomCode && (
              <button type="button" className="copy-room-code-button" onClick={handleCopyRoomCode}>
                {t('copyCode')}
              </button>
            )}
          </div>
        </section>

        <aside className='room-preview-card lui-f6c5a7a8'>
          <h2>{t('roomPreview')}</h2>
          <div className="preview-image" />

          <dl className="preview-list">
            <div><dt>{t('roomName')}</dt><dd>{roomName || tx('My Sakura Room')}</dd></div>
            <div><dt>{t('roomCode')}</dt><dd>{roomCode || '—'}</dd></div>
            <div><dt>{t('mode')}</dt><dd>{tx(selectedTier?.name || selectedTierId)}</dd></div>
            <div><dt>{t('players')}</dt><dd>{maxPlayers} {t('players')}</dd></div>
            <div><dt>{t('bet')}</dt><dd className="preview-bet"><span>●</span>{formattedBet}</dd></div>
            <div><dt>{t('type')}</dt><dd>{tx(roomType)}</dd></div>
          </dl>
        </aside>
      </main>
    </section>
  );
}

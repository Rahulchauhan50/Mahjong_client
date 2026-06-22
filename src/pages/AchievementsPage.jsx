import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { claimAchievement, getAchievements } from '../services/achievementsService.js';
import { getStoredAuthUser, logout } from '../services/authService.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/profile/${name}`;
const DEFAULT_PROFILE_AVATAR = 'ICO.png';
const PROFILE_AVATAR_STORAGE_KEY = 'sakura_profile_avatar';
const ACHIEVEMENT_CARD_ASSETS = ['C1.png', 'C2.png', 'C3.png', 'C4.png'];
const XP_TRACK_ASSET = 'profile-xp-track.png';
const XP_FILL_ASSET = 'profile-xp-fill.png';

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseProgressText(progressText) {
  if (typeof progressText !== 'string') return null;
  const match = progressText.match(/([\d,.]+)\s*\/\s*([\d,.]+)/);
  if (!match) return null;
  return { current: parseNumber(match[1]), target: parseNumber(match[2]) };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getProgressPercent(current, target) {
  if (!target || target <= 0) return 0;
  return clampPercent((current / target) * 100);
}

function getAchievementId(item, fallbackId = '') {
  return item?.achievementId || item?.id || item?._id || item?.slug || fallbackId || '';
}

function getAchievementProgressData(item) {
  const parsedProgress = parseProgressText(item?.progress);
  const progressNumber = typeof item?.progress === 'number' ? item.progress : null;
  const current = parseNumber(item?.currentXP ?? item?.currentXp ?? item?.xp ?? item?.current ?? progressNumber ?? parsedProgress?.current ?? 0);
  const target = parseNumber(item?.requiredXP ?? item?.requiredXp ?? item?.targetXP ?? item?.targetXp ?? item?.target ?? parsedProgress?.target ?? (item?.complete ? current || 1 : 1));
  return {
    current,
    target,
    percent: item?.complete ? 100 : getProgressPercent(current, target),
    text: item?.complete && !target ? 'Completed' : `${current}/${target}`,
  };
}

function isAchievementComplete(item) {
  if (item?.complete ?? item?.completed ?? item?.isComplete ?? item?.unlocked) return true;
  const progressData = getAchievementProgressData(item);
  return progressData.target > 0 && progressData.current >= progressData.target;
}

function isAchievementClaimable(item) {
  if (item?.claimed || item?.isClaimed) return false;
  return Boolean(item?.claimable ?? item?.canClaim ?? isAchievementComplete(item));
}

function normalizeAchievements(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === 'object').map((item, index) => {
    const title = item?.title || item?.name || item?.achievementName || `Achievement ${index + 1}`;
    const description = item?.description || item?.details || '';
    const id = getAchievementId(item, title);
    return {
      ...item,
      id,
      achievementId: id,
      title,
      description,
      progress: item?.progress,
      card: item?.card || item?.cardAsset || item?.background || ACHIEVEMENT_CARD_ASSETS[index % ACHIEVEMENT_CARD_ASSETS.length],
      complete: isAchievementComplete(item),
      claimed: Boolean(item?.claimed ?? item?.isClaimed ?? false),
      claimable: isAchievementClaimable(item),
    };
  });
}


function getStoredProfileAvatar() {
  try {
    return window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function getAvatarSrc(user) {
  const storedProfileAvatar = getStoredProfileAvatar();
  const avatarValue = storedProfileAvatar || user?.avatarUrl || user?.imageUrl || user?.avatar || user?.avatarId;
  if (typeof avatarValue !== 'string') return asset(DEFAULT_PROFILE_AVATAR);
  const avatar = avatarValue.trim();
  if (!avatar) return asset(DEFAULT_PROFILE_AVATAR);
  if (/^(https?:)?\/\//i.test(avatar) || avatar.startsWith('/')) return avatar;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(avatar)) return asset(avatar);
  return asset(DEFAULT_PROFILE_AVATAR);
}

function XpProgressBar({ className = '', percent, label }) {
  return (
    <div
      aria-label={label}
      aria-valuemax="100"
      aria-valuemin="0"
      aria-valuenow={Math.round(clampPercent(percent))}
      className={`profile-xp-progress ${className}`.trim()}
      role="progressbar"
      style={{ '--xp-progress': `${clampPercent(percent)}%` }}
    >
      <img className="profile-xp-progress-track" src={asset(XP_TRACK_ASSET)} alt="" />
      <div className="profile-xp-progress-fill-clip">
        <img className="profile-xp-progress-fill" src={asset(XP_FILL_ASSET)} alt="" />
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const navigate = useNavigate();
  const { t, tx } = useLanguage();
  const [user, setUser] = useState(() => getStoredAuthUser() || {});
  const [achievements, setAchievements] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [claimingAchievementId, setClaimingAchievementId] = useState('');
  const [achievementClaimError, setAchievementClaimError] = useState('');
  const [achievementClaimMessage, setAchievementClaimMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    getAchievements()
      .then((items) => {
        if (!isMounted) return;
        setAchievements(normalizeAchievements(items));
      })
      .catch((error) => {
        console.error('Failed to load achievements:', error);
        if (isMounted) setLoadError(error.message || t('profileLoadFailed'));
      });
    return () => { isMounted = false; };
  }, [t]);

  async function reloadAchievements() {
    const freshAchievements = await getAchievements();
    setAchievements(normalizeAchievements(freshAchievements));
  }

  async function handleClaimAchievement(item) {
    const achievementId = getAchievementId(item);
    if (!achievementId || claimingAchievementId) return;
    try {
      setClaimingAchievementId(achievementId);
      setAchievementClaimError('');
      setAchievementClaimMessage('');
      await claimAchievement(achievementId);
      setAchievementClaimMessage(t('achievementClaimed'));
      await reloadAchievements();
    } catch (error) {
      console.error('Failed to claim achievement:', error);
      setAchievementClaimError(error.message || t('achievementClaimFailed'));
    } finally {
      setClaimingAchievementId('');
    }
  }

  function handleLogout() {
    logout();
    navigate(ROUTES.start, { replace: true });
  }

  return (
    <section className="profile-screen-ui achievements-page" aria-label={t('achievementsTitle')}>
      <aside className="profile-sidebar profile-sidebar--compact">
        <button className="profile-back-line" type="button" onClick={() => navigate(ROUTES.profile)}>
          <img src={asset('Back.png')} alt="" />
          <span>{t('achievementsTitle')}</span>
        </button>
        <div className="profile-tabs profile-tabs--nav">
          <button type="button" onClick={() => navigate(ROUTES.profile)}>
            {t('profileTitle')}
          </button>
          <button className="active" type="button" onClick={() => navigate(ROUTES.achievements)}>
            {t('achievementsTitle')}
          </button>
        </div>
        <button className="profile-logout-button" type="button" onClick={handleLogout}>
          {t('logout')}
        </button>
      </aside>

      <main className="profile-content achievements-page__content">
        <header className="profile-header achievements-page__header">
          <div className="profile-identity achievements-page__identity">
            <img className="profile-avatar" src={getAvatarSrc(user)} alt="" />
            <div className="profile-name-block">
              <h1>{t('achievementsTitle')}</h1>
              <p className="profile-api-meta">{user?.username || user?.name || 'Player'}</p>
            </div>
          </div>
          {loadError ? <p className="profile-load-error" role="alert">{loadError}</p> : null}
        </header>

        <section className="profile-section achievements-page__panel">
          {achievementClaimError ? <p className="profile-achievement-claim-state profile-achievement-claim-state--error" role="alert">{achievementClaimError}</p> : null}
          {achievementClaimMessage ? <p className="profile-achievement-claim-state">{achievementClaimMessage}</p> : null}
          {achievements.length === 0 ? (
            <p className="profile-achievements-empty">{t('noAchievementsYet')}</p>
          ) : (
            <div className="achievements-page__scroll">
              <div className="profile-achievement-grid achievements-page__grid">
                {achievements.map((item) => {
                  const achievementProgress = getAchievementProgressData(item);
                  const achievementId = getAchievementId(item);
                  const isClaiming = claimingAchievementId === achievementId;
                  return (
                    <article
                      className="profile-achievement-card"
                      key={achievementId || item.title}
                      style={{ backgroundImage: `url(${asset(item.card)})` }}
                    >
                      <div className="profile-achievement-copy">
                        <h3>{tx(item.title)}</h3>
                        <p>{tx(item.description)}</p>
                      </div>
                      <div className="profile-achievement-footer">
                        <XpProgressBar
                          className="profile-achievement-xp-bar"
                          percent={achievementProgress.percent}
                          label={`${tx(item.title)} ${t('xpProgress')}`}
                        />
                        <span className="profile-achievement-progress-text">{tx(achievementProgress.text)}</span>
                        {item.claimed ? (
                          <span className="profile-achievement-claimed-label">{t('claimed')}</span>
                        ) : item.claimable ? (
                          <button
                            className="profile-achievement-complete-button"
                            disabled={isClaiming}
                            type="button"
                            onClick={() => handleClaimAchievement(item)}
                          >
                            {isClaiming ? t('claiming') : t('complete')}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </section>
  );
}

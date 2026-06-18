import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { useLanguage } from '../i18n/useLanguage.js';
import { isUserLoggedIn, logout } from '../services/authService.js';

const asset = (name) => `/assets/start-screen/${name}`;

const featureItems = [
  {
    titleKey: 'realPlayers',
    textKey: 'realPlayersText',
    icon: 'icon-real-players.png',
  },
  {
    titleKey: 'excitingTournaments',
    textKey: 'excitingTournamentsText',
    icon: 'icon-tournaments.png',
  },
  {
    titleKey: 'dailyRewards',
    textKey: 'dailyRewardsText',
    icon: 'icon-rewards.png',
  },
  {
    titleKey: 'safeFair',
    textKey: 'safeFairText',
    icon: 'icon-safe.png',
  },
];

function BrandMark() {
  return (
    <div className="start-brand" aria-label="Sakura Mahjong">
      <span className="brand-flower">✿</span>
      <div>
        <strong>SAKURA</strong>
        <small>MAHJONG</small>
      </div>
    </div>
  );
}

function FeatureCard({ item, t }) {
  return (
    <article className="start-feature-card">
      <img src={asset(item.icon)} alt="" />
      <div>
        <h2>{t(item.titleKey)}</h2>
        <p>{t(item.textKey)}</p>
      </div>
    </article>
  );
}

export default function StartScreenPage() {
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(() => isUserLoggedIn());

  useEffect(() => {
    setIsLoggedIn(isUserLoggedIn());
  }, []);

  function handlePlayNow() {
    navigate(isLoggedIn ? ROUTES.mainMenu : ROUTES.login);
  }

  function handleAuthButton() {
    if (!isLoggedIn) {
      navigate(ROUTES.login);
      return;
    }

    logout();
    setIsLoggedIn(false);
  }

  return (
    <section className='start-screen-ui lui-81a227a1'>
      <div className="loading-screen-sparkles start-screen-sparkles" aria-hidden="true">
        {Array.from({ length: 50 }, (_, index) => (
          <span key={index} className={`loading-sparkle loading-sparkle-${index + 1}`} />
        ))}
      </div>

      <header className="start-topbar">
        <BrandMark />
        <button className="language-select" type="button" aria-label="Language selector" onClick={toggleLanguage}>
          <span>◎</span>
          {language === 'en' ? 'EN / 中文' : '中文 / EN'}
          <b>⌄</b>
        </button>
      </header>

      <main className='start-hero lui-2c270ecc'>
        <img className="start-logo" src={asset('logo.png')} alt="Sakura Mahjong" />
        <p className="start-tagline">{t('tagline')}</p>
        <div className="start-divider" aria-hidden="true"><span /></div>

        <div className='start-actions lui-beb9d69c'>
          <button className='start-image-button start-play-button lui-4bf92a4e' type="button" onClick={handlePlayNow}>
            {t('playNow')}
          </button>
          <button className="start-image-button start-login-button" type="button" onClick={handleAuthButton}>
            {isLoggedIn ? t('logout') : t('login')}
          </button>
        </div>
      </main>

      <section className="start-feature-strip" aria-label="Game features">
        {featureItems.map((item) => (
          <FeatureCard key={item.titleKey} item={item} t={t} />
        ))}
      </section>

      <footer className="start-footer">
        <span>{t('copyright')}</span>
        <nav aria-label="Legal links">
          <button type="button">{t('terms')}</button>
          <button type="button">{t('privacy')}</button>
          <button type="button">{t('support')}</button>
        </nav>
        <div className="start-socials" aria-label="Social links">
          <button type="button">◉</button>
          <button type="button">f</button>
          <button type="button">𝕏</button>
        </div>
      </footer>
    </section>
  );
}

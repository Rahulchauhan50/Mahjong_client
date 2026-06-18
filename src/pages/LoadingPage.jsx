import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { useLanguage } from '../i18n/useLanguage.js';

const asset = (name) => `/assets/loading-screen/${name}`;
const LOADING_STEPS = [30, 40, 50, 60, 70, 80, 90, 100];
const LOADING_STEP_INTERVAL_MS = 700;
const LOADING_COMPLETE_DELAY_MS = 1100;
const SPARKLE_COUNT = 30;

export default function LoadingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const progress = LOADING_STEPS[stepIndex];
  const loadingText = useMemo(() => `${t('loading')}${'.'.repeat((stepIndex % 3) + 1)}`, [stepIndex, t]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, LOADING_STEPS.length - 1));
    }, LOADING_STEP_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress !== 100) {
      return undefined;
    }

    const timer = window.setTimeout(() => navigate(ROUTES.mainMenu), LOADING_COMPLETE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [navigate, progress]);

  return (
    <section className="loading-screen-ui" aria-label={t('loadingScreen')}>
      <img className="loading-screen-bg" src={asset('BG.png')} alt="" />
      <div className="loading-screen-vignette" aria-hidden="true" />
      <div className="loading-screen-sparkles" aria-hidden="true">
        {Array.from({ length: SPARKLE_COUNT }, (_, index) => (
          <span key={index} className={`loading-sparkle loading-sparkle-${index + 1}`} />
        ))}
      </div>

      <main className="loading-screen-content">
        <img className="loading-screen-logo" src={asset('LOGO.png')} alt="Sakura Mahjong" />
        <img className="loading-screen-cards" src={asset('Card.png')} alt="" />

        <div className="loading-progress-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <img className="loading-progress-base" src={asset('L1.png')} alt="" />
          <div className="loading-progress-fill" style={{ width: `${progress}%` }} aria-hidden="true">
            <img src={asset('L2.png')} alt="" />
          </div>
          <strong>{progress}/100</strong>
        </div>

        <p className="loading-screen-status">{loadingText}</p>
      </main>
    </section>
  );
}

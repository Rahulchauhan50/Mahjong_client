import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import PrimaryButton from './PrimaryButton.jsx';
import { useLanguage } from '../i18n/useLanguage.js';

export default function FlowNav({ backTo = ROUTES.mainMenu, nextTo, nextLabel, showBack = true }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <nav className="flow-nav">
      {showBack ? (
        <PrimaryButton variant="ghost" onClick={() => navigate(backTo)}>
          {t('back')}
        </PrimaryButton>
      ) : null}
      {nextTo ? (
        <PrimaryButton onClick={() => navigate(nextTo)}>
          {nextLabel || t('continue')}
        </PrimaryButton>
      ) : null}
    </nav>
  );
}

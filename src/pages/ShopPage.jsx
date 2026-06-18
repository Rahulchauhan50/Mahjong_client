import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { getBalances } from '../services/economyService.js';
import { useLanguage } from '../i18n/useLanguage.js';

const shopAsset = (name) => `/assets/shop/${name}`;
const mainMenuAsset = (name) => `/assets/main-menu/${name}`;

const coinPacks = [
  { id: 'coins-10k', image: '1.png', amount: '10,000 COINS', price: '120', currency: 'diamonds', badge: 'POPULAR' },
  { id: 'coins-50k', image: '2.png', amount: '50,000 COINS', price: '500', currency: 'diamonds' },
  { id: 'coins-120k', image: '4.png', amount: '120,000 COINS', price: '1,050', currency: 'diamonds', badge: 'BEST VALUE' },
  { id: 'coins-300k', image: '3.png', amount: '300,000 COINS', price: '2,400', currency: 'diamonds' },
];

const gemPacks = [
  { id: 'gems-260', image: '5.png', amount: '260 GEMS', price: '$1.99', currency: 'usd', badge: 'POPULAR' },
  { id: 'gems-1300', image: '6.png', amount: '1,300 GEMS', price: '$8.99', currency: 'usd' },
  { id: 'gems-2800', image: '7.png', amount: '2,800 GEMS', price: '$17.99', currency: 'usd', badge: 'BEST VALUE' },
  { id: 'gems-7500', image: '8.png', amount: '7,500 GEMS', price: '$44.99', currency: 'usd' },
];

const boxPack = {
  id: 'basic-box',
  image: '9.png',
  amount: 'BASIC BOX',
  price: '25',
  currency: 'diamonds',
};

const topRowItems = [...coinPacks, boxPack];

function formatBalance(value) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue.toLocaleString();
  }

  return '0';
}


function parsePrice(value) {
  const numericValue = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function BalancePill({ icon, value, label }) {
  return (
    <div className="shop-balance-pill" aria-label={label}>
      <img src={mainMenuAsset(icon)} alt="" />
      <strong>{formatBalance(value)}</strong>
    </div>
  );
}

function ShopPrice({ item, onPurchase }) {
  const isDiamondPrice = item.currency === 'diamonds';

  return (
    <button className="shop-price-button" type="button" onClick={() => onPurchase(item)} style={{ backgroundImage: `url(${shopAsset('66.png')})` }}>
      {isDiamondPrice && <img src={mainMenuAsset('gem.png')} alt="" />}
      <span>{item.price}</span>
    </button>
  );
}

function ShopCard({ item, variant = 'coin', onPurchase }) {
  return (
    <article className={`shop-item-card shop-item-card--${variant}`} aria-label={item.amount}>
      <img className="shop-card-art" src={shopAsset(item.image)} alt="" />
      {item.badge && (
        <span className={`shop-card-badge ${item.badge === 'BEST VALUE' ? 'is-red' : 'is-green'}`}>
          {item.badge}
        </span>
      )}
      <ShopPrice item={item} onPurchase={onPurchase} />
    </article>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [balances, setBalances] = useState({ coins: 0, diamonds: 0 });
  const [shopMessage, setShopMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    getBalances()
      .then((economyBalances) => {
        if (!isMounted) {
          return;
        }

        setBalances({
          coins: economyBalances?.coins ?? 0,
          diamonds: economyBalances?.diamonds ?? economyBalances?.gems ?? 0,
        });
      })
      .catch((error) => {
        console.error('Failed to load shop balances:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);


  const handlePurchase = (item) => {
    if (item.currency === 'diamonds') {
      const requiredDiamonds = parsePrice(item.price);
      const currentDiamonds = Number(balances.diamonds || 0);

      if (currentDiamonds < requiredDiamonds) {
        setShopMessage(t('insufficientDiamonds'));
        window.clearTimeout(window.__sakuraShopMessageTimer);
        window.__sakuraShopMessageTimer = window.setTimeout(() => setShopMessage(''), 2200);
        return;
      }
    }
  };

  return (
    <section className="shop-page" style={{ backgroundImage: `url(${shopAsset('552134.png')})` }}>
      <button className="shop-back-button" type="button" onClick={() => navigate(ROUTES.mainMenu)} aria-label="Back to main menu">
        ‹ BACK
      </button>

      <div className="shop-balance-bar">
        <BalancePill icon="coin.png" value={balances.coins} label="Coins balance" />
        <BalancePill icon="gem.png" value={balances.diamonds} label="Diamonds balance" />
      </div>

      {shopMessage && <div className="shop-feedback" role="status">{shopMessage}</div>}

      <div className="shop-content-frame">
        <div className="shop-row shop-row--top">
          {topRowItems.map((item) => (
            <ShopCard key={item.id} item={item} variant={item.id === 'basic-box' ? 'box' : 'coin'} onPurchase={handlePurchase} />
          ))}
        </div>

        <div className="shop-row shop-row--bottom">
          {gemPacks.map((item) => (
            <ShopCard key={item.id} item={item} variant="gem" onPurchase={handlePurchase} />
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../router/routes.js';
import { claimMission, getMissions } from '../services/missionsService.js';

const missionIcon = '/assets/missions/icon-missions.png';

const DAILY_FALLBACK_MISSIONS = [
  { id: 'daily_play_7_games', title: 'Play 7 Games', progress: 0, target: 7, type: 'daily', reward: { type: 'season_xp', amount: 120 } },
  { id: 'daily_win_3_games', title: 'Win 3 Games', progress: 0, target: 3, type: 'daily', reward: { type: 'season_xp', amount: 160 } },
  { id: 'daily_spend_200_coins', title: 'Spend 200 Coins', progress: 0, target: 200, type: 'daily', reward: { type: 'season_xp', amount: 100 } },
  { id: 'daily_earn_500_prize', title: 'Earn 500 Prize', progress: 0, target: 500, type: 'daily', reward: { type: 'season_xp', amount: 140 } },
  { id: 'daily_claim_daily_reward', title: 'Claim Daily Reward', progress: 0, target: 1, type: 'daily', reward: { type: 'season_xp', amount: 80 } },
];

const WEEKLY_FALLBACK_MISSIONS = [
  { id: 'weekly_play_35_games', title: 'Play 35 Games', progress: 0, target: 35, type: 'weekly', reward: { type: 'season_xp', amount: 600 } },
  { id: 'weekly_win_15_games', title: 'Win 15 Games', progress: 0, target: 15, type: 'weekly', reward: { type: 'season_xp', amount: 750 } },
  { id: 'weekly_spend_1500_coins', title: 'Spend 1,500 Coins', progress: 0, target: 1500, type: 'weekly', reward: { type: 'season_xp', amount: 500 } },
  { id: 'weekly_earn_5000_prize', title: 'Earn 5,000 Prize', progress: 0, target: 5000, type: 'weekly', reward: { type: 'season_xp', amount: 650 } },
  { id: 'weekly_claim_5_daily_rewards', title: 'Claim 5 Daily Rewards', progress: 0, target: 5, type: 'weekly', reward: { type: 'season_xp', amount: 450 } },
];

function formatNumber(value, fallback = '0') {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : fallback;
}

function getMissionType(mission = {}) {
  const rawType = String(mission.type || mission.period || mission.frequency || mission.resetType || mission.category || '').toLowerCase();

  if (rawType.includes('week')) {
    return 'weekly';
  }

  if (rawType.includes('day') || rawType.includes('daily')) {
    return 'daily';
  }

  const title = String(mission.title || mission.name || '').toLowerCase();
  if (title.includes('weekly') || title.includes('week')) {
    return 'weekly';
  }

  return 'daily';
}

function normalizeMission(mission, index, fallbackType = 'daily') {
  const type = getMissionType(mission) || fallbackType;
  const progress = Number(mission.progress ?? mission.currentProgress ?? mission.current ?? 0);
  const target = Number(mission.target ?? mission.goal ?? mission.required ?? 1);
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, progress) : 0;

  return {
    id: mission.id || mission.missionId || mission._id || mission.key || `${type}_mission_${index}`,
    title: mission.title || mission.name || 'Mission',
    progress: Math.min(safeProgress, safeTarget),
    target: safeTarget,
    type,
    claimed: Boolean(mission.claimed || mission.isClaimed || mission.rewardClaimed),
    reward: mission.reward || mission.rewards || null,
  };
}

function formatReward(reward) {
  if (!reward) {
    return 'Season XP';
  }

  if (Array.isArray(reward)) {
    return reward.map(formatReward).join(' + ');
  }

  const amount = reward.amount ?? reward.value ?? reward.quantity;
  const type = String(reward.type || reward.currency || reward.itemName || 'reward').replace(/_/g, ' ');
  return amount ? `${formatNumber(amount)} ${type}` : type;
}

function getNextDailyResetText() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const totalSeconds = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getNextWeeklyResetText() {
  const now = new Date();
  const next = new Date(now);
  const day = next.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  const totalSeconds = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function MissionCard({ mission, onClaim, isClaiming }) {
  const percentage = Math.max(0, Math.min(100, Math.round((mission.progress / mission.target) * 100)));
  const isComplete = mission.progress >= mission.target;

  return (
    <article className={`mission-card mission-card-${mission.type}${isComplete ? ' is-complete' : ''}${mission.claimed ? ' is-claimed' : ''}`}>
      <div className="mission-card-main">
        <img className="mission-card-icon" src={missionIcon} alt="" />
        <div className="mission-card-copy">
          <strong>{mission.title}</strong>
          <span>{formatReward(mission.reward)}</span>
        </div>
        <div className="mission-progress-values">
          <b>{formatNumber(mission.progress)}</b>
          <span>/ {formatNumber(mission.target)}</span>
        </div>
      </div>

      <div className="mission-progress-track" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
        <small className="mission-progress-label">{percentage}% complete</small>
      </div>

      <div className="mission-card-footer">
        {mission.claimed ? (
          <span className="mission-claimed-label">Claimed</span>
        ) : (
          <button type="button" onClick={() => onClaim(mission.id)} disabled={!isComplete || isClaiming}>
            {isClaiming ? 'Claiming...' : 'Claim'}
          </button>
        )}
      </div>
    </article>
  );
}

function MissionSection({ title, subtitle, resetText, missions, onClaim, claimingMissionId }) {
  return (
    <section className="mission-section">
      <header className="mission-section-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span>{resetText}</span>
      </header>

      <div className="mission-grid">
        {missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onClaim={onClaim}
            isClaiming={claimingMissionId === mission.id}
          />
        ))}
      </div>
    </section>
  );
}

export default function MissionsPage() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingMissionId, setClaimingMissionId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadMissions() {
      setIsLoading(true);
      setStatusMessage('');

      try {
        const backendMissions = await getMissions();
        if (!isMounted) return;
        setMissions(backendMissions.map(normalizeMission));
      } catch (error) {
        console.error('Failed to load missions:', error);
        if (!isMounted) return;
        setMissions([]);
        setStatusMessage(error?.message || 'Failed to load missions from backend');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMissions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setResetTick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const groupedMissions = useMemo(() => {
    const normalized = missions.length
      ? missions.map(normalizeMission)
      : [...DAILY_FALLBACK_MISSIONS, ...WEEKLY_FALLBACK_MISSIONS].map(normalizeMission);

    return {
      daily: normalized.filter((mission) => mission.type === 'daily'),
      weekly: normalized.filter((mission) => mission.type === 'weekly'),
    };
  }, [missions]);

  const handleClaim = async (missionId) => {
    if (!missionId) return;

    setClaimingMissionId(missionId);
    setStatusMessage('');

    try {
      const response = await claimMission(missionId);
      setMissions((current) => current.map((mission, index) => {
        const normalized = normalizeMission(mission, index);
        return normalized.id === missionId ? { ...normalized, claimed: true } : normalized;
      }));
      setStatusMessage(`Reward claimed: ${formatReward(response?.reward)}`);
    } catch (error) {
      console.error('Failed to claim mission:', error);
      setStatusMessage(error?.message || 'Failed to claim mission reward');
    } finally {
      setClaimingMissionId('');
    }
  };

  return (
    <section className="missions-page-ui">
      <header className="missions-header">
        <button className="missions-back-button" type="button" onClick={() => navigate(ROUTES.mainMenu)}>
          ‹ Back
        </button>

        <div className="missions-title-wrap">
          <img src={missionIcon} alt="" />
          <div>
            <h1>Missions</h1>
            <p>Daily and weekly tasks</p>
          </div>
        </div>
      </header>

      {statusMessage && <div className="missions-status-message">{statusMessage}</div>}

      <main className="missions-content">
        <MissionSection
          title="Daily Missions"
          subtitle="Resets every day"
          resetText={`Reset in ${getNextDailyResetText(resetTick)}`}
          missions={groupedMissions.daily}
          onClaim={handleClaim}
          claimingMissionId={claimingMissionId}
        />

        <MissionSection
          title="Weekly Missions"
          subtitle="Bigger targets and bigger season XP"
          resetText={`Reset in ${getNextWeeklyResetText(resetTick)}`}
          missions={groupedMissions.weekly}
          onClaim={handleClaim}
          claimingMissionId={claimingMissionId}
        />
      </main>
    </section>
  );
}

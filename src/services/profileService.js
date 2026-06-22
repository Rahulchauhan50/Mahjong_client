import { getFromApi, patchToApi } from './api.js';

function normalizeProfileResponse(response) {
  return response?.profile || response?.user || response?.data?.profile || response?.data?.user || response;
}

export async function getProfile() {
  const response = await getFromApi('/auth/profile', (mockApi) => mockApi.getProfile());
  return normalizeProfileResponse(response);
}

export async function updateProfile(payload) {
  const response = await patchToApi('/auth/profile', payload, (mockApi) => mockApi.updateProfile(payload));
  return normalizeProfileResponse(response);
}

export async function getPublicProfile(userId) {
  const response = await getFromApi(`/auth/profile/${encodeURIComponent(userId)}`, (mockApi) => mockApi.getPublicProfile(userId));
  return normalizeProfileResponse(response);
}

function formatPercent(value) {
  if (typeof value === 'string') {
    return value.includes('%') ? value : `${value}%`;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  const percent = value <= 1 ? value * 100 : value;
  return `${Number(percent.toFixed(1))}%`;
}

export function normalizeProfileStats(profile) {
  if (Array.isArray(profile?.stats)) {
    return profile.stats.filter((stat) => stat && stat.label !== undefined && stat.value !== undefined);
  }

  if (Array.isArray(profile?.statistics)) {
    return profile.statistics.filter((stat) => stat && stat.label !== undefined && stat.value !== undefined);
  }

  const source = profile?.stats || profile?.statistics || profile?.lifetimeStats || profile?.lifetime || {};

  if (source && typeof source === 'object') {
    const totalGames = source.totalGames ?? source.gamesPlayed ?? source.matchesPlayed ?? source.total_matches;
    const winRate = source.winRate ?? source.win_rate ?? source.winPercentage ?? source.win_percentage;
    const mvp = source.mvp ?? source.mvpCount ?? source.totalMvp ?? source.mvp_count;
    const stats = [];

    if (totalGames !== undefined && totalGames !== null) {
      stats.push({ label: 'Total Games', value: totalGames });
    }

    if (winRate !== undefined && winRate !== null) {
      stats.push({ label: 'Win Rate', value: formatPercent(winRate) });
    }

    if (mvp !== undefined && mvp !== null) {
      stats.push({ label: 'MVP', value: mvp });
    }

    return stats;
  }

  return [];
}

export async function getProfileStats() {
  const profile = await getProfile();
  return normalizeProfileStats(profile);
}

export async function getAchievements() {
  const profile = await getProfile();

  if (Array.isArray(profile?.achievements)) {
    return profile.achievements;
  }

  return [];
}

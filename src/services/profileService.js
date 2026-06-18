import { getFromApi, patchToApi } from './api.js';
import { getStoredAuthUser } from './authService.js';

function normalizeProfileResponse(response) {
  return response?.profile || response?.user || response?.data?.profile || response?.data?.user || response;
}

export async function getProfile() {
  try {
    const response = await getFromApi('/auth/profile', (mockApi) => mockApi.getProfile());
    return normalizeProfileResponse(response);
  } catch (error) {
    const storedUser = getStoredAuthUser();
    if (storedUser) {
      return storedUser;
    }

    throw error;
  }
}

export async function updateProfile(payload) {
  const response = await patchToApi('/auth/profile', payload, (mockApi) => mockApi.updateProfile(payload));
  return normalizeProfileResponse(response);
}

export async function getPublicProfile(userId) {
  const response = await getFromApi(`/auth/profile/${encodeURIComponent(userId)}`, (mockApi) => mockApi.getPublicProfile(userId));
  return normalizeProfileResponse(response);
}

export async function getProfileStats() {
  const profile = await getProfile();

  if (Array.isArray(profile?.stats)) {
    return profile.stats;
  }

  if (profile?.statistics && typeof profile.statistics === 'object') {
    return Object.entries(profile.statistics).map(([label, value]) => ({ label, value }));
  }

  return [];
}

export async function getAchievements() {
  const profile = await getProfile();

  if (Array.isArray(profile?.achievements)) {
    return profile.achievements;
  }

  return [];
}

import { apiRequest, isMockApiEnabled } from './api.js';

function unwrapPayload(response) {
  return response?.data && typeof response.data === 'object' ? response.data : (response || {});
}

function extractAchievements(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.achievements)) {
    return payload.achievements;
  }

  if (Array.isArray(payload?.data?.achievements)) {
    return payload.data.achievements;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function assertRealAchievementsApi() {
  if (isMockApiEnabled()) {
    throw new Error('Achievements are unavailable right now. Please try again later.');
  }
}

export async function getAchievements() {
  assertRealAchievementsApi();
  const response = await apiRequest('/achievements/');
  return extractAchievements(unwrapPayload(response));
}

export async function claimAchievement(achievementId) {
  if (!achievementId) {
    throw new Error('achievementId is required to claim an achievement.');
  }

  assertRealAchievementsApi();
  return apiRequest(`/achievements/claim/${encodeURIComponent(achievementId)}`, {
    method: 'POST',
  });
}

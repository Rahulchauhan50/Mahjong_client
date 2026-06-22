import { getFromApi, postToApi } from './api.js';

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

export async function getAchievements() {
  const response = await getFromApi('/achievements/', (mockApi) => mockApi.getAchievements?.() ?? { success: true, achievements: [] });
  return extractAchievements(unwrapPayload(response));
}

export async function claimAchievement(achievementId) {
  if (!achievementId) {
    throw new Error('achievementId is required to claim an achievement.');
  }

  return postToApi(`/achievements/claim/${encodeURIComponent(achievementId)}`, undefined, (mockApi) => mockApi.claimAchievement?.(achievementId) ?? { success: true });
}

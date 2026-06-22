import { getFromApi, postToApi } from './api.js';

function unwrapPayload(response) {
  return response?.data && typeof response.data === 'object' ? response.data : (response || {});
}

export async function getAchievements() {
  const response = await getFromApi('/achievements/', (mockApi) => mockApi.getAchievements?.() ?? { success: true, achievements: [] });
  const payload = unwrapPayload(response);
  return Array.isArray(payload.achievements) ? payload.achievements : [];
}

export async function claimAchievement(achievementId) {
  if (!achievementId) {
    throw new Error('achievementId is required to claim an achievement.');
  }

  return postToApi(`/achievements/claim/${encodeURIComponent(achievementId)}`, undefined, (mockApi) => mockApi.claimAchievement?.(achievementId) ?? { success: true });
}

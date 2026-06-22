import { getFromApi, postToApi } from './api.js';

function unwrapPayload(response) {
  return response?.data && typeof response.data === 'object' ? response.data : (response || {});
}

export async function getMissions() {
  const response = await getFromApi('/missions/', (mockApi) => mockApi.getMissions?.() ?? { success: true, missions: [] });
  const payload = unwrapPayload(response);
  return Array.isArray(payload.missions) ? payload.missions : [];
}

export async function claimMission(missionId) {
  if (!missionId) {
    throw new Error('missionId is required to claim a mission.');
  }

  const response = await postToApi(`/missions/claim/${encodeURIComponent(missionId)}`, undefined, (mockApi) => mockApi.claimMission?.(missionId) ?? { success: true });
  return unwrapPayload(response);
}

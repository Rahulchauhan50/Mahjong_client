import { apiRequest, isMockApiEnabled } from './api.js';

function unwrapPayload(response) {
  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }
  return response && typeof response === 'object' ? response : {};
}

function firstArray(...values) {
  return values.find(Array.isArray) || [];
}

function assertRealMissionsApi() {
  if (isMockApiEnabled()) {
    throw new Error('Missions require the real backend API. Disable VITE_USE_MOCK_API to avoid mock mission data.');
  }
}

function extractMissions(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  const flatMissions = firstArray(
    payload.missions,
    payload.items,
    payload.results,
    data.missions,
    data.items,
    data.results,
  );

  if (flatMissions.length) {
    return flatMissions;
  }

  const daily = firstArray(
    payload.daily,
    payload.dailyMissions,
    payload.daily_missions,
    data.daily,
    data.dailyMissions,
    data.daily_missions,
  );

  const weekly = firstArray(
    payload.weekly,
    payload.weeklyMissions,
    payload.weekly_missions,
    data.weekly,
    data.weeklyMissions,
    data.weekly_missions,
  );

  return [
    ...daily.map((mission) => ({ ...mission, type: mission.type || 'daily' })),
    ...weekly.map((mission) => ({ ...mission, type: mission.type || 'weekly' })),
  ];
}

export async function getMissions() {
  assertRealMissionsApi();
  const response = await apiRequest('/missions/');
  return extractMissions(unwrapPayload(response));
}

export async function claimMission(missionId) {
  if (!missionId) {
    throw new Error('missionId is required to claim a mission.');
  }

  assertRealMissionsApi();
  return apiRequest(`/missions/claim/${encodeURIComponent(missionId)}`, {
    method: 'POST',
  });
}

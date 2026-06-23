import { apiRequest, isMockApiEnabled, postToApi } from './api.js';
import { normalizeRoomList, normalizeRoom, normalizeRoomTierList, normalizePrivateRoom } from './gameNormalizers.js';

const MISSING_JOIN_ROOM_ENDPOINT_MESSAGE = 'Backend API reference does not include a join-room endpoint yet. Required: POST /api/rooms/join with { roomCode } or POST /api/rooms/:roomId/join.';

export async function getRoomTiers() {
  // Room tiers must always come from the real backend. Do not fall back to mock room cards.
  const response = await apiRequest('/rooms/tiers');
  return normalizeRoomTierList(response);
}

export async function getFeaturedRooms() {
  // The current API reference only exposes GET /rooms/tiers.
  // Main menu cards are tier cards, so this must use the real backend endpoint.
  return getRoomTiers();
}

export async function getRooms() {
  // The current API reference only exposes GET /rooms/tiers.
  // Room list UI should use real backend tiers until a public rooms endpoint exists.
  return getRoomTiers();
}

export async function createPrivateRoom(payload = {}) {
  const requestPayload = {
    tierId: payload.tierId || payload.roomId || 'sakura_garden_3p',
    maxPlayers: Number(payload.maxPlayers) || 3,
  };

  const response = await postToApi('/rooms/private', requestPayload, (mockApi) => mockApi.createPrivateRoom(requestPayload));
  return normalizePrivateRoom(response, requestPayload);
}

export async function createRoom(payload = {}) {
  return createPrivateRoom(payload);
}

export async function joinRoom(roomIdOrCode) {
  if (isMockApiEnabled()) {
    const response = await postToApi(`/rooms/${encodeURIComponent(roomIdOrCode)}/join`, undefined, (mockApi) => mockApi.joinRoom(roomIdOrCode));
    return normalizeRoom(response);
  }

  throw new Error(MISSING_JOIN_ROOM_ENDPOINT_MESSAGE);
}

export async function joinRoomByCode(roomCode) {
  if (!roomCode) {
    throw new Error('Room code is required.');
  }

  if (isMockApiEnabled()) {
    return joinRoom(roomCode);
  }

  throw new Error(MISSING_JOIN_ROOM_ENDPOINT_MESSAGE);
}

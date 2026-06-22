import { getFromApi, isMockApiEnabled, postToApi } from './api.js';
import { normalizeRoomList, normalizeRoom, normalizeRoomTierList, normalizePrivateRoom } from './gameNormalizers.js';

const MISSING_JOIN_ROOM_ENDPOINT_MESSAGE = 'Backend API reference does not include a join-room endpoint yet. Required: POST /api/rooms/join with { roomCode } or POST /api/rooms/:roomId/join.';

export async function getRoomTiers() {
  const response = await getFromApi('/rooms/tiers', (mockApi) => mockApi.getRoomTiers());
  return normalizeRoomTierList(response);
}

export async function getFeaturedRooms() {
  // The current API reference only exposes GET /rooms/tiers.
  // Avoid calling old /rooms/featured or /rooms endpoints in real mode.
  if (isMockApiEnabled()) {
    const response = await getFromApi('/rooms/featured', (mockApi) => mockApi.getFeaturedRooms());
    return normalizeRoomList(response);
  }

  return getRoomTiers();
}

export async function getRooms() {
  // The current API reference only exposes GET /rooms/tiers.
  // Room list UI should use tiers until the backend adds a public rooms endpoint.
  if (isMockApiEnabled()) {
    const response = await getFromApi('/rooms', (mockApi) => mockApi.getRooms());
    return normalizeRoomList(response);
  }

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

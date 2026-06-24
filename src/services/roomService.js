import { apiRequest } from './api.js';
import { normalizeRoomList, normalizeRoom, normalizeRoomTierList, normalizePrivateRoom } from './gameNormalizers.js';

const MISSING_JOIN_ROOM_ENDPOINT_MESSAGE = 'Join room is unavailable right now. Please try again later.';

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
  const tierId = payload.tierId || payload.roomId;
  if (!tierId) {
    throw new Error('tierId is required to create a private room.');
  }

  const requestPayload = {
    tierId,
    maxPlayers: Number(payload.maxPlayers) || 3,
  };

  const response = await apiRequest('/rooms/private', {
    method: 'POST',
    body: JSON.stringify(requestPayload),
  });
  return normalizePrivateRoom(response, requestPayload);
}

export async function createRoom(payload = {}) {
  return createPrivateRoom(payload);
}

export async function joinRoom(roomIdOrCode) {
  if (!roomIdOrCode) {
    throw new Error('Room id or room code is required.');
  }

  throw new Error(MISSING_JOIN_ROOM_ENDPOINT_MESSAGE);
}

export async function joinRoomByCode(roomCode) {
  if (!roomCode) {
    throw new Error('Room code is required.');
  }

  throw new Error(MISSING_JOIN_ROOM_ENDPOINT_MESSAGE);
}

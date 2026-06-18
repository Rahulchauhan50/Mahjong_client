import { getFromApi, postToApi } from './api.js';
import { normalizeRoomList, normalizeRoom, normalizeRoomTierList, normalizePrivateRoom } from './gameNormalizers.js';

export async function getRoomTiers() {
  const response = await getFromApi('/rooms/tiers', (mockApi) => mockApi.getRoomTiers());
  return normalizeRoomTierList(response);
}

export async function getFeaturedRooms() {
  try {
    return await getRoomTiers();
  } catch (tiersError) {
    try {
      const response = await getFromApi('/rooms/featured', (mockApi) => mockApi.getFeaturedRooms());
      return normalizeRoomList(response);
    } catch (featuredError) {
      // Keep old backends/dev mocks working while the new /rooms/tiers endpoint is rolling out.
      console.warn('Room tiers and featured rooms endpoints failed. Falling back to /rooms:', {
        tiersError,
        featuredError,
      });
      const response = await getFromApi('/rooms', (mockApi) => mockApi.getRooms());
      return normalizeRoomList(response);
    }
  }
}

export async function getRooms() {
  try {
    return await getRoomTiers();
  } catch (error) {
    console.warn('Room tiers endpoint failed. Falling back to /rooms:', error);
    const response = await getFromApi('/rooms', (mockApi) => mockApi.getRooms());
    return normalizeRoomList(response);
  }
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

export async function joinRoom(roomId) {
  const response = await postToApi(`/rooms/${encodeURIComponent(roomId)}/join`, undefined, (mockApi) => mockApi.joinRoom(roomId));
  return normalizeRoom(response);
}

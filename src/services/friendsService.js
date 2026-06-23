import { getFromApi, postToApi } from './api.js';

function unwrapPayload(response) {
  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }
  return response && typeof response === 'object' ? response : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildQueryPath(basePath, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value).trim());
    }
  });

  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function getApiErrorMessage(error, fallback = 'API request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const data = error.response?.data || error.data;

  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    return data.message || data.error || data.detail || JSON.stringify(data);
  }

  return error.message || fallback;
}

export async function searchFriendUsers(query) {
  const searchQuery = String(query || '').trim();

  if (!searchQuery) {
    return [];
  }

  const path = buildQueryPath('/friends/search', { q: searchQuery });
  const response = await getFromApi(path, (mockApi) => {
    const mockResults = mockApi.searchFriendUsers?.({ q: searchQuery })
      || mockApi.searchFriends?.({ q: searchQuery })
      || { success: true, results: [] };
    return mockResults;
  });
  const payload = unwrapPayload(response);
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  return asArray(payload.results || payload.users || payload.friends || payload.items || data.results || data.users || data.friends || data.items);
}

export async function sendFriendRequest(targetUserId) {
  if (!targetUserId) {
    throw new Error('targetUserId is required to send a friend request.');
  }

  return postToApi('/friends/request', { targetUserId }, (mockApi) => mockApi.sendFriendRequest?.({ targetUserId }) ?? { success: true });
}

export async function acceptFriendRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required to accept a friend request.');
  }

  // The API document says /friends/accept expects { requestId },
  // but the live backend currently returns "friendshipId is required".
  // Send both keys with the same value so the frontend works with either contract.
  const payload = { requestId, friendshipId: requestId };

  return postToApi('/friends/accept', payload, (mockApi) => mockApi.acceptFriendRequest?.(payload) ?? { success: true });
}

export async function declineFriendRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required to decline a friend request.');
  }

  // Keep decline compatible with both documented and live backend field names.
  const payload = { requestId, friendshipId: requestId };

  return postToApi('/friends/decline', payload, (mockApi) => mockApi.declineFriendRequest?.(payload) ?? { success: true });
}

export async function getFriends() {
  const response = await getFromApi('/friends', (mockApi) => mockApi.getFriends?.() ?? { success: true, friends: [] });
  const payload = unwrapPayload(response);
  return asArray(payload.friends || payload.items || payload.users);
}

export async function getIncomingFriendRequests() {
  const response = await getFromApi('/friends/requests', (mockApi) => mockApi.getIncomingFriendRequests?.() ?? { success: true, requests: [] });
  const payload = unwrapPayload(response);
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  return asArray(
    payload.requests
      || payload.items
      || payload.friendRequests
      || payload.incomingRequests
      || payload.receivedRequests
      || payload.pendingRequests
      || data.requests
      || data.items
      || data.friendRequests
      || data.incomingRequests
      || data.receivedRequests
      || data.pendingRequests
  );
}

export async function getSentFriendRequests() {
  const response = await getFromApi('/friends/requests/sent', (mockApi) => mockApi.getSentFriendRequests?.() ?? { success: true, requests: [] });
  const payload = unwrapPayload(response);
  return asArray(payload.requests || payload.items);
}

export async function removeFriend(friendId) {
  if (!friendId) {
    throw new Error('friendId is required to remove a friend.');
  }

  return postToApi('/friends/remove', { friendId }, (mockApi) => mockApi.removeFriend?.({ friendId }) ?? { success: true });
}

export async function blockUser(targetUserId) {
  if (!targetUserId) {
    throw new Error('targetUserId is required to block a user.');
  }

  return postToApi('/friends/block', { targetUserId }, (mockApi) => mockApi.blockUser?.({ targetUserId }) ?? { success: true });
}

export async function unblockUser(targetUserId) {
  if (!targetUserId) {
    throw new Error('targetUserId is required to unblock a user.');
  }

  return postToApi('/friends/unblock', { targetUserId }, (mockApi) => mockApi.unblockUser?.({ targetUserId }) ?? { success: true });
}

export async function getBulkFriendStatus(userIds = []) {
  const response = await postToApi('/friends/status', { userIds }, (mockApi) => mockApi.getBulkFriendStatus?.({ userIds }) ?? { success: true, statuses: {} });
  const payload = unwrapPayload(response);
  return payload.statuses || {};
}

export async function getOnlineUsers() {
  const response = await getFromApi('/friends/online/users', (mockApi) => mockApi.getOnlineUsers?.() ?? { success: true, users: [] });
  const payload = unwrapPayload(response);
  return asArray(payload.users || payload.friends);
}

export async function getOnlineCount() {
  const response = await getFromApi('/friends/online/count', (mockApi) => mockApi.getOnlineCount?.() ?? { success: true, count: 0 });
  const payload = unwrapPayload(response);
  return Number(payload.count ?? payload.onlineCount ?? 0) || 0;
}

export async function getFriendSuggestions() {
  const response = await getFromApi('/friends/suggestions', (mockApi) => mockApi.getFriendSuggestions?.() ?? { success: true, suggestions: [] });
  const payload = unwrapPayload(response);
  return asArray(payload.suggestions || payload.users);
}

export async function createInviteCode() {
  return postToApi('/friends/invite-codes/create', undefined, (mockApi) => mockApi.createInviteCode?.() ?? { success: true, inviteCode: '' });
}

export async function getInviteCodes() {
  const response = await getFromApi('/friends/invite-codes', (mockApi) => mockApi.getInviteCodes?.() ?? { success: true, codes: [] });
  const payload = unwrapPayload(response);
  return asArray(payload.codes || payload.inviteCodes);
}

export async function redeemInviteCode(code) {
  return postToApi('/friends/invite-codes/redeem', { code }, (mockApi) => mockApi.redeemInviteCode?.({ code }) ?? { success: true });
}

export async function validateInviteCode(code) {
  const response = await postToApi('/friends/invite-codes/validate', { code }, (mockApi) => mockApi.validateInviteCode?.({ code }) ?? { success: true, isValid: true });
  const payload = unwrapPayload(response);
  return Boolean(payload.isValid ?? payload.valid ?? payload.success);
}

export async function getReferralStats() {
  return getFromApi('/friends/invite-codes/stats', (mockApi) => mockApi.getReferralStats?.() ?? { success: true, totalReferred: 0, rewardsEarned: 0 });
}

export async function disableInviteCode(codeId) {
  return postToApi('/friends/invite-codes/disable', { codeId }, (mockApi) => mockApi.disableInviteCode?.({ codeId }) ?? { success: true });
}

import { mockAchievements, mockPlayerProfile, mockProfileStats } from './mockProfile.js';
import { mockFeaturedRooms, mockRoomList, mockRoomTiers } from './mockRooms.js';
import { mockMatchFound, mockMatchmakingSession } from './mockMatchmaking.js';
import { mockGameResult, mockGameState } from './mockGameState.js';

const delay = (ms = 220) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const createId = (prefix) => `${prefix}_${Date.now()}`;

export const mockApi = {
  async registerUser(payload = {}) {
    await delay();
    return {
      message: 'User registered successfully',
      userId: createId('user'),
      user: {
        ...mockPlayerProfile,
        id: createId('user'),
        username: payload.username || mockPlayerProfile.username,
        email: payload.email || 'player1@example.com',
      },
    };
  },

  async login(credentials = {}) {
    await delay();
    return {
      message: 'Login successful',
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      user: {
        ...mockPlayerProfile,
        username: credentials.username || mockPlayerProfile.username,
        name: credentials.username || mockPlayerProfile.name,
        email: credentials.email || 'Stevie22@gmail.com',
      },
    };
  },

  async refreshToken() {
    await delay();
    return {
      accessToken: 'mock_refreshed_access_token',
      refreshToken: 'mock_refresh_token_2',
    };
  },

  async continueAsGuest() {
    await delay();
    return {
      accessToken: 'mock_guest_access_token',
      refreshToken: 'mock_guest_refresh_token',
      user: {
        ...mockPlayerProfile,
        id: 'guest_player',
        name: 'Guest',
      },
    };
  },

  async getProfile() {
    await delay();
    return {
      success: true,
      profile: mockPlayerProfile,
    };
  },

  async updateProfile(payload = {}) {
    await delay();
    return {
      success: true,
      message: 'Profile updated',
      profile: {
        ...mockPlayerProfile,
        ...payload,
      },
    };
  },

  async getPublicProfile(userId) {
    await delay();
    return {
      success: true,
      profile: {
        ...mockPlayerProfile,
        id: userId,
        trophies: 500,
      },
    };
  },

  async getProfileStats() {
    await delay();
    return mockProfileStats;
  },

  async getAchievements() {
    await delay();
    return { success: true, achievements: mockAchievements };
  },

  async claimAchievement(achievementId) {
    await delay();
    return {
      success: true,
      achievementId,
      message: 'Achievement claimed',
    };
  },


  async getBalances() {
    await delay();
    return {
      success: true,
      balances: {
        coins: 125600,
        diamonds: 2450,
      },
    };
  },

  async getTransactionHistory() {
    await delay();
    return {
      success: true,
      transactions: [
        { id: 'txn_reward_001', type: 'reward', amount: 300, currency: 'coins', createdAt: new Date().toISOString() },
        { id: 'txn_entry_001', type: 'entry_fee', amount: -500, currency: 'coins', createdAt: new Date().toISOString() },
        { id: 'txn_chest_001', type: 'chest_reward', amount: 5, currency: 'diamonds', createdAt: new Date().toISOString() },
      ],
    };
  },

  async validateTransaction(payload = {}) {
    await delay();
    const balances = { coins: 125600, diamonds: 2450 };
    const currency = payload.currencyType || payload.currency || 'coins';
    const amount = Number(payload.amount) || 0;

    return {
      success: true,
      canAfford: (balances[currency] || 0) >= amount,
      balances,
    };
  },

  async getDailyRewardStatus() {
    await delay();
    return {
      success: true,
      currentStreak: 3,
      canClaimToday: true,
      nextReward: {
        coins: 500,
        diamonds: 0,
        chest: null,
      },
      rewardSchedule: [
        { day: 1, coins: 300, diamonds: 0, chest: null },
        { day: 2, coins: 0, diamonds: 10, chest: null },
        { day: 3, coins: 500, diamonds: 0, chest: null },
        { day: 4, coins: 700, diamonds: 0, chest: null },
        { day: 5, coins: 0, diamonds: 20, chest: null },
        { day: 6, coins: 0, diamonds: 0, chest: 'basic_chest' },
        { day: 7, coins: 1000, diamonds: 0, chest: null },
      ],
    };
  },

  async claimDailyReward() {
    await delay();
    return {
      success: true,
      streak: {
        current: 4,
      },
      rewards: {
        coinsAdded: 500,
        diamondsAdded: 0,
        chestGiven: null,
        chestResult: null,
      },
      balances: {
        coins: 126100,
        diamonds: 2450,
      },
    };
  },

  async getStreakInfo() {
    await delay();
    return {
      success: true,
      streakDays: [
        { date: '2026-06-13', claimed: true },
        { date: '2026-06-14', claimed: true },
        { date: '2026-06-15', claimed: true },
        { date: '2026-06-16', claimed: false },
      ],
    };
  },

  async getAllChests() {
    await delay();
    return {
      success: true,
      chests: [
        { chestId: 'basic_chest', name: 'Basic Chest', cost: 500, currencyType: 'coins' },
        { chestId: 'premium_chest', name: 'Premium Chest', cost: 50, currencyType: 'diamonds' },
      ],
    };
  },

  async openChest(payload = {}) {
    await delay();
    return {
      success: true,
      chestId: payload.chestId,
      rewards: [
        { type: 'avatar', itemName: 'Fox' },
        { type: 'currency', amount: 100, currency: 'coins' },
      ],
    };
  },

  async getRoomTiers() {
    await delay();
    return { success: true, tiers: mockRoomTiers };
  },

  async getFeaturedRooms() {
    await delay();
    return mockFeaturedRooms;
  },

  async getRooms() {
    await delay();
    return mockRoomList;
  },

  async createPrivateRoom(payload) {
    await delay();
    return {
      success: true,
      roomCode: String(Math.floor(1000 + Math.random() * 9000)),
      roomId: createId('private_room'),
      ...payload,
    };
  },

  async createRoom(payload) {
    await delay();
    return {
      id: createId('room'),
      status: 'created',
      ...payload,
    };
  },

  async joinRoom(roomId) {
    await delay();
    return {
      id: roomId,
      status: 'joined',
    };
  },

  async startMatchmaking(payload = {}) {
    await delay(260);
    return {
      ...mockMatchmakingSession,
      roomId: payload.roomId || 'quick_match',
      maxPlayers: payload.maxPlayers || 3,
    };
  },

  async getMatchmakingStatus(sessionId) {
    await delay(300);
    return {
      ...mockMatchFound,
      id: sessionId || mockMatchFound.id,
    };
  },

  async cancelMatchmaking(sessionId) {
    await delay();
    return {
      id: sessionId,
      status: 'cancelled',
    };
  },

  async getGameState(matchId = mockGameState.matchId) {
    await delay();
    return {
      ...mockGameState,
      matchId,
    };
  },

  async getGameResult(matchId = mockGameResult.matchId) {
    await delay();
    return {
      ...mockGameResult,
      matchId,
    };
  },

  async sendGameAction(matchId, action) {
    await delay(120);
    return {
      matchId,
      accepted: true,
      action,
      serverTime: new Date().toISOString(),
    };
  },

  async leaveGame(matchId) {
    await delay();
    return {
      matchId,
      status: 'left',
    };
  },

  async finishGame(matchId, payload = {}) {
    await delay();
    return {
      ...mockGameResult,
      matchId,
      ...payload,
    };
  },
};

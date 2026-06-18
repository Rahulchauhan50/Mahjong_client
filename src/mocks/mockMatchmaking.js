export const mockMatchmakingSession = {
  id: 'mock_matchmaking_001',
  status: 'searching',
  estimatedWaitSeconds: 12,
  players: [
    { id: 'player_stevie', name: 'Stevie', avatar: 'icon_01_stevie.png', ready: true },
    { id: 'search_01', name: 'Searching', avatar: 'icon_02_searching.png', ready: false },
    { id: 'player_panda', name: 'Panda', avatar: 'icon_04_panda.png', ready: true },
  ],
};

export const mockMatchFound = {
  ...mockMatchmakingSession,
  status: 'found',
  matchId: 'mock_match_001',
  players: mockMatchmakingSession.players.map((player) => ({
    ...player,
    ready: true,
    name: player.name === 'Searching' ? 'Guest Player' : player.name,
  })),
};

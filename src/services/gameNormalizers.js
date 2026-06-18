export function normalizePlayer(player = {}, index = 0) {
  const fallbackPositions = ['top', 'left', 'right', 'bottom'];

  return {
    ...player,
    id: player.id || player.userId || player.playerId || `player_${index + 1}`,
    name: player.name || player.username || player.displayName || `Player ${index + 1}`,
    avatar: player.avatar || player.avatarUrl || player.icon || 'Stevie.png',
    coins: player.coins ?? player.balance ?? player.score ?? '0',
    position: player.position || fallbackPositions[index] || 'left',
    ready: Boolean(player.ready ?? player.isReady),
    handTiles: player.handTiles || player.hand || player.tiles || [],
    handCount: player.handCount ?? player.tileCount ?? player.tilesCount ?? player.handTiles?.length ?? player.hand?.length ?? 0,
    discardTiles: player.discardTiles || player.discards || player.discardPile || player.discardedTiles || [],
  };
}

export function normalizeGameState(response = {}) {
  const safeResponse = response && typeof response === 'object' ? response : {};
  const state = safeResponse.game || safeResponse.gameState || safeResponse.state || safeResponse;
  const players = Array.isArray(state.players)
    ? state.players.map(normalizePlayer)
    : [];

  return {
    ...state,
    matchId: state.matchId || state.id || safeResponse.matchId,
    room: state.room || safeResponse.room || { id: state.roomId, name: state.roomName },
    players,
    activeTurnPosition: state.activeTurnPosition || state.currentTurnPosition || state.turnPosition,
    currentTurnPlayerId: state.currentTurnPlayerId || state.turnPlayerId,
    round: state.round || state.windRound || 'East 1',
    timer: state.timer ?? state.remainingSeconds ?? 18,
    handTiles: state.handTiles || state.playerHand || state.myHand || state.currentPlayerHand || [],
    discards: state.discards || state.discardTiles || state.discardPiles || {},
    centerTiles: state.centerTiles || state.centerDiscardTiles || state.centerMeldTiles || state.meldTiles || state.melds?.center || [],
    availableActions: state.availableActions || state.actions || state.allowedActions || [],
    status: state.status || safeResponse.status,
    winner: state.winner || safeResponse.winner,
    winnerId: state.winnerId || safeResponse.winnerId,
    result: state.result || safeResponse.result,
  };
}

export function normalizeMatchmakingSession(response = {}) {
  const safeResponse = response && typeof response === 'object' ? response : {};
  const session = safeResponse.session || safeResponse.matchmaking || safeResponse;
  const match = safeResponse.match || session.match || null;
  const matchId = session.matchId || safeResponse.matchId || match?.id || match?.matchId || null;

  return {
    ...session,
    id: session.id || session.sessionId || safeResponse.sessionId,
    sessionId: session.sessionId || session.id || safeResponse.sessionId,
    status: session.status || safeResponse.status || (matchId ? 'found' : 'searching'),
    matchId,
    roomId: session.roomId || safeResponse.roomId || match?.roomId,
    players: Array.isArray(session.players)
      ? session.players.map(normalizePlayer)
      : [],
  };
}


const ROOM_TIER_SKINS = [
  { bg: 'room-card-green.png', character: 'panda.png', button: 'button-green.png', level: 'Beginner' },
  { bg: 'room-card-blue.png', character: 'fox.png', button: 'button-blue.png', level: 'Intermediate' },
  { bg: 'room-card-purple.png', character: 'bunny.png', button: 'button-violet.png', level: 'Advanced' },
  { bg: 'room-card-gold.png', character: 'bird.png', button: 'button-gold.png', level: 'Master' },
];

function formatCoins(value, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString('en-US') : String(value);
}

function titleFromTierId(tierId = '') {
  const clean = String(tierId || 'sakura_garden_3p')
    .replace(/_?\d+p$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return clean
    ? clean.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Sakura Garden';
}

export function normalizeRoomTier(tier = {}, index = 0) {
  const tierId = tier.tierId || tier.id || tier.roomId || `room_tier_${index + 1}`;
  const entryFee = tier.entryFee?.amount ?? tier.entryFee ?? tier.fee ?? tier.bet ?? 0;
  const skin = ROOM_TIER_SKINS[index % ROOM_TIER_SKINS.length];
  const name = tier.name || tier.title || tier.roomName || titleFromTierId(tierId);
  const maxPlayers = Number(tier.maxPlayers || tier.playersCount || String(tierId).match(/(\d+)p/i)?.[1] || 3);

  return {
    ...tier,
    id: tierId,
    roomId: tierId,
    tierId,
    title: String(tier.title || name).toUpperCase(),
    name,
    level: tier.level || tier.difficulty || skin.level,
    maxPlayers,
    players: tier.players ?? tier.onlinePlayers ?? tier.playerCount ?? '—',
    fee: formatCoins(entryFee, '0'),
    bet: `${formatCoins(entryFee, '0')} coins`,
    entryFee: { amount: Number(entryFee) || 0 },
    prize: tier.prize ?? tier.prizePool ?? formatCoins((Number(entryFee) || 0) * maxPlayers, '0'),
    bg: tier.bg || tier.background || skin.bg,
    character: tier.character || tier.avatar || skin.character,
    button: tier.button || skin.button,
    status: tier.status || 'Available',
  };
}

export function normalizeRoomTierList(response = {}) {
  const list = response.tiers || response.roomTiers || response.data?.tiers || response.data || response;
  return Array.isArray(list) ? list.map(normalizeRoomTier) : [];
}

export function normalizePrivateRoom(response = {}, requestPayload = {}) {
  const room = response.room || response.privateRoom || response.data || response;
  return {
    ...room,
    id: room.roomId || room.id || requestPayload.tierId,
    roomId: room.roomId || room.id || requestPayload.tierId,
    roomCode: room.roomCode || room.code || '',
    tierId: room.tierId || requestPayload.tierId,
    maxPlayers: Number(room.maxPlayers || requestPayload.maxPlayers || 3),
    status: room.status || 'created',
  };
}

export function normalizeRoom(room = {}) {
  return {
    ...room,
    id: room.id || room.roomId || room.slug || room.title,
    title: room.title || room.name || room.roomName || 'SAKURA ROOM',
    name: room.name || room.title || room.roomName || 'Sakura Room',
    level: room.level || room.tier || room.difficulty || 'Beginner',
    players: room.players ?? room.onlinePlayers ?? room.playerCount ?? '0',
    fee: room.fee ?? room.bet ?? room.entryFee ?? '500',
    prize: room.prize ?? room.prizePool ?? '2,000',
    bg: room.bg || room.background || 'room-card-green.png',
    character: room.character || room.avatar || 'panda.png',
    button: room.button || 'button-green.png',
  };
}

export function normalizeRoomList(response = []) {
  const list = response.rooms || response.featuredRooms || response.data || response;
  return Array.isArray(list) ? list.map(normalizeRoom) : [];
}

function normalizeScoreValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

export function normalizeResultPlayer(player = {}, index = 0, winnerId = null) {
  const id = player.id || player.userId || player.playerId || `result_player_${index + 1}`;
  const score = normalizeScoreValue(
    player.scoreDelta ?? player.delta ?? player.pointsDelta ?? player.reward ?? player.score,
    index === 0 ? 0 : 0
  );

  return {
    ...player,
    id,
    name: player.name || player.username || player.displayName || `Player ${index + 1}`,
    avatar: player.avatar || player.avatarUrl || player.icon || player.resultAvatar || (index === 0 ? 'ic1.png' : index === 1 ? 'ic2.png' : 'ic3.png'),
    score,
    scoreDelta: score,
    totalScore: player.totalScore ?? player.points ?? player.balance,
    isWinner: Boolean(player.isWinner ?? player.winner ?? (winnerId && id === winnerId)),
  };
}

function normalizeSummaryRows(result = {}) {
  const rows = result.summaryRows || result.roundSummary || result.summary || result.scoring || result.scoreBreakdown || [];

  if (Array.isArray(rows)) {
    return rows.map((row, index) => {
      if (Array.isArray(row)) {
        return { labelKey: row[0], value: row[1] };
      }

      return {
        id: row.id || `summary_${index + 1}`,
        label: row.label || row.name || row.title,
        labelKey: row.labelKey || row.key || row.translationKey,
        value: row.value ?? row.points ?? row.score ?? row.amount ?? '',
        valueKey: row.valueKey,
      };
    });
  }

  return Object.entries(rows).map(([labelKey, value]) => ({ labelKey, value }));
}

export function normalizeGameResult(response = {}) {
  const safeResponse = response && typeof response === 'object' ? response : { result: response };
  const result = safeResponse.result && typeof safeResponse.result === 'object'
    ? safeResponse.result
    : safeResponse.gameResult || safeResponse.roundResult || safeResponse.data || safeResponse;
  const winnerId = result.winnerId || result.winner?.id || result.winner?.userId || safeResponse.winnerId;
  const playerList = result.players || result.results || result.standings || result.scoreboard || [];
  const players = Array.isArray(playerList)
    ? playerList.map((player, index) => normalizeResultPlayer(player, index, winnerId))
    : [];
  const normalizedWinner = result.winner
    ? normalizeResultPlayer(result.winner, 0, winnerId)
    : players.find((player) => player.isWinner || player.id === winnerId) || players[0];
  const resultType = typeof result.result === 'string'
    ? result.result
    : result.outcome || result.status || safeResponse.status || 'win';

  return {
    ...result,
    matchId: result.matchId || result.id || safeResponse.matchId,
    roomId: result.roomId || result.room?.id || safeResponse.roomId,
    maxPlayers: result.maxPlayers || result.room?.maxPlayers || safeResponse.maxPlayers,
    status: result.status || safeResponse.status,
    result: resultType,
    title: result.title || result.heading,
    titleKey: result.titleKey,
    winnerId,
    winner: normalizedWinner,
    players,
    summaryRows: normalizeSummaryRows(result),
    rewards: result.rewards || result.reward || safeResponse.rewards || {},
    totalScore: result.totalScore ?? result.score ?? result.finalScore ?? normalizedWinner?.score ?? result.rewards?.coins,
  };
}

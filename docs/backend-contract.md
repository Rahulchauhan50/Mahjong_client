# Sakura Mahjong Backend Contract Draft

This frontend can run in mock mode or real backend mode.

## Environment

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## REST endpoints expected

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/profile`
- `PATCH /auth/profile`
- `GET /auth/profile/:userId`

### Rooms
- `GET /rooms/featured`
- `GET /rooms`
- `POST /rooms`
- `POST /rooms/:roomId/join`

### Matchmaking
- `POST /matchmaking/start`
- `GET /matchmaking/:sessionId/status`
- `DELETE /matchmaking/:sessionId`

The frontend expects the status response to include a `matchId` once the match is found.

### Game
- `GET /games/:matchId`
- `POST /games/:matchId/actions`
- `POST /games/:matchId/leave`
- `POST /games/:matchId/finish`

## Realtime

The frontend opens:

```txt
ws(s)://<VITE_SOCKET_URL>/games/:matchId?token=<accessToken>
```

Preferred message shape:

```json
{
  "type": "game_state",
  "payload": {
    "matchId": "match_123",
    "room": { "id": "room_1", "name": "My Sakura Room" },
    "players": [],
    "activeTurnPosition": "left",
    "round": "East 1",
    "timer": 18
  }
}
```

The frontend also accepts equivalent keys like `event`, `eventName`, `gameState`, `state`, or `data` and normalizes them in `src/services/gameNormalizers.js`.

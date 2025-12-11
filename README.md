# Bommen Barend Online 💣

A Dutch-themed Bomberman clone with **authoritative server architecture** using Colyseus.

## Architecture

This game uses a **server-authoritative** model where all game logic runs on the server:

- **Server** (`server/`): Node.js + Colyseus handles:
  - Room creation and matchmaking
  - All game physics and collision detection
  - Bomb placement, explosions, and damage
  - Powerup spawning and collection
  - Win/lose conditions

- **Client** (`App.tsx`): React + Colyseus.js handles:
  - Sending player input to server
  - Receiving and rendering authoritative game state
  - UI and touch controls

This prevents cheating and ensures consistent gameplay across all players.

## Running the Game

### Development (2 terminals)

**Terminal 1 - Start the Colyseus server:**
```bash
npm install
npm run server
```

**Terminal 2 - Start the Vite dev server:**
```bash
npm run dev
```

Open http://localhost:3000 in multiple browser windows to test multiplayer.

### Production

```bash
npm run start
```

This builds the client and starts the server on port 2567.

## How to Play

1. **Quick Match**: Automatically finds or creates a room
2. **Create Room**: Start a new room and share the Room ID
3. **Join Room**: Enter a Room ID to join a friend's game

### Controls

- **WASD** or **Arrow Keys**: Move
- **Space**: Place bomb
- **Mobile**: Touch controls shown on screen

### Power-ups

- 💣 **Bomb**: Increase max bombs
- 🔥 **Range**: Increase explosion range  
- 👟 **Speed**: Move faster
- 🌭 **Unox**: All power-ups + an ad!

## Tech Stack

- **Server**: Node.js, Express, Colyseus
- **Client**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Protocol**: WebSocket (Colyseus Schema sync)

## Files

```
bommen-barend-online/
├── server/
│   ├── index.js          # Express + Colyseus server
│   └── rooms/
│       └── BomberRoom.js # Game room with authoritative logic
├── App.tsx               # Main React component with Colyseus client
├── components/
│   ├── GameCanvas.tsx    # Canvas rendering
│   └── Lobby.tsx         # Room creation/joining UI
├── types.ts              # TypeScript interfaces
├── constants.ts          # Game constants
└── utils/
    └── gameLogic.ts      # (Legacy - logic now on server)
```

## Network Protocol

### Client → Server
- `input`: `{ dx: number, dy: number, placeBomb: boolean }`

### Server → Client  
- State sync via Colyseus Schema (automatic)

## Credits

Dutch-themed Bomberman clone. "Bommen Barend" = "Bombing Barend" in Dutch.

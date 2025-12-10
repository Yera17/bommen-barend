<div align="center">

# 💣 Bommen Barend Online

**A real-time multiplayer Bomberman clone with Dutch flair**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev)
[![PeerJS](https://img.shields.io/badge/PeerJS-WebRTC-FF6B35)](https://peerjs.com/)

<img width="600" alt="Bommen Barend Online" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

*Blow up your friends in this browser-based arena battler!*

[Play Now](#-quick-start) · [How to Play](#-how-to-play) · [Features](#-features)

</div>

---

## 🎮 About

**Bommen Barend** is a fast-paced, browser-based multiplayer game inspired by the classic Bomberman series. Challenge a friend to a 1v1 battle using peer-to-peer WebRTC connections — no server required!

Built with React and PeerJS, the game runs entirely in your browser with real-time synchronization between players.

## ✨ Features

- 🌐 **Peer-to-Peer Multiplayer** — Connect directly with friends using WebRTC (PeerJS)
- ⚡ **Real-time Gameplay** — Smooth 60fps game loop with authoritative host
- 💣 **Classic Bomberman Mechanics** — Place bombs, destroy blocks, collect powerups
- 📱 **Mobile Support** — Touch controls for playing on phones and tablets
- 🎨 **Dutch Theme** — Orange-themed UI with Dutch messages
- 🚀 **Zero Server Costs** — Direct browser-to-browser connections

## 🎁 Power-ups

| Icon | Type | Effect |
|:----:|:-----|:-------|
| 💣 | **Bomb** | +1 maximum bomb capacity |
| 🔥 | **Range** | +1 explosion range |
| 👟 | **Speed** | Increased movement speed |
| 🌭 | **Unox** | All powerups combined! (rare) |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/bommen-barend-online.git
cd bommen-barend-online

# Install dependencies
npm install

# Start the development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Building for Production

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

## 🕹️ How to Play

### Starting a Game

1. **Host a Game**: Click "Create New Game" and share your Peer ID with a friend
2. **Join a Game**: Paste your friend's Peer ID and click "Join Game"
3. Once connected, the game starts automatically!

### Controls

#### Keyboard (Desktop)
| Key | Action |
|-----|--------|
| `W` / `↑` | Move Up |
| `S` / `↓` | Move Down |
| `A` / `←` | Move Left |
| `D` / `→` | Move Right |
| `Space` | Place Bomb |

#### Touch (Mobile)
- Use the on-screen D-pad for movement
- Tap the **BOMB** button to place bombs

### Objective

- Destroy blocks to find power-ups
- Trap your opponent with strategic bomb placement
- Survive! Last player standing wins 🏆

## 🏗️ Project Structure

```
bommen-barend-online/
├── App.tsx              # Main game component & networking logic
├── index.tsx            # React entry point
├── index.html           # HTML template
├── types.ts             # TypeScript type definitions
├── constants.ts         # Game configuration constants
├── components/
│   ├── GameCanvas.tsx   # Canvas-based game renderer
│   └── Lobby.tsx        # Connection lobby UI
├── utils/
│   └── gameLogic.ts     # Core game physics & rules
├── vite.config.ts       # Vite configuration
└── package.json         # Dependencies & scripts
```

## 🔧 Configuration

Game constants can be modified in `constants.ts`:

```typescript
export const COLS = 13;              // Grid width
export const ROWS = 11;              // Grid height
export const TILE_SIZE = 40;         // Pixel size per tile
export const INITIAL_LIVES = 3;      // Starting lives
export const BOMB_TIMER = 3;         // Seconds until explosion
export const MOVEMENT_SPEED_BASE = 150; // Pixels per second
```

## 🌐 Networking Architecture

The game uses a **host-authoritative** model:

1. **Host** creates the game state and runs all physics/collision logic
2. **Client** sends input commands to the host
3. **Host** broadcasts updated game state to the client each frame
4. Both players render the same synchronized state

This ensures consistent gameplay while keeping latency minimal through WebRTC's direct peer connections.

## 🛠️ Tech Stack

- **[React 19](https://react.dev)** — UI framework
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[Vite](https://vitejs.dev)** — Build tool & dev server
- **[PeerJS](https://peerjs.com/)** — WebRTC peer-to-peer connections
- **[Tailwind CSS](https://tailwindcss.com)** — Styling (via CDN)

## 📜 License

MIT License — feel free to use, modify, and distribute!

---

<div align="center">

**Made with 🧡 and 💣**

*Veel plezier! (Have fun!)*

</div>

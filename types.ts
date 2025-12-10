export enum TileType {
  EMPTY = 0,
  WALL = 1,  // Indestructible (Dijk)
  BLOCK = 2  // Destructible (Tulp)
}

export enum PowerupType {
  BOMB = 'bomb',
  RANGE = 'range',
  SPEED = 'speed',
  UNOX = 'unox'
}

export interface Entity {
  gx: number; // Grid X
  gy: number; // Grid Y
  x: number;  // Pixel X
  y: number;  // Pixel Y
}

export interface Player extends Entity {
  id: string;
  isBot: boolean; // Kept for legacy, though primarily P2P now
  lives: number;
  maxBombs: number;
  activeBombs: number;
  range: number;
  speed: number;
  moving: boolean;
  targetX: number;
  targetY: number;
  invincibleTimer: number;
  color: string;
  direction: 'up' | 'down' | 'left' | 'right' | null;
}

export interface Bomb extends Entity {
  id: string;
  ownerId: string;
  timer: number;
  range: number;
}

export interface Explosion extends Entity {
  id: string;
  timer: number;
}

export interface Powerup extends Entity {
  id: string;
  type: PowerupType;
}

export interface GameState {
  grid: number[][];
  players: { [id: string]: Player };
  bombs: Bomb[];
  explosions: Explosion[];
  powerups: Powerup[];
  winner: string | null;
  adVisible: boolean;
}

// Network Payloads
export interface InputPayload {
  dx: number;
  dy: number;
  placeBomb: boolean;
}

export interface InitPayload {
  type: 'INIT';
  playerId: string; // The ID assigned to the connecting client
  gameState: GameState;
}

export interface UpdatePayload {
  type: 'UPDATE';
  gameState: GameState;
}

import { Room, Client } from 'colyseus';
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

// Constants
const COLS = 13;
const ROWS = 11;
const TILE_SIZE = 40;
const INITIAL_LIVES = 3;
const BOMB_TIMER = 3;
const EXPLOSION_TIMER = 0.5;
const MOVEMENT_SPEED_BASE = 150;

const TileType = {
  EMPTY: 0,
  WALL: 1,
  BLOCK: 2
} as const;

const PowerupType = {
  BOMB: 'bomb',
  RANGE: 'range',
  SPEED: 'speed',
  UNOX: 'unox'
} as const;

type PowerupTypeValue = typeof PowerupType[keyof typeof PowerupType];

// Input interface
interface InputPayload {
  dx: number;
  dy: number;
  placeBomb: boolean;
}

// --- Schema Definitions ---

class Player extends Schema {
  @type('string') id: string = '';
  @type('number') gx: number = 0;
  @type('number') gy: number = 0;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') targetX: number = 0;
  @type('number') targetY: number = 0;
  @type('boolean') moving: boolean = false;
  @type('number') lives: number = INITIAL_LIVES;
  @type('number') maxBombs: number = 1;
  @type('number') activeBombs: number = 0;
  @type('number') range: number = 1;
  @type('number') speed: number = 1;
  @type('number') invincibleTimer: number = 0;
  @type('string') color: string = '#FF6B35';
  @type('string') emoji: string = '';
  @type('number') emojiTimer: number = 0;
}

class ChatMessage extends Schema {
  @type('string') playerId: string = '';
  @type('string') message: string = '';
  @type('number') timestamp: number = 0;
}

class Bomb extends Schema {
  @type('string') id: string = '';
  @type('number') gx: number = 0;
  @type('number') gy: number = 0;
  @type('string') ownerId: string = '';
  @type('number') timer: number = BOMB_TIMER;
  @type('number') range: number = 1;
}

class Explosion extends Schema {
  @type('string') id: string = '';
  @type('number') gx: number = 0;
  @type('number') gy: number = 0;
  @type('number') timer: number = EXPLOSION_TIMER;
}

class Powerup extends Schema {
  @type('string') id: string = '';
  @type('number') gx: number = 0;
  @type('number') gy: number = 0;
  @type('string') type: PowerupTypeValue = PowerupType.BOMB;
}

class GridRow extends Schema {
  @type(['number']) tiles = new ArraySchema<number>();
}

class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Bomb]) bombs = new ArraySchema<Bomb>();
  @type([Explosion]) explosions = new ArraySchema<Explosion>();
  @type([Powerup]) powerups = new ArraySchema<Powerup>();
  @type([GridRow]) grid = new ArraySchema<GridRow>();
  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
  @type('string') winner: string = '';
  @type('boolean') adVisible: boolean = false;
  @type('boolean') gameStarted: boolean = false;
  @type('number') rematchVotes: number = 0;
  @type('boolean') rematchPending: boolean = false;
}

// --- Room Logic ---

export class BomberRoom extends Room<GameState> {
  private tickRate = 30;
  private playerInputs: { [sessionId: string]: InputPayload } = {};
  private rematchPlayers: Set<string> = new Set();

  onCreate(_options: any): void {
    this.setState(new GameState());
    this.maxClients = 2;
    
    this.clock.setInterval(() => this.onTick(), 1000 / this.tickRate);

    this.onMessage('input', (client: Client, message: InputPayload) => {
      this.playerInputs[client.sessionId] = message;
    });

    this.onMessage('rematch', (client: Client) => {
      if (!this.state.winner) return; // Game not over yet
      
      // Check if this player already voted
      if (this.rematchPlayers.has(client.sessionId)) return;
      
      this.rematchPlayers.add(client.sessionId);
      this.state.rematchVotes = this.rematchPlayers.size;
      this.state.rematchPending = true;
      
      console.log(`Player ${client.sessionId} voted for rematch (${this.state.rematchVotes}/2)`);
      
      // If both players voted, restart the game
      if (this.rematchPlayers.size >= 2) {
        this.restartGame();
      }
    });

    // Emoji reactions (I, J, K, L keys)
    this.onMessage('emoji', (client: Client, emoji: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.emoji = emoji;
        player.emojiTimer = 2; // Show for 2 seconds
      }
    });

    // Post-game chat
    this.onMessage('chat', (client: Client, message: string) => {
      if (!this.state.winner) return; // Only allow chat after game ends
      if (!message || message.length > 100) return; // Limit message length
      
      const chatMsg = new ChatMessage();
      chatMsg.playerId = client.sessionId;
      chatMsg.message = message.substring(0, 100);
      chatMsg.timestamp = Date.now();
      
      this.state.chatMessages.push(chatMsg);
      
      // Keep only last 20 messages
      while (this.state.chatMessages.length > 20) {
        this.state.chatMessages.shift();
      }
    });

    console.log('BomberRoom created!');
  }

  onJoin(client: Client, _options: any): void {
    console.log(`Player ${client.sessionId} joined!`);
    
    const p = new Player();
    p.id = client.sessionId;
    
    // First player goes top-left, second goes bottom-right
    const playerCount = this.state.players.size;
    if (playerCount === 0) {
      p.gx = 0;
      p.gy = 0;
      p.color = '#FF6B35'; // Dutch Orange
    } else {
      p.gx = COLS - 1;
      p.gy = ROWS - 1;
      p.color = '#3B82F6'; // Blue
    }
    
    p.x = p.gx * TILE_SIZE + TILE_SIZE / 2;
    p.y = p.gy * TILE_SIZE + TILE_SIZE / 2;
    p.targetX = p.x;
    p.targetY = p.y;
    
    this.state.players.set(client.sessionId, p);
    this.playerInputs[client.sessionId] = { dx: 0, dy: 0, placeBomb: false };

    // Start game when 2 players join
    if (this.state.players.size === 2) {
      this.startGame();
      this.lock();
    }
  }

  onLeave(client: Client): void {
    console.log(`Player ${client.sessionId} left.`);
    
    // If game was ongoing, other player wins
    if (this.state.gameStarted && !this.state.winner) {
      this.state.players.forEach((player, id) => {
        if (id !== client.sessionId && player.lives > 0) {
          this.state.winner = id;
        }
      });
    }
    
    this.state.players.delete(client.sessionId);
    delete this.playerInputs[client.sessionId];
  }

  private startGame(): void {
    console.log('Starting game!');
    this.initializeGrid();
    this.state.gameStarted = true;
  }

  private restartGame(): void {
    console.log('Restarting game!');
    
    // Clear rematch state
    this.rematchPlayers.clear();
    this.state.rematchVotes = 0;
    this.state.rematchPending = false;
    
    // Clear game objects
    this.state.bombs.clear();
    this.state.explosions.clear();
    this.state.powerups.clear();
    this.state.chatMessages.clear();
    this.state.winner = '';
    this.state.adVisible = false;
    
    // Reset players
    let playerIndex = 0;
    this.state.players.forEach((player, id) => {
      // Reset position based on player order
      if (playerIndex === 0) {
        player.gx = 0;
        player.gy = 0;
        player.color = '#FF6B35';
      } else {
        player.gx = COLS - 1;
        player.gy = ROWS - 1;
        player.color = '#3B82F6';
      }
      
      player.x = player.gx * TILE_SIZE + TILE_SIZE / 2;
      player.y = player.gy * TILE_SIZE + TILE_SIZE / 2;
      player.targetX = player.x;
      player.targetY = player.y;
      player.moving = false;
      player.lives = INITIAL_LIVES;
      player.maxBombs = 1;
      player.activeBombs = 0;
      player.range = 1;
      player.speed = 1;
      player.invincibleTimer = 0;
      
      // Reset input
      this.playerInputs[id] = { dx: 0, dy: 0, placeBomb: false };
      
      playerIndex++;
    });
    
    // Reinitialize grid with new random blocks
    this.initializeGrid();
  }

  private initializeGrid(): void {
    // Clear existing grid
    this.state.grid.clear();
    
    for (let y = 0; y < ROWS; y++) {
      const row = new GridRow();
      for (let x = 0; x < COLS; x++) {
        if (x % 2 === 1 && y % 2 === 1) {
          row.tiles.push(TileType.WALL);
        } else {
          row.tiles.push(TileType.EMPTY);
        }
      }
      this.state.grid.push(row);
    }

    // Add random blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.state.grid[y].tiles[x] === TileType.EMPTY && Math.random() < 0.4) {
          const isP1Spawn = (x < 2 && y < 2);
          const isP2Spawn = (x > COLS - 3 && y > ROWS - 3);
          if (!isP1Spawn && !isP2Spawn) {
            this.state.grid[y].tiles[x] = TileType.BLOCK;
          }
        }
      }
    }
  }

  private canMoveTo(gx: number, gy: number, _playerId: string, currentGx: number, currentGy: number): boolean {
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false;
    if (this.state.grid[gy].tiles[gx] === TileType.WALL || this.state.grid[gy].tiles[gx] === TileType.BLOCK) return false;
    
    for (let i = 0; i < this.state.bombs.length; i++) {
      const b = this.state.bombs[i];
      if (b.gx === gx && b.gy === gy) {
        if (gx === currentGx && gy === currentGy) return true;
        return false;
      }
    }
    return true;
  }

  private onTick(): void {
    if (!this.state.gameStarted || this.state.winner) return;
    
    const dt = 1 / this.tickRate;

    // 1. Process player inputs
    this.state.players.forEach((player, pid) => {
      const input = this.playerInputs[pid];
      if (!input || player.lives <= 0) return;

      // Bomb placement
      if (input.placeBomb) {
        const bombAtLoc = this.state.bombs.find(b => b.gx === player.gx && b.gy === player.gy);
        if (!bombAtLoc && player.activeBombs < player.maxBombs) {
          const bomb = new Bomb();
          bomb.id = Math.random().toString(36).substr(2, 9);
          bomb.gx = player.gx;
          bomb.gy = player.gy;
          bomb.ownerId = pid;
          bomb.range = player.range;
          bomb.timer = BOMB_TIMER;
          this.state.bombs.push(bomb);
          player.activeBombs++;
        }
        input.placeBomb = false;
      }

      // Movement (only allow one direction at a time - no diagonal)
      let dx = input.dx;
      let dy = input.dy;
      
      // Prevent diagonal movement - vertical takes priority
      if (dy !== 0) dx = 0;
      
      if (!player.moving && (dx !== 0 || dy !== 0)) {
        const newGx = player.gx + dx;
        const newGy = player.gy + dy;
        
        if (this.canMoveTo(newGx, newGy, pid, player.gx, player.gy)) {
          player.moving = true;
          player.gx = newGx;
          player.gy = newGy;
          player.targetX = newGx * TILE_SIZE + TILE_SIZE / 2;
          player.targetY = newGy * TILE_SIZE + TILE_SIZE / 2;
        }
      }

      // Interpolate position
      if (player.moving) {
        const moveSpeed = MOVEMENT_SPEED_BASE * (1 + (player.speed - 1) * 0.2);
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < moveSpeed * dt) {
          player.x = player.targetX;
          player.y = player.targetY;
          player.moving = false;
          
          // Pick up powerups
          for (let i = this.state.powerups.length - 1; i >= 0; i--) {
            const p = this.state.powerups[i];
            if (p.gx === player.gx && p.gy === player.gy) {
              if (p.type === PowerupType.BOMB) player.maxBombs++;
              else if (p.type === PowerupType.RANGE) player.range++;
              else if (p.type === PowerupType.SPEED) player.speed = Math.min(player.speed + 1, 3);
              else if (p.type === PowerupType.UNOX) {
                player.maxBombs++;
                player.range++;
                player.speed = Math.min(player.speed + 1, 3);
                this.state.adVisible = true;
              }
              this.state.powerups.splice(i, 1);
              break;
            }
          }
        } else {
          player.x += (dx / dist) * moveSpeed * dt;
          player.y += (dy / dist) * moveSpeed * dt;
        }
      }

      // Invincibility
      if (player.invincibleTimer > 0) {
        player.invincibleTimer -= dt;
      }
      
      // Emoji timer
      if (player.emojiTimer > 0) {
        player.emojiTimer -= dt;
        if (player.emojiTimer <= 0) {
          player.emoji = '';
        }
      }
    });

    // 2. Process bombs
    for (let i = this.state.bombs.length - 1; i >= 0; i--) {
      const bomb = this.state.bombs[i];
      bomb.timer -= dt;
      
      if (bomb.timer <= 0) {
        const owner = this.state.players.get(bomb.ownerId);
        if (owner) owner.activeBombs--;
        
        // Create explosions
        this.createExplosion(bomb.gx, bomb.gy);
        
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const dir of dirs) {
          for (let r = 1; r <= bomb.range; r++) {
            const ex = bomb.gx + dir[0] * r;
            const ey = bomb.gy + dir[1] * r;

            if (ex < 0 || ex >= COLS || ey < 0 || ey >= ROWS) break;
            if (this.state.grid[ey].tiles[ex] === TileType.WALL) break;

            this.createExplosion(ex, ey);

            if (this.state.grid[ey].tiles[ex] === TileType.BLOCK) {
              this.state.grid[ey].tiles[ex] = TileType.EMPTY;
              this.maybeSpawnPowerup(ex, ey);
              break;
            }
          }
        }
        
        this.state.bombs.splice(i, 1);
      }
    }

    // 3. Process explosions (damage)
    for (let i = this.state.explosions.length - 1; i >= 0; i--) {
      const exp = this.state.explosions[i];
      exp.timer -= dt;
      
      if (exp.timer <= 0) {
        this.state.explosions.splice(i, 1);
      } else {
        // Check player collision using actual pixel position, not target grid position
        this.state.players.forEach((player, pid) => {
          if (player.lives <= 0 || player.invincibleTimer > 0) return;
          
          // Calculate player's actual current tile based on pixel position
          const playerActualGx = Math.floor(player.x / TILE_SIZE);
          const playerActualGy = Math.floor(player.y / TILE_SIZE);
          
          if (playerActualGx === exp.gx && playerActualGy === exp.gy) {
            player.lives--;
            player.invincibleTimer = 3;
            
            if (player.lives <= 0) {
              // Determine winner
              this.state.players.forEach((otherPlayer, otherId) => {
                if (otherId !== pid && otherPlayer.lives > 0) {
                  this.state.winner = otherId;
                }
              });
            }
          }
        });
      }
    }

    // Auto hide ad
    if (this.state.adVisible && Math.random() < 0.01) {
      this.state.adVisible = false;
    }
  }

  private createExplosion(gx: number, gy: number): void {
    const exp = new Explosion();
    exp.id = Math.random().toString(36).substr(2, 9);
    exp.gx = gx;
    exp.gy = gy;
    exp.timer = EXPLOSION_TIMER;
    this.state.explosions.push(exp);
  }

  private maybeSpawnPowerup(gx: number, gy: number): void {
    const rand = Math.random();
    let pType: PowerupTypeValue | null = null;
    
    if (rand < 0.15) pType = PowerupType.BOMB;
    else if (rand < 0.30) pType = PowerupType.RANGE;
    else if (rand < 0.40) pType = PowerupType.SPEED;
    else if (rand < 0.42) pType = PowerupType.UNOX;

    if (pType) {
      const powerup = new Powerup();
      powerup.id = Math.random().toString(36).substr(2, 9);
      powerup.gx = gx;
      powerup.gy = gy;
      powerup.type = pType;
      this.state.powerups.push(powerup);
    }
  }
}


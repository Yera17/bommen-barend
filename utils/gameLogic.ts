import { 
  GameState, Player, TileType, Bomb, Explosion, Powerup, PowerupType, 
  InputPayload 
} from '../types';
import { 
  COLS, ROWS, TILE_SIZE, MOVEMENT_SPEED_BASE, 
  BOMB_TIMER, EXPLOSION_TIMER, INITIAL_LIVES 
} from '../constants';

// Helper to create initial state
export const createInitialState = (hostId: string, clientId: string): GameState => {
  const grid: number[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row: number[] = [];
    for (let x = 0; x < COLS; x++) {
      if (x % 2 === 1 && y % 2 === 1) {
        row.push(TileType.WALL);
      } else {
        row.push(TileType.EMPTY);
      }
    }
    grid.push(row);
  }

  // Add random blocks
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === TileType.EMPTY && Math.random() < 0.4) {
        const isP1Spawn = (x < 2 && y < 2);
        const isP2Spawn = (x > COLS - 3 && y > ROWS - 3);
        if (!isP1Spawn && !isP2Spawn) {
          grid[y][x] = TileType.BLOCK;
        }
      }
    }
  }

  const createPlayer = (id: string, gx: number, gy: number, color: string): Player => ({
    id,
    gx, gy,
    x: gx * TILE_SIZE + TILE_SIZE / 2,
    y: gy * TILE_SIZE + TILE_SIZE / 2,
    targetX: gx * TILE_SIZE + TILE_SIZE / 2,
    targetY: gy * TILE_SIZE + TILE_SIZE / 2,
    moving: false,
    lives: INITIAL_LIVES,
    maxBombs: 1,
    activeBombs: 0,
    range: 1,
    speed: 1,
    isBot: false,
    invincibleTimer: 0,
    color,
    direction: null
  });

  return {
    grid,
    players: {
      [hostId]: createPlayer(hostId, 0, 0, '#FF6B35'),
      [clientId]: createPlayer(clientId, COLS - 1, ROWS - 1, '#3B82F6')
    },
    bombs: [],
    explosions: [],
    powerups: [],
    winner: null,
    adVisible: false
  };
};

// --- Physics & Logic Helpers ---

const canMoveTo = (gx: number, gy: number, grid: number[][], bombs: Bomb[], myId: string, currentGx: number, currentGy: number) => {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false;
  if (grid[gy][gx] === TileType.WALL || grid[gy][gx] === TileType.BLOCK) return false;
  
  // Bomb collision logic: Can stand on own bomb if just placed, but can't walk back onto it
  for (const b of bombs) {
    if (b.gx === gx && b.gy === gy) {
      if (gx === currentGx && gy === currentGy) return true; // Still on top of it
      return false; 
    }
  }
  return true;
};

export const updateGame = (state: GameState, dt: number, inputs: { [playerId: string]: InputPayload }): GameState => {
  if (state.winner) return state;

  const newState = { ...state };
  
  // 1. Process Inputs (Movement & Bomb Placement)
  Object.keys(newState.players).forEach(pid => {
    const player = newState.players[pid];
    const input = inputs[pid];

    // Bomb Placement
    if (input?.placeBomb && player.lives > 0) {
      const bombAtLoc = newState.bombs.find(b => b.gx === player.gx && b.gy === player.gy);
      if (!bombAtLoc && player.activeBombs < player.maxBombs) {
        newState.bombs.push({
          id: Math.random().toString(36).substr(2, 9),
          gx: player.gx,
          gy: player.gy,
          x: 0, y: 0, // unused for bombs really
          ownerId: pid,
          timer: BOMB_TIMER,
          range: player.range
        });
        player.activeBombs++;
      }
    }

    // Movement
    if (!player.moving && input && (input.dx !== 0 || input.dy !== 0) && player.lives > 0) {
      const newGx = player.gx + input.dx;
      const newGy = player.gy + input.dy;
      
      if (canMoveTo(newGx, newGy, newState.grid, newState.bombs, pid, player.gx, player.gy)) {
        player.moving = true;
        player.gx = newGx;
        player.gy = newGy;
        player.targetX = newGx * TILE_SIZE + TILE_SIZE / 2;
        player.targetY = newGy * TILE_SIZE + TILE_SIZE / 2;
      }
    }

    // Interpolate position
    if (player.moving) {
      const moveSpeed = MOVEMENT_SPEED_BASE * (1 + (player.speed - 1) * 0.2); // slight speed boost per level
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < moveSpeed * dt) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.moving = false;
        
        // Pick up powerups
        const pIndex = newState.powerups.findIndex(p => p.gx === player.gx && p.gy === player.gy);
        if (pIndex !== -1) {
          const p = newState.powerups[pIndex];
          if (p.type === PowerupType.BOMB) player.maxBombs++;
          else if (p.type === PowerupType.RANGE) player.range++;
          else if (p.type === PowerupType.SPEED) player.speed = Math.min(player.speed + 1, 3);
          else if (p.type === PowerupType.UNOX) {
            player.maxBombs++; player.range++; player.speed = Math.min(player.speed + 1, 3);
            newState.adVisible = true; // Trigger ad
          }
          newState.powerups.splice(pIndex, 1);
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
  });

  // 2. Process Bombs
  for (let i = newState.bombs.length - 1; i >= 0; i--) {
    const bomb = newState.bombs[i];
    bomb.timer -= dt;
    if (bomb.timer <= 0) {
      // Explode
      const owner = newState.players[bomb.ownerId];
      if (owner) owner.activeBombs--;
      
      newState.bombs.splice(i, 1);
      
      // Create Explosions
      const createExplosion = (gx: number, gy: number) => {
         newState.explosions.push({
           id: Math.random().toString(),
           gx, gy,
           x: gx * TILE_SIZE, y: gy * TILE_SIZE,
           timer: EXPLOSION_TIMER
         });
      };

      createExplosion(bomb.gx, bomb.gy);

      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const dir of dirs) {
        for (let r = 1; r <= bomb.range; r++) {
          const ex = bomb.gx + dir[0] * r;
          const ey = bomb.gy + dir[1] * r;

          if (ex < 0 || ex >= COLS || ey < 0 || ey >= ROWS) break;
          if (newState.grid[ey][ex] === TileType.WALL) break;

          createExplosion(ex, ey);

          if (newState.grid[ey][ex] === TileType.BLOCK) {
            newState.grid[ey][ex] = TileType.EMPTY;
            // Spawn Powerup logic
            const rand = Math.random();
            let pType: PowerupType | null = null;
            if (rand < 0.15) pType = PowerupType.BOMB;
            else if (rand < 0.30) pType = PowerupType.RANGE;
            else if (rand < 0.40) pType = PowerupType.SPEED;
            else if (rand < 0.42) pType = PowerupType.UNOX;

            if (pType) {
              newState.powerups.push({
                id: Math.random().toString(),
                gx: ex, gy: ey, x: 0, y: 0,
                type: pType
              });
            }
            break; // Stop explosion in this direction
          }
        }
      }
    }
  }

  // 3. Process Explosions (Damage)
  for (let i = newState.explosions.length - 1; i >= 0; i--) {
    const exp = newState.explosions[i];
    exp.timer -= dt;
    if (exp.timer <= 0) {
      newState.explosions.splice(i, 1);
    } else {
      // Check player collision
      Object.values(newState.players).forEach(player => {
        if (player.lives > 0 && player.invincibleTimer <= 0 && player.gx === exp.gx && player.gy === exp.gy) {
          player.lives--;
          player.invincibleTimer = 3;
          
          if (player.lives <= 0) {
            // Determine winner
            const otherPid = Object.keys(newState.players).find(id => id !== player.id);
            if (otherPid) newState.winner = otherPid;
          }
        }
      });
    }
  }

  // Auto hide ad
  if (newState.adVisible && Math.random() < 0.01) newState.adVisible = false;

  return newState;
};

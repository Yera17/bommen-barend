import React, { useEffect, useRef } from 'react';
import { GameState, TileType, PowerupType, Player } from '../types';
import { COLS, ROWS, TILE_SIZE } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  myPlayerId: string;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, myPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        
        // Floor
        ctx.fillStyle = (x + y) % 2 === 0 ? '#4a7c23' : '#3d6b1c';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        const tile = gameState.grid[y][x];
        if (tile === TileType.WALL) {
          // Dijk
          ctx.fillStyle = '#5d4e37';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = '#7a6548';
          ctx.fillRect(px + 4, py + 4, TILE_SIZE - 12, TILE_SIZE - 12);
          ctx.font = `${TILE_SIZE * 0.5}px Arial`;
          ctx.fillText('🧱', px + TILE_SIZE * 0.15, py + TILE_SIZE * 0.7);
        } else if (tile === TileType.BLOCK) {
          // Tulp
          ctx.font = `${TILE_SIZE * 0.7}px Arial`;
          ctx.fillText('🌷', px + TILE_SIZE * 0.1, py + TILE_SIZE * 0.75);
        }
      }
    }

    // Powerups
    gameState.powerups.forEach(p => {
      let emoji = '💣';
      if (p.type === PowerupType.RANGE) emoji = '🔥';
      else if (p.type === PowerupType.SPEED) emoji = '👟';
      else if (p.type === PowerupType.UNOX) emoji = '🌭';
      ctx.font = `${TILE_SIZE * 0.6}px Arial`;
      ctx.fillText(emoji, p.gx * TILE_SIZE + TILE_SIZE * 0.2, p.gy * TILE_SIZE + TILE_SIZE * 0.7);
    });

    // Bombs
    gameState.bombs.forEach(b => {
      const pulse = 1 + Math.sin(Date.now() / 100) * 0.1;
      ctx.font = `${TILE_SIZE * 0.7 * pulse}px Arial`;
      const offset = (1 - pulse) * TILE_SIZE * 0.15;
      ctx.fillText('💣', b.gx * TILE_SIZE + TILE_SIZE * 0.1 + offset, b.gy * TILE_SIZE + TILE_SIZE * 0.75);
    });

    // Explosions
    gameState.explosions.forEach(e => {
       ctx.fillStyle = `rgba(255, 100, 0, ${e.timer * 2})`;
       ctx.beginPath();
       ctx.arc(e.gx * TILE_SIZE + TILE_SIZE / 2, e.gy * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.45, 0, Math.PI * 2);
       ctx.fill();
    });

    // Players
    Object.values(gameState.players).forEach((p: Player) => {
      if (p.lives <= 0) return;
      const isMe = p.id === myPlayerId;
      
      const alpha = p.invincibleTimer > 0 ? (Math.sin(Date.now() / 50) > 0 ? 1 : 0.3) : 1;
      ctx.globalAlpha = alpha;
      
      // Draw indicator ring for self
      if (isMe) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, TILE_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = `${TILE_SIZE * 0.8}px Arial`;
      // Slightly center the emoji
      ctx.fillText(isMe ? '🧑' : '🤖', p.x - TILE_SIZE * 0.4, p.y + TILE_SIZE * 0.3);
      
      // Name label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(isMe ? 'JIJ' : 'TEGENSTANDER', p.x, p.y - 20);
      ctx.textAlign = 'start';

      ctx.globalAlpha = 1;
    });

  }, [gameState, myPlayerId]);

  return (
    <canvas 
      ref={canvasRef}
      width={COLS * TILE_SIZE}
      height={ROWS * TILE_SIZE}
      className="border-4 border-dutch-orange rounded-lg shadow-2xl bg-green-900 max-w-full h-auto"
    />
  );
};

export default GameCanvas;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Colyseus from 'colyseus.js';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { GameState, ChatMessage } from './types';

// Convert Colyseus schema state to plain GameState object
function schemaToGameState(state: any): GameState | null {
  if (!state) return null;
  
  // Convert grid from ArraySchema<GridRow> to number[][]
  const grid: number[][] = [];
  if (state.grid) {
    state.grid.forEach((row: any) => {
      const rowTiles: number[] = [];
      if (row.tiles) {
        row.tiles.forEach((tile: number) => {
          rowTiles.push(tile);
        });
      }
      grid.push(rowTiles);
    });
  }
  
  // Convert players MapSchema to plain object
  const players: GameState['players'] = {};
  if (state.players) {
    state.players.forEach((player: any, id: string) => {
      players[id] = {
        id: player.id,
        gx: player.gx,
        gy: player.gy,
        x: player.x,
        y: player.y,
        targetX: player.targetX,
        targetY: player.targetY,
        moving: player.moving,
        lives: player.lives,
        maxBombs: player.maxBombs,
        activeBombs: player.activeBombs,
        range: player.range,
        speed: player.speed,
        invincibleTimer: player.invincibleTimer,
        color: player.color,
        isBot: false,
        direction: null,
        emoji: player.emoji || '',
        emojiTimer: player.emojiTimer || 0
      };
    });
  }
  
  // Convert bombs
  const bombs: GameState['bombs'] = [];
  if (state.bombs) {
    state.bombs.forEach((bomb: any) => {
      bombs.push({
        id: bomb.id,
        gx: bomb.gx,
        gy: bomb.gy,
        x: 0,
        y: 0,
        ownerId: bomb.ownerId,
        timer: bomb.timer,
        range: bomb.range
      });
    });
  }
  
  // Convert explosions
  const explosions: GameState['explosions'] = [];
  if (state.explosions) {
    state.explosions.forEach((exp: any) => {
      explosions.push({
        id: exp.id,
        gx: exp.gx,
        gy: exp.gy,
        x: exp.gx * 40,
        y: exp.gy * 40,
        timer: exp.timer
      });
    });
  }
  
  // Convert powerups
  const powerups: GameState['powerups'] = [];
  if (state.powerups) {
    state.powerups.forEach((p: any) => {
      powerups.push({
        id: p.id,
        gx: p.gx,
        gy: p.gy,
        x: 0,
        y: 0,
        type: p.type
      });
    });
  }
  
  // Convert chat messages
  const chatMessages: ChatMessage[] = [];
  if (state.chatMessages) {
    state.chatMessages.forEach((msg: any) => {
      chatMessages.push({
        playerId: msg.playerId,
        message: msg.message,
        timestamp: msg.timestamp
      });
    });
  }
  
  return {
    grid,
    players,
    bombs,
    explosions,
    powerups,
    chatMessages,
    winner: state.winner || null,
    adVisible: state.adVisible || false
  };
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<'LOBBY' | 'CONNECTING' | 'WAITING' | 'PLAYING'>('LOBBY');
  const [winner, setWinner] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [rematchVotes, setRematchVotes] = useState(0);
  const [hasVotedRematch, setHasVotedRematch] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  const clientRef = useRef<Colyseus.Client | null>(null);
  const roomRef = useRef<Colyseus.Room | null>(null);
  const inputRef = useRef({ dx: 0, dy: 0, placeBomb: false });
  const inputIntervalRef = useRef<number>();
  const statusRef = useRef<'LOBBY' | 'CONNECTING' | 'WAITING' | 'PLAYING'>('LOBBY');

  // Keep statusRef in sync with status state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initialize Colyseus client
  useEffect(() => {
    // Determine WebSocket URL based on environment
    const wsUrl = import.meta.env.DEV 
      ? `ws://${window.location.hostname}:2567`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    
    clientRef.current = new Colyseus.Client(wsUrl);
    
    return () => {
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  const setupRoom = (room: Colyseus.Room) => {
    roomRef.current = room;
    setMyPlayerId(room.sessionId);
    setRoomId(room.roomId);
    
    // Track state changes
    room.onStateChange((state) => {
      const gs = schemaToGameState(state);
      setGameState(gs);
      
      if (state.players) {
        setPlayerCount(state.players.size);
        
        // Start playing when 2 players and game started
        if (state.players.size >= 2 && state.gameStarted) {
          setStatus('PLAYING');
        }
      }
      
      // Track rematch votes
      setRematchVotes(state.rematchVotes || 0);
      
      // Handle winner state changes
      if (state.winner && state.winner !== '') {
        setWinner(state.winner);
      } else if (!state.winner || state.winner === '') {
        // Game was reset (rematch started)
        setWinner(null);
        setHasVotedRematch(false);
        setChatInput('');
      }
    });
    
    room.onLeave((code) => {
      console.log('Left room:', code);
      if (code !== 1000) {
        alert('Connection lost! Reloading...');
        window.location.reload();
      }
    });
    
    room.onError((code, message) => {
      console.error('Room error:', code, message);
    });
    
    // Start sending input at regular intervals
    inputIntervalRef.current = window.setInterval(() => {
      if (roomRef.current) {
        roomRef.current.send('input', inputRef.current);
        // Reset one-shot inputs
        if (inputRef.current.placeBomb) {
          inputRef.current.placeBomb = false;
        }
      }
    }, 40);
  };

  const createGame = async () => {
    if (!clientRef.current) return;
    
    try {
      setStatus('CONNECTING');
      const room = await clientRef.current.create('bomber');
      setupRoom(room);
      setStatus('WAITING');
    } catch (e) {
      console.error('Failed to create room:', e);
      alert('Failed to create room. Make sure the server is running!');
      setStatus('LOBBY');
    }
  };

  const joinGame = async (targetRoomId: string) => {
    if (!clientRef.current) return;
    
    try {
      setStatus('CONNECTING');
      const room = await clientRef.current.joinById(targetRoomId);
      setupRoom(room);
      // Will transition to PLAYING when state updates
    } catch (e) {
      console.error('Failed to join room:', e);
      alert('Failed to join room. Check the Room ID!');
      setStatus('LOBBY');
    }
  };

  const quickMatch = async () => {
    if (!clientRef.current) return;
    
    try {
      setStatus('CONNECTING');
      const room = await clientRef.current.joinOrCreate('bomber');
      setupRoom(room);
      
      // Check if we need to wait for another player
      if (room.state && room.state.players && room.state.players.size < 2) {
        setStatus('WAITING');
      }
    } catch (e) {
      console.error('Failed to quick match:', e);
      alert('Failed to find or create room. Make sure the server is running!');
      setStatus('LOBBY');
    }
  };

  // --- Input Handling ---
  // Track which keys are held for proper release handling
  const keysHeld = useRef<Set<string>>(new Set());

  const updateInputFromKeys = useCallback(() => {
    // Priority: most recent direction wins, but we use simple priority here
    // Vertical takes priority if both axes have input
    const keys = keysHeld.current;
    
    let dx = 0;
    let dy = 0;
    
    // Check vertical first
    if (keys.has('up')) dy = -1;
    else if (keys.has('down')) dy = 1;
    
    // Only allow horizontal if no vertical
    if (dy === 0) {
      if (keys.has('left')) dx = -1;
      else if (keys.has('right')) dx = 1;
    }
    
    inputRef.current.dx = dx;
    inputRef.current.dy = dy;
  }, []);

  const sendEmoji = useCallback((emoji: string) => {
    if (roomRef.current) {
      roomRef.current.send('emoji', emoji);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (statusRef.current !== 'PLAYING') return;
    
    switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': keysHeld.current.add('up'); break;
      case 'ArrowDown': case 's': case 'S': keysHeld.current.add('down'); break;
      case 'ArrowLeft': case 'a': case 'A': keysHeld.current.add('left'); break;
      case 'ArrowRight': case 'd': case 'D': keysHeld.current.add('right'); break;
      case ' ': inputRef.current.placeBomb = true; return;
      // Emoji keys
      case 'i': case 'I': sendEmoji('😂'); return;
      case 'j': case 'J': sendEmoji('🔥'); return;
      case 'k': case 'K': sendEmoji('🤦'); return;
      case 'l': case 'L': sendEmoji('😢'); return;
      default: return;
    }
    updateInputFromKeys();
  }, [updateInputFromKeys, sendEmoji]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
     if (statusRef.current !== 'PLAYING') return;
     switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': keysHeld.current.delete('up'); break;
      case 'ArrowDown': case 's': case 'S': keysHeld.current.delete('down'); break;
      case 'ArrowLeft': case 'a': case 'A': keysHeld.current.delete('left'); break;
      case 'ArrowRight': case 'd': case 'D': keysHeld.current.delete('right'); break;
      default: return;
    }
    updateInputFromKeys();
  }, [updateInputFromKeys]);

  // Touch Controls
  const handleTouch = (dir: string) => {
    if (statusRef.current !== 'PLAYING') return;
    if (dir === 'up') inputRef.current = { ...inputRef.current, dy: -1, dx: 0 };
    if (dir === 'down') inputRef.current = { ...inputRef.current, dy: 1, dx: 0 };
    if (dir === 'left') inputRef.current = { ...inputRef.current, dx: -1, dy: 0 };
    if (dir === 'right') inputRef.current = { ...inputRef.current, dx: 1, dy: 0 };
    if (dir === 'stop') inputRef.current = { ...inputRef.current, dx: 0, dy: 0 };
    if (dir === 'bomb') inputRef.current.placeBomb = true;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (inputIntervalRef.current) {
        clearInterval(inputIntervalRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp]);

  // --- RENDER ---

  if (status === 'LOBBY') {
    return <Lobby onCreate={createGame} onJoin={joinGame} onQuickMatch={quickMatch} />;
  }

  if (status === 'CONNECTING') {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <h2 className="text-2xl">Connecting to server...</h2>
       </div>
    );
  }

  if (status === 'WAITING') {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
          <div className="animate-bounce text-6xl mb-6">💣</div>
          <h2 className="text-2xl mb-4">Waiting for opponent...</h2>
          <div className="bg-black/30 p-6 rounded-xl text-center">
            <p className="text-gray-400 mb-2">Room ID:</p>
            <p className="text-3xl font-mono text-dutch-orange select-all">{roomId}</p>
            <p className="text-sm text-gray-500 mt-4">Share this ID with a friend to join!</p>
          </div>
          <p className="mt-6 text-gray-500">Players: {playerCount}/2</p>
       </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 overflow-hidden relative">
      {gameState && myPlayerId && (
        <>
          <div className="w-full max-w-[520px] flex justify-between items-center text-white px-4 py-2 bg-gray-800/80 rounded-b-xl mb-2">
            <div className="flex items-center gap-2">
               <span>🧑 Lives:</span>
               <span className="text-red-500 font-bold">
                 {gameState.players[myPlayerId]?.lives || 0}
               </span>
            </div>
            <div className="text-sm text-gray-400">
               Room: {roomId}
            </div>
            <div className="flex items-center gap-2">
               <span>Power:</span>
               <span>💣{gameState.players[myPlayerId]?.maxBombs}</span>
               <span>🔥{gameState.players[myPlayerId]?.range}</span>
               <span>👟{gameState.players[myPlayerId]?.speed}</span>
            </div>
          </div>
          
          <GameCanvas gameState={gameState} myPlayerId={myPlayerId} />

          {/* Touch Controls */}
          <div className="flex flex-col gap-2 mt-4 md:hidden w-full max-w-[400px] px-4 select-none">
             <div className="flex justify-center gap-4">
               <button 
                  onTouchStart={() => handleTouch('up')} 
                  onTouchEnd={() => handleTouch('stop')}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange touch-none"
                >⬆️</button>
             </div>
             <div className="flex justify-center gap-8">
               <button 
                  onTouchStart={() => handleTouch('left')} 
                  onTouchEnd={() => handleTouch('stop')}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange touch-none"
                >⬅️</button>
               <button 
                  onTouchStart={() => handleTouch('down')} 
                  onTouchEnd={() => handleTouch('stop')}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange touch-none"
                >⬇️</button>
               <button 
                  onTouchStart={() => handleTouch('right')} 
                  onTouchEnd={() => handleTouch('stop')}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange touch-none"
                >➡️</button>
             </div>
             <div className="flex justify-center mt-2">
                <button 
                  onTouchStart={() => handleTouch('bomb')} 
                  className="w-full h-16 bg-red-600/80 rounded-xl text-white font-bold text-xl active:bg-red-600 touch-none"
                >
                  💣 BOMB
                </button>
             </div>
          </div>
        </>
      )}

      {/* UNOX AD */}
      {gameState?.adVisible && (
        <div className="fixed bottom-4 right-4 bg-orange-600 text-white px-4 py-2 rounded shadow-lg animate-bounce">
          🌭 Unox - De enige echte
        </div>
      )}

      {/* GAME OVER MODAL */}
      {winner && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl text-center max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-3xl font-bold mb-2 text-gray-800">
              {winner === myPlayerId ? '🎉 GEWONNEN!' : '💀 VERLOREN...'}
            </h2>
            <p className="mb-4 text-gray-600">
              {winner === myPlayerId ? 'Lekker bezig, Barend!' : 'Volgende keer beter!'}
            </p>
            
            {/* Chat Section */}
            <div className="bg-gray-100 rounded-lg p-3 mb-4 flex-1 min-h-[120px] max-h-[200px] overflow-y-auto">
              <div className="text-left space-y-2">
                {gameState?.chatMessages && gameState.chatMessages.length > 0 ? (
                  gameState.chatMessages.map((msg, i) => (
                    <div key={i} className={`text-sm ${msg.playerId === myPlayerId ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block px-3 py-1 rounded-lg ${
                        msg.playerId === myPlayerId 
                          ? 'bg-dutch-orange text-white' 
                          : 'bg-gray-300 text-gray-800'
                      }`}>
                        {msg.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center">No messages yet...</p>
                )}
              </div>
            </div>
            
            {/* Chat Input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim() && roomRef.current) {
                    roomRef.current.send('chat', chatInput.trim());
                    setChatInput('');
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-dutch-orange text-gray-800"
                maxLength={100}
              />
              <button
                onClick={() => {
                  if (chatInput.trim() && roomRef.current) {
                    roomRef.current.send('chat', chatInput.trim());
                    setChatInput('');
                  }
                }}
                className="px-4 py-2 bg-dutch-orange text-white rounded-lg hover:bg-orange-600"
              >
                Send
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Rematch Button */}
              <button 
                onClick={() => {
                  if (roomRef.current && !hasVotedRematch) {
                    roomRef.current.send('rematch');
                    setHasVotedRematch(true);
                  }
                }}
                disabled={hasVotedRematch}
                className={`px-6 py-3 font-bold rounded-lg transition-all ${
                  hasVotedRematch 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {hasVotedRematch 
                  ? `⏳ Waiting for opponent... (${rematchVotes}/2)` 
                  : '🔄 Rematch'}
              </button>
              
              {/* Leave Button */}
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600"
              >
                Leave Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

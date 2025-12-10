import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { GameState, InitPayload, InputPayload, UpdatePayload } from './types';
import { createInitialState, updateGame } from './utils/gameLogic';

const App: React.FC = () => {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<'LOBBY' | 'HOSTING' | 'PLAYING'>('LOBBY');
  const [winner, setWinner] = useState<string | null>(null);
  
  // Refs for mutable state (needed for game loop and non-react connection handling)
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const myInputRef = useRef<InputPayload>({ dx: 0, dy: 0, placeBomb: false });
  const otherInputRef = useRef<InputPayload>({ dx: 0, dy: 0, placeBomb: false });
  const reqRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const isHostRef = useRef<boolean>(false);

  // Initialize PeerJS on mount
  useEffect(() => {
    const peer = new Peer();
    
    peer.on('open', (id) => {
      console.log('My Peer ID is: ' + id);
      setMyPeerId(id);
    });

    peer.on('connection', (conn) => {
      // If we are hosting, accept connection
      if (status === 'LOBBY' || status === 'HOSTING') {
        console.log('Incoming connection...');
        connRef.current = conn;
        setupConnection(conn, true);
      }
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  }, [status]);

  const setupConnection = (conn: DataConnection, amHost: boolean) => {
    isHostRef.current = amHost;
    
    conn.on('open', () => {
      console.log('Connection established!');
      
      if (amHost && peerRef.current?.id) {
        // I am Host: Create initial state and send it to client
        const initialState = createInitialState(peerRef.current.id, conn.peer);
        gameStateRef.current = initialState;
        setGameState(initialState);
        setStatus('PLAYING');

        // Send INIT
        const payload: InitPayload = {
          type: 'INIT',
          playerId: conn.peer,
          gameState: initialState
        };
        conn.send(payload);

        // Start Loop
        startGameLoop();
      }
    });

    conn.on('data', (data: any) => {
      if (amHost) {
        // Host receives INPUT from Client
        // Simple trust model for this demo
        if (data.dx !== undefined) {
           otherInputRef.current = data as InputPayload;
        }
      } else {
        // Client receives INIT or UPDATE
        if (data.type === 'INIT') {
           const payload = data as InitPayload;
           gameStateRef.current = payload.gameState;
           setGameState(payload.gameState);
           setStatus('PLAYING');
           startGameLoop(); // Client also loops to render, though physics is authoritative on host
        } else if (data.type === 'UPDATE') {
           const payload = data as UpdatePayload;
           // Apply authoritative state
           gameStateRef.current = payload.gameState;
           // Optimize: Sync React state less frequently if needed, but for now every frame is okay for low complexity
           setGameState(payload.gameState); 
           if (payload.gameState.winner) setWinner(payload.gameState.winner);
        }
      }
    });

    conn.on('close', () => {
      alert('Connection lost');
      window.location.reload();
    });
  };

  const createGame = () => {
    setStatus('HOSTING'); // Waiting for connection
  };

  const joinGame = (hostId: string) => {
    if (!peerRef.current) return;
    setStatus('HOSTING'); // Temporary loading state
    const conn = peerRef.current.connect(hostId);
    connRef.current = conn;
    setupConnection(conn, false);
  };

  const startGameLoop = () => {
    lastTimeRef.current = performance.now();
    reqRef.current = requestAnimationFrame(loop);
  };

  const loop = (time: number) => {
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // Cap dt
    lastTimeRef.current = time;

    if (isHostRef.current && gameStateRef.current && peerRef.current && connRef.current) {
      // HOST LOGIC: Run Physics
      
      // Combine inputs
      const hostId = peerRef.current.id;
      const clientId = connRef.current.peer;
      
      const inputs = {
        [hostId]: myInputRef.current,
        [clientId]: otherInputRef.current
      };

      const newState = updateGame(gameStateRef.current, dt, inputs);
      gameStateRef.current = newState;
      setGameState(newState); // Trigger render

      if (newState.winner) setWinner(newState.winner);

      // Reset one-shot inputs (bombs)
      if (myInputRef.current.placeBomb) myInputRef.current.placeBomb = false;
      if (otherInputRef.current.placeBomb) otherInputRef.current.placeBomb = false;

      // Send State to Client
      const payload: UpdatePayload = {
        type: 'UPDATE',
        gameState: newState
      };
      connRef.current.send(payload);

    } else if (!isHostRef.current && connRef.current) {
      // CLIENT LOGIC: Send Input
      // We send input every frame or on change. Sending every frame is easiest for now.
      connRef.current.send(myInputRef.current);
      // Reset one-shot
      if (myInputRef.current.placeBomb) myInputRef.current.placeBomb = false;
    }

    reqRef.current = requestAnimationFrame(loop);
  };

  // --- Input Handling ---

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (status !== 'PLAYING') return;
    
    switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': myInputRef.current.dy = -1; break;
      case 'ArrowDown': case 's': case 'S': myInputRef.current.dy = 1; break;
      case 'ArrowLeft': case 'a': case 'A': myInputRef.current.dx = -1; break;
      case 'ArrowRight': case 'd': case 'D': myInputRef.current.dx = 1; break;
      case ' ': myInputRef.current.placeBomb = true; break;
    }
  }, [status]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
     if (status !== 'PLAYING') return;
     switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': if(myInputRef.current.dy < 0) myInputRef.current.dy = 0; break;
      case 'ArrowDown': case 's': case 'S': if(myInputRef.current.dy > 0) myInputRef.current.dy = 0; break;
      case 'ArrowLeft': case 'a': case 'A': if(myInputRef.current.dx < 0) myInputRef.current.dx = 0; break;
      case 'ArrowRight': case 'd': case 'D': if(myInputRef.current.dx > 0) myInputRef.current.dx = 0; break;
    }
  }, [status]);

  // Touch Controls
  const handleTouch = (dir: string) => {
    if (dir === 'up') myInputRef.current = { ...myInputRef.current, dy: -1, dx: 0 };
    if (dir === 'down') myInputRef.current = { ...myInputRef.current, dy: 1, dx: 0 };
    if (dir === 'left') myInputRef.current = { ...myInputRef.current, dx: -1, dy: 0 };
    if (dir === 'right') myInputRef.current = { ...myInputRef.current, dx: 1, dy: 0 };
    if (dir === 'stop') myInputRef.current = { ...myInputRef.current, dx: 0, dy: 0 };
    if (dir === 'bomb') myInputRef.current.placeBomb = true;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // --- RENDER ---

  if (status === 'LOBBY') {
    return <Lobby onCreate={createGame} onJoin={joinGame} isConnecting={!myPeerId} peerId={myPeerId} />;
  }

  if (status === 'HOSTING' && !gameState) {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <h2 className="text-2xl">Waiting for opponent...</h2>
          <p className="mt-4 text-gray-400">Share your ID: <span className="text-dutch-orange font-mono select-all">{myPeerId}</span></p>
       </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 overflow-hidden relative">
      {gameState && myPeerId && (
        <>
          <div className="w-full max-w-[520px] flex justify-between items-center text-white px-4 py-2 bg-gray-800/80 rounded-b-xl mb-2">
            <div className="flex items-center gap-2">
               <span>🧑 Lives:</span>
               <span className="text-red-500 font-bold">
                 {gameState.players[myPeerId]?.lives || 0}
               </span>
            </div>
            <div className="text-sm text-gray-400">
               {isHostRef.current ? '(HOST)' : '(CLIENT)'}
            </div>
            <div className="flex items-center gap-2">
               <span>Power:</span>
               <span>💣{gameState.players[myPeerId]?.maxBombs}</span>
               <span>🔥{gameState.players[myPeerId]?.range}</span>
               <span>👟{gameState.players[myPeerId]?.speed}</span>
            </div>
          </div>
          
          <GameCanvas gameState={gameState} myPlayerId={myPeerId} />

          {/* Touch Controls */}
          <div className="flex flex-col gap-2 mt-4 md:hidden w-full max-w-[400px] px-4">
             <div className="flex justify-center gap-4">
               <button 
                  onTouchStart={(e) => { e.preventDefault(); handleTouch('up'); }} 
                  onTouchEnd={(e) => { e.preventDefault(); handleTouch('stop'); }}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange"
                >⬆️</button>
             </div>
             <div className="flex justify-center gap-8">
               <button 
                  onTouchStart={(e) => { e.preventDefault(); handleTouch('left'); }} 
                  onTouchEnd={(e) => { e.preventDefault(); handleTouch('stop'); }}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange"
                >⬅️</button>
               <button 
                  onTouchStart={(e) => { e.preventDefault(); handleTouch('down'); }} 
                  onTouchEnd={(e) => { e.preventDefault(); handleTouch('stop'); }}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange"
                >⬇️</button>
               <button 
                  onTouchStart={(e) => { e.preventDefault(); handleTouch('right'); }} 
                  onTouchEnd={(e) => { e.preventDefault(); handleTouch('stop'); }}
                  className="w-16 h-16 bg-white/20 rounded-full text-2xl active:bg-dutch-orange"
                >➡️</button>
             </div>
             <div className="flex justify-center mt-2">
                <button 
                  onTouchStart={(e) => { e.preventDefault(); handleTouch('bomb'); }} 
                  className="w-full h-16 bg-red-600/80 rounded-xl text-white font-bold text-xl active:bg-red-600"
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
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl text-center max-w-sm mx-4">
            <h2 className="text-3xl font-bold mb-4 text-gray-800">
              {winner === myPeerId ? '🎉 GEWONNEN!' : '💀 VERLOREN...'}
            </h2>
            <p className="mb-6 text-gray-600">
              {winner === myPeerId ? 'Lekker bezig, Barend!' : 'Volgende keer beter!'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-dutch-orange text-white font-bold rounded-lg hover:bg-orange-600"
            >
              Opnieuw Spelen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

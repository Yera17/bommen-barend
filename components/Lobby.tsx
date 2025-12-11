import React, { useState } from 'react';

interface LobbyProps {
  onCreate: () => void;
  onJoin: (roomId: string) => void;
  onQuickMatch: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onCreate, onJoin, onQuickMatch }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 via-slate-800 to-blue-900">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/20">
        <div className="text-6xl text-center mb-4">💣</div>
        <h1 className="text-4xl font-bold text-center text-dutch-orange mb-2">Bommen Barend</h1>
        <p className="text-center text-gray-300 mb-8">Online Multiplayer</p>

        <div className="space-y-4">
          {/* Quick Match Button */}
          <button
            onClick={onQuickMatch}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all active:scale-95 text-xl shadow-lg"
          >
            ⚡ Quick Match
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-600"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCreate}
              className="py-3 bg-dutch-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all active:scale-95"
            >
              Create Room
            </button>
            
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Room ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-dutch-orange"
              />
              <button
                onClick={() => joinId && onJoin(joinId)}
                disabled={!joinId}
                className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-black/20 rounded-lg">
          <h3 className="text-white font-bold mb-2">🎮 How to Play</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• <kbd className="bg-gray-700 px-1 rounded">WASD</kbd> or <kbd className="bg-gray-700 px-1 rounded">Arrow Keys</kbd> to move</li>
            <li>• <kbd className="bg-gray-700 px-1 rounded">Space</kbd> to place bomb</li>
            <li>• Destroy blocks 🌷 to find power-ups</li>
            <li>• Be the last player standing!</li>
          </ul>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Server-authoritative multiplayer powered by Colyseus
        </p>
      </div>
    </div>
  );
};

export default Lobby;

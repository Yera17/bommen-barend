import React, { useState } from 'react';

interface LobbyProps {
  onCreate: () => void;
  onJoin: (hostId: string) => void;
  isConnecting: boolean;
  peerId: string | null;
}

const Lobby: React.FC<LobbyProps> = ({ onCreate, onJoin, isConnecting, peerId }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/20">
        <h1 className="text-4xl font-bold text-center text-dutch-orange mb-2">Bommen Barend</h1>
        <p className="text-center text-gray-300 mb-8">Online Multiplayer</p>

        {!peerId ? (
          <div className="text-center text-white animate-pulse">Initializing Network...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-black/30 p-4 rounded-lg">
              <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-1">Your ID</h2>
              <div className="font-mono text-xl text-green-400 select-all">{peerId}</div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={onCreate}
                disabled={isConnecting}
                className="w-full py-4 bg-dutch-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {isConnecting ? 'Starting Server...' : 'Create New Game'}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-400">OR</span>
                <div className="flex-grow border-t border-gray-600"></div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Paste Friend's ID here"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-dutch-orange"
                />
                <button
                  onClick={() => onJoin(joinId)}
                  disabled={!joinId || isConnecting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Join Game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Wifi, WifiOff, Clock, Radio, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface NetworkStatusBarProps {
  className?: string;
  showSeconds?: boolean;
}

export function NetworkStatusBar({ className, showSeconds = false }: NetworkStatusBarProps) {
  const { connectionStatus, setConnectionStatus } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showSeconds]);

  const isOnlineWithWifi = connectionStatus.internet;

  const toggleConnection = () => {
    setConnectionStatus(prev => ({
      ...prev,
      internet: !prev.internet
    }));
  };

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between px-4 py-1.5 bg-zinc-900 text-white text-[11px] font-medium border-b border-zinc-800 select-none transition-colors",
        !isOnlineWithWifi && "bg-amber-950/80 border-amber-800/60",
        className
      )}
    >
      {/* Horário Atual */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-zinc-400" />
        <span className="font-mono font-semibold tracking-wider text-zinc-200">
          {currentTime || '--:--'}
        </span>
      </div>

      {/* Indicador de Status: Online com Wi-Fi ou Offline */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleConnection}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] transition active:scale-95",
            isOnlineWithWifi
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
              : "bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:bg-amber-500/35 animate-pulse"
          )}
          title="Clique para alternar entre Online com Wi-Fi e Offline"
        >
          {isOnlineWithWifi ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span>Online com Wi-Fi</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-amber-400" />
              <span>Offline (Rede Mesh)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

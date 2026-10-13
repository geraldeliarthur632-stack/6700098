import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, CircleDashed, Settings as SettingsIcon, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { NetworkStatusBar } from './NetworkStatusBar';

export function Layout() {
  const location = useLocation();
  const isChatRoom = location.pathname.startsWith('/chat/');

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-900">
      {/* Top Network & Clock Status Bar */}
      <NetworkStatusBar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation (Hidden in ChatRoom for mobile) */}
      {!isChatRoom && (
        <nav className="border-t border-zinc-200 bg-white px-6 py-3 pb-safe">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                )
              }
            >
              <MessageSquare className="h-6 w-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Chats</span>
            </NavLink>

            <NavLink
              to="/contacts"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                )
              }
            >
              <Users className="h-6 w-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Contacts</span>
            </NavLink>

            <NavLink
              to="/status"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                )
              }
            >
              <CircleDashed className="h-6 w-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Status</span>
            </NavLink>

            <NavLink
              to="/connections"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 transition-colors relative",
                  isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                )
              }
              title="Wi-Fi Direct, Bluetooth & Mesh"
            >
              <div className="relative">
                <Radio className="h-6 w-6" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider">Conexões</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                )
              }
            >
              <SettingsIcon className="h-6 w-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Ajustes</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

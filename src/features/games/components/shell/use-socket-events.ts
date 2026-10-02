'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSocket, emit } from '../socket';
import { getState, setState } from '../store';
import type { GameInfo, GameListItem, GeneralChats, TouChange, UserGameSettings, UserListItem, VersionInfo, WarningPopup } from '../wire';

const addAlert = (message: string) => setState((state) => ({ alerts: [...state.alerts, message] }));

/**
 * Connects the socket and copies what the server sends into the store
 * (legacy `App.componentDidMount`). Runs once per page.
 */
export function useSocketEvents(): void {
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();
    let lastReconnectAttempt = Date.now();
    let connectedBefore = false;

    const handlers: Record<string, (...args: never[]) => void> = {
      connect: () => {
        setState({ connected: true });
        if (getState().userInfo.userName) emit('getUserGameSettings');
        emit('requestUserList');
        // After a dropped connection, go back to the table we were looking at.
        const { hash } = window.location;
        if (connectedBefore && hash.startsWith('#/table/')) emit('getGameInfo', hash.slice('#/table/'.length));
        connectedBefore = true;
      },
      disconnect: () => setState({ connected: false }),

      touChange: (changes: TouChange[]) => setState({ popup: { type: 'tou', changes } }),
      warningPopup: (warning: WarningPopup) => {
        if (!getState().popup) setState({ popup: { type: 'warning', warning } });
      },
      removeAllPopups: () => setState({ popup: null }),
      checkRestrictions: () => emit('receiveRestrictions'),

      emoteList: (allEmotes: Record<string, string>) => setState({ allEmotes }),
      sendAlert: (message: string) => addAlert(String(message)),
      feedbackResponse: (response: { message: string }) => addAlert(response.message),

      // The server closed this connection: another tab took over, or the account changed.
      manualDisconnection: () => {
        router.push('/');
        router.refresh();
      },
      manualReload: () => window.location.reload(),
      // No live table at that link (finished and cleared away, or wrong): back to the lobby.
      manualReplayRequest: () => {
        window.location.hash = '#/';
      },

      gameSettings: (settings: UserGameSettings) => setState((state) => ({ userInfo: { ...state.userInfo, gameSettings: settings } })),
      gameList: (gameList: GameListItem[]) => setState({ gameList }),
      version: (version: VersionInfo) => setState((state) => ({ version: { ...state.version, ...version } })),

      joinGameRedirect: (uid: string) => {
        setState({ midSection: 'game' });
        window.location.hash = `#/table/${uid}`;
      },
      gameUpdate: (payload: unknown, noChats?: boolean) => {
        // An empty update means «there is no table for you here».
        if (!payload || typeof payload !== 'object' || !('general' in payload)) {
          setState({ gameInfo: null });
          return;
        }
        const game = payload as GameInfo;
        const previous = getState().gameInfo;
        setState({ gameInfo: noChats && previous ? { ...game, chats: previous.chats } : game });
      },
      playerChatUpdate: (chat: GameInfo['chats'][number]) => {
        const game = getState().gameInfo;
        if (game) setState({ gameInfo: { ...game, chats: [...game.chats, chat] } });
      },

      userList: (payload: { list: UserListItem[] }) => {
        setState({ userList: payload.list });
        // The server lost track of us (a restart, a dropped list entry): introduce ourselves again.
        const now = Date.now();
        const { userName } = getState().userInfo;
        if (userName && now - lastReconnectAttempt > 5000) {
          lastReconnectAttempt = now;
          if (!payload.list.some((user) => user.userName === userName)) emit('getUserGameSettings');
        }
      },
      updateSeatForUser: () => setState((state) => ({ userInfo: { ...state.userInfo, isSeated: true } })),
      generalChats: (generalChats: GeneralChats) => setState({ generalChats }),
      reportUpdate: (newReport: boolean) =>
        setState((state) => ({
          userInfo: { ...state.userInfo, gameSettings: { ...state.userInfo.gameSettings, newReport } },
        })),
      // A table opened that the player asked to hear about (settings → «خبرم کن»).
      newGameAdded: (game: { creator?: string }) => {
        const { userInfo } = getState();
        if (!userInfo.gameSettings?.notifyForNewLobby || game?.creator === userInfo.userName) return;
        if ('Notification' in window && Notification.permission === 'granted') new Notification('یک میز تازه در لابی باز شد.');
      },
      gameJoinStatusUpdate: (update: { status?: string }) => {
        if (update?.status === 'blacklisted') addAlert('سازنده‌ی این بازی شما را در فهرست سیاه خود گذاشته است.');
      },
      toLobby: (uid: string) => {
        if (window.location.hash === `#/table/${uid}`) {
          window.location.hash = '#/';
          addAlert('بازی‌ای که در آن بودید به‌طور خودکار حذف شد.');
        }
      },
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler as (...args: unknown[]) => void);
    socket.connect();

    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler as (...args: unknown[]) => void);
      socket.disconnect();
    };
  }, [router]);
}

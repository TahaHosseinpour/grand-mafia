'use client';

import { useEffect } from 'react';
import { emit } from '../socket';
import { getState, setState } from '../store';

/**
 * The game client's screens are hash routes, as before: `#/` (lobby),
 * `#/table/<uid>`, `#/profile/<name>`, `#/settings`, `#/creategame`,
 * `#/leaderboards`, `#/changelog` (legacy `App.router`).
 *
 * A seated player of a running game is kept at their table: any other hash
 * sends them back to it, and `#/` leaves the game.
 */

/** Leaves the table we are at, or the one `uid` names. */
export function leaveGame(uid?: string): void {
  const { userInfo, gameInfo } = getState();
  if (userInfo.isSeated) setState({ userInfo: { ...userInfo, isSeated: false } });
  const target = uid ?? gameInfo?.general.uid;
  if (target) emit('leaveGame', { uid: target });
}

export function useHashRouter(): void {
  useEffect(() => {
    let previous = '';

    const route = () => {
      const { hash } = window.location;
      if (hash === previous) return;
      const { userInfo, gameInfo } = getState();
      const signedIn = Boolean(userInfo.userName);

      const seatedHere =
        gameInfo &&
        signedIn &&
        userInfo.isSeated &&
        gameInfo.publicPlayersState.some((player) => player.userName === userInfo.userName);

      if (seatedHere) {
        const tableHash = `#/table/${gameInfo.general.uid}`;
        if (hash === '#/') {
          leaveGame();
        } else if (!gameInfo.gameState.isCompleted) {
          if (previous !== tableHash) {
            // Rejoin a game that is still running instead of wandering off.
            emit('getGameInfo', gameInfo.general.uid);
          } else {
            setState({ midSection: 'game' });
            window.location.hash = tableHash;
          }
          previous = tableHash;
          return;
        }
      } else if (previous.startsWith('#/table/')) {
        leaveGame(previous.slice('#/table/'.length));
      }

      if (hash.startsWith('#/profile/')) {
        setState({ midSection: 'profile', profileName: decodeURIComponent(hash.slice('#/profile/'.length)) });
      } else if (hash === '#/changelog') {
        setState({ midSection: 'changelog' });
      } else if (hash === '#/settings' && signedIn) {
        setState({ midSection: 'settings' });
      } else if (hash === '#/creategame' && signedIn) {
        setState({ midSection: 'createGame' });
      } else if (hash.startsWith('#/table/')) {
        emit('getGameInfo', hash.slice('#/table/'.length));
      } else if (hash === '#/leaderboards') {
        setState({ midSection: 'leaderboards' });
      } else if (hash !== '#/') {
        window.location.hash = '#/';
      } else {
        if (signedIn) emit('updateUserStatus', 'none');
        setState({ midSection: 'default' });
      }

      previous = hash;
    };

    window.addEventListener('hashchange', route);
    route();
    return () => window.removeEventListener('hashchange', route);
  }, []);
}

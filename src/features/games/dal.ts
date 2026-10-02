import 'server-only';
import { engineStore } from './engine/store';

/** Players connected right now (legacy GET /online-playercount). Public. */
export function countOnlinePlayers(): number {
  return engineStore().userList.length;
}

/** An active IP ban. `until` is an ISO string; null for permanent bans. */
export type IpBanStatus = {
  type: string;
  until: string | null;
  permanent: boolean;
};

type AssertSerializable<T extends import('@/server/types').Serializable> = T;
export type _PlainDataChecks = [AssertSerializable<IpBanStatus>];

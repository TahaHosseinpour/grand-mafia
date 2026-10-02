/**
 * IP address helpers, ported from legacy/routes/socket/ip-obf*.js.
 *
 * Moderators never see raw addresses in the UI; they see an obfuscated form
 * that is stable for the life of the process (a per-process random bijection
 * per block), so two accounts on one address still look alike. Pure and
 * isomorphic; the mapping tables are created once per process.
 */

const isByte999 = (value: string) => {
  const num = Number.parseInt(value, 10);
  return !Number.isNaN(num) && num >= 0 && num <= 999;
};

const isValidBlockCount = (ip: string) => {
  const data = ip.split('.');
  return data.every(isByte999) && [2, 3, 4].includes(data.length);
};

const isIPv4 = (ip: string) => {
  const data = ip.split('.');
  return data.length === 4 && data.every(isByte999);
};

/** IPv6 fully expanded (8 × 4 hex digits); IPv4-in-IPv6 unwrapped; IPv4 unchanged. */
export function expandAndSimplify(ip: string): string {
  if (ip.includes(':')) {
    if (ip.startsWith('::ffff:')) {
      const shortened = ip.substring(7);
      if (isIPv4(shortened)) return shortened;
    }
    const data = ip.split(':');
    const output = ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000'];
    const missing = 8 - data.length;
    let hitExpander = false;
    for (let a = 0; a < data.length; a++) {
      if (data[a] === '') hitExpander = true;
      else if (hitExpander) output[a + missing] = data[a].padStart(4, '0');
      else output[a] = data[a].padStart(4, '0');
    }
    return output.join(':');
  }
  return ip;
}

const ipToBinary = (ip: string) =>
  ip.includes(':')
    ? ip
        .split(':')
        .map((block) => Number.parseInt(block, 16).toString(2).padStart(16, '0'))
        .join('')
    : ip
        .split('.')
        .map((block) => Number.parseInt(block, 10).toString(2).padStart(8, '0'))
        .join('');

const validateCIDR = (cidr: string) => {
  const sections = cidr.split('/');
  if (sections.length !== 2) return false;
  return Number(sections[1]) <= (sections[0].includes(':') ? 128 : 32);
};

export function doesIPMatchCIDR(cidr: string, ip: string): boolean {
  if (!validateCIDR(cidr)) return false;
  const [base, subnetText] = cidr.split('/');
  const subnet = Number(subnetText);
  return ipToBinary(base).substring(0, subnet) === ipToBinary(ip).substring(0, subnet);
}

/** An IPv6 address without a range is banned as its /64. */
export function withDefaultIPv6Range(ip: string): string {
  return !ip.includes(':') || ip.includes('/') ? ip : `${ip}/64`;
}

// ---- Obfuscation -----------------------------------------------------------

function createV4Block(): number[] {
  const block: number[] = [];
  const available: number[] = [];
  for (let a = 256; a <= 999; a++) available[a - 256] = a;
  for (let a = 0; a <= 255; a++) {
    const index = Math.floor(Math.random() * available.length);
    block[a] = available[index];
    block[block[a]] = a;
    available.splice(index, 1);
  }
  return block;
}

const v4Blocks = [createV4Block(), createV4Block(), createV4Block(), createV4Block()];

function createV6Map(): Map<string, string> {
  const map = new Map<string, string>();
  const available: string[] = [];
  for (let a = 0; a < 16 ** 4; a++) available[a] = a.toString(16).padStart(4, '0');
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  for (let i = 0; i < available.length; i += 2) {
    map.set(available[i], available[i + 1]);
    map.set(available[i + 1], available[i]);
  }
  return map;
}

let v6Map: Map<string, string> | null = null;

function obfuscateV4(ip: string): string {
  const [address, range] = ip.split('/');
  const out = address
    .split('.')
    .map(Number)
    .map((number, blockId) => {
      const mapped = v4Blocks[blockId]?.[number];
      if (mapped === undefined) throw new Error(`Invalid IP block: ${blockId} ${number}`);
      return mapped;
    })
    .join('.');
  return range === undefined ? out : `${out}/${range}`;
}

function obfuscateV6(ip: string): string {
  v6Map ??= createV6Map();
  const map = v6Map;
  const [address, range] = ip.split('/');
  const out = address
    .split(':')
    .slice(0, 8)
    .map((block) => {
      const mapped = map.get(block);
      if (mapped === undefined) throw new Error(`Invalid IP block: ${block}`);
      return mapped;
    })
    .join(':');
  return range === undefined ? out : `${out}/${range}`;
}

const obfCache = new Map<string, string>();

export function obfIP(ip: string): string {
  const cached = obfCache.get(ip);
  if (cached) return cached;
  const expanded = expandAndSimplify(ip);
  const result = isValidBlockCount(expanded) ? obfuscateV4(expanded) : obfuscateV6(expanded);
  obfCache.set(ip, result);
  return result;
}

/**
 * The Persian game terms. Every user-facing string that names a game
 * concept uses these, so one concept never has two names on screen.
 * (Direct translation of the original terms — decision in docs/migration.md.)
 */
export const T = {
  game: 'هیتلر مخفی',
  liberal: 'لیبرال',
  liberals: 'لیبرال‌ها',
  fascist: 'فاشیست',
  fascists: 'فاشیست‌ها',
  hitler: 'هیتلر',
  president: 'رئیس‌جمهور',
  chancellor: 'صدراعظم',
  presidentialCandidate: 'نامزد ریاست‌جمهوری',
  chancellorCandidate: 'نامزد صدارت',
  policy: 'قانون',
  policies: 'قوانین',
  liberalPolicy: 'قانون لیبرال',
  fascistPolicy: 'قانون فاشیستی',
  deck: 'دسته‌ی قوانین',
  discardPile: 'دسته‌ی دورریخته',
  electionTracker: 'شمارنده‌ی انتخابات',
  veto: 'وتو',
  ja: 'آری',
  nein: 'نه',
  investigateLoyalty: 'بررسی وفاداری',
  specialElection: 'انتخابات ویژه',
  policyPeek: 'نگاه به قوانین',
  execution: 'اعدام',
  partyMembership: 'عضویت حزبی',
  secretRole: 'نقش مخفی',
  termLimited: 'محدودیت دوره',
  legislativeSession: 'جلسه‌ی قانون‌گذاری',
  executiveAction: 'اقدام اجرایی',
  presidentialPower: 'قدرت ریاست‌جمهوری',
  rebalanced: 'متعادل‌شده',
  liberalTrack: 'جدول لیبرال',
  fascistTrack: 'جدول فاشیستی',
  merlin: 'مرلین',
  percival: 'پرسیوال',
  morgana: 'مورگانا',
  monarchist: 'سلطنت‌طلب',
  lobby: 'لابی بازی',
  observer: 'تماشاگر',
  rainbow: 'رنگین‌کمانی',
  xp: 'امتیاز تجربه',
} as const;

/** «لیبرال» / «فاشیستی» as an adjective for a policy or a card. */
export const policyAdjective = (policy: 'liberal' | 'fascist'): string => (policy === 'liberal' ? 'لیبرال' : 'فاشیستی');

/** The team's name as a noun, e.g. for «تیم لیبرال». */
export const teamName = (team: 'liberal' | 'fascist'): string => (team === 'liberal' ? T.liberal : T.fascist);

/** The Persian name of a role card. */
export const roleLabel = (role: 'liberal' | 'fascist' | 'hitler' | 'merlin' | 'percival' | 'morgana' | 'monarchist'): string =>
  ({
    liberal: T.liberal,
    fascist: T.fascist,
    hitler: T.hitler,
    merlin: T.merlin,
    percival: T.percival,
    morgana: T.morgana,
    monarchist: T.monarchist,
  })[role];

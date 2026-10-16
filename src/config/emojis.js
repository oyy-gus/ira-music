/**
 * Internal Bot Application Emoji Registry & Resolver.
 * Uses exact IDs for bot application emojis owned by the application.
 */

const APPLICATION_EMOJIS = {
  staff: '1555459168805195826',
  command: '1555444326174163034',
  moderator: '1555459166708170892',
  server: '1555450042129711194',
  youtube: '1555233052702154782',
  robot: '1555458928396210256',
  admin: '1555458698787168266',
  developer: '1555458344377126942',
  autoplay: '1555458025244983392',
  spotify: '1555232800851099748',
  reconnect: '1555232741459759279',
  tools: '1555452755017994280',
  link: '1555447787510956142',
  mic: '1555457645861666827',
  utility: '1555445979929640991',
  soundcloud: '1555232550065021050',
  enable: '1555232509653155840',
  disconnect: '1555232451746463944',
  connected: '1555232342669525123',
  playlist: '1555230934649806888',
  disc: '1555230901107957791',
  lyrics: '1555230862667284613',
  heart: '1555230801996677130',
  music_note: '1555230741024080063',
  music: '1555230741024080063',
  queue: '1555476739713409065',
  mute: '1555230658962399294',
  volume_up: '1555230620542701628',
  volume_down: '1555230580403081316',
  repeat_one: '1555230510098288650',
  repeat: '1555230471699435570',
  shuffle: '1555230433472544798',
  rewind: '1555230389059195031',
  first: '1555230389059195031',
  forward: '1555230341654904923',
  last: '1555230341654904923',
  previous: '1555230304719863828',
  prev: '1555230304719863828',
  next: '1555230257328431214',
  stop: '1555230219588079676',
  pause: '1555230179469557933',
  play: '1555230141221969952',
  settings: '1555451510719123528',
  loading: '1555454763024257064',
  question: '1555456870372876368',
  shield: '1555228847170129940',
  bug: '1555455585976324146',
  unlock: '1555456240174239774',
  lock: '1555456238198722590',
  clock: '1555455183142527087',
  time: '1555455183142527087',
  user: '1555457272409358420',
  search: '1555454155181789274',
  forbidden: '1555228503774072913',
  info: '1555228281291153522',
  trash: '1555228015401898045',
  error: '1555227930869633204',
  success: '1555227884904255661',
  crown: '1555227778624786523',
  warning: '1555227629236256908',
  bell: '1555227451829915698',
  folder: '1555227097536921670',
  type: '1555482585336127488',
  out: '1555226983498252368',
  output: '1555482400606265458',
  join: '1555226837452333186',
  input: '1555482236399386624',
  support: '1555452330307096657',
  invite: '1555446608706150400',
  global: '1555449686309998602',
  uptime: '1555450456761704458',
  memory: '1555450757346758706',
  database: '1555450970585047070',
  ping: '1555276158327726120',
  lavalink: '1555448579932553297',
  cluster: '1555448926449045584',
  recovery: '1555449250924728350',
  required_permission: '1555447170029854730',
  always_on: '1555460891435212900',
  clear: '1555374297688576082',
  equalizer: '1555464230365302864',
  jump: '1555460232040153108',
  move_track: '1555464533105971240',
  now_playing: '1555460506448564336',
  playlist_save: '1555464854759022683',
  playlist_delete: '1555382319878250638',
  profile: '1555465193390084106',
  live_stream: '1555276027574358098',
  analyzing: '1555465466032553995',
  artist: '1555465678104961066',
  duration: '1555466092258795622',
  smart_recommendation: '1555465865447743498',
  track_replay: '1555466288632037507',
  resume: '1555230141221969952',
  seeked: '1555466474225803287',
  skip: '1555394090739441674',
  playback_volume: '1555467541621768203',
  volume_updated: '1555467765387886752',
  move: '1555459728778465391',
  filter: '1555461068489367572',
  prefix: '1555461490985668638',
  evalcode: '1555483535018565672',
  maintenance: '1556715202785976361',
  lockdown: '1556714426403389510',
  rate_limit: '1556706225352351784',
  twenty_four_seven: '1556715752206373066',
  activity: '1556716110106337374',
  test: '1556719036681822298',

  // Cosmetics & Profile
  cosmetics: '1556718896848044044',
  overview: '1556713224299085845',
  frame: '1556711702639419412',
  background: '1556718355078053918',
  glow: '1556713395821092935',
  decoration: '1556714558658314310',
  avatar_effect: '1556712811755872256',
  avatarfx: '1556714855007002764',
  name_effect: '1556719476051804230',
  namefx: '1556713975134167131',
  level_emblem: '1556718633839894548',
  emblem: '1556712145868165142',
  visualizer: '1556706625002283072',
  title: '1556711278129713355',
  headphones: '1556719973911625818',
  listening: '1556715878861774918',
  badges: '1556717059365404695',
  star: '1556712592280518686',
  level: '1556717466347110560',

  // Music Analytics & Canvas Emojis
  music_stats: '1556717356414271568',
  analytics: '1556714726841524284',
  timer: '1556713531381125170',
  stopwatch: '1556716833040765081',
  home: '1556719261987115049',
  top_tracks: '1556718190485053490',
  songs: '1556708056002207855',
  companions: '1556713047467491468',
  people: '1556715019650207794',
  friends: '1556715990342049822',
  gold_medal: '1556719650690048162',
  silver_medal: '1556716590580367361',
  bronze_medal: '1556717658169409558',
  target: '1556716482333773975',

  // Leaderboard & Ranking
  leaderboard: '1556713765670756396',
  xp: '1556714176649625601',
  level_up: '1556711469553291377',
  tada: '1556716352797016236',
  party: '1556717203922100344',
  trophy: '1556717555480141870',
  globe: '1556718767856296048',
  season: '1556708879545663599',
  global_users: '1556719889748729857',
  global_servers: '1556717949761495171',
  server_users: '1556718096713121943',
  season_users: '1556710757746479136',
  medal_1: '1556718529124769863',
  medal_2: '1556712434310447175',
  medal_3: '1556719155183620160',

  // Achievements
  achievement: '1556719762573361162',
  achievements: '1556715338559651946',
  achievement_first_melody: '1556709940901453996',
  achievement_tracks_100: '1556716212350885898',
  achievement_tracks_1000: '1556709458585854089',
  achievement_streak_7: '1556711982491771060',
  achievement_streak_30: '1556715618923708477',
};

/**
 * Asynchronously fetch application emojis owned by the bot application.
 * @param {import('discord.js').Client} client
 */
async function fetchEmojis(client) {
  if (!client) return;

  try {
    if (client.application?.emojis) {
      await client.application.emojis.fetch();
    }
  } catch (err) {
    // Ignore fetch error
  }
}

/**
 * Retrieve an emoji string for embeds/text directly from bot application emojis.
 * Supports fallback unicode emoji if custom bot application emoji is not configured.
 * @param {string} key Name of the emoji
 * @param {string|import('discord.js').Client} [fallback=''] Optional fallback unicode emoji or Discord client
 * @param {import('discord.js').Client} [client=null] Optional Discord client
 * @returns {string} Formatted bot application emoji string (<:name:id>), fallback, or empty string
 */
function getEmoji(key, fallback = '', client = null) {
  let actualFallback = fallback;
  let actualClient = client;

  if (typeof fallback === 'object' && fallback !== null) {
    actualClient = fallback;
    actualFallback = '';
  }

  const normalizedKey = key ? key.toLowerCase() : '';

  if (actualClient?.application?.emojis?.cache) {
    const appEmoji = actualClient.application.emojis.cache.find(
      (e) => e.name.toLowerCase() === normalizedKey || (APPLICATION_EMOJIS[normalizedKey] && e.id === APPLICATION_EMOJIS[normalizedKey])
    );
    if (appEmoji) return appEmoji.toString();
  }

  const emojiId = APPLICATION_EMOJIS[normalizedKey];
  if (emojiId && emojiId.trim() !== '') {
    return `<:${normalizedKey}:${emojiId}>`;
  }

  if (actualFallback && typeof actualFallback === 'string') {
    return actualFallback;
  }

  return '';
}

/**
 * Retrieve an emoji object for Discord UI components (Buttons / Select Menu options).
 * @param {string} key Name of the emoji
 * @param {string|import('discord.js').Client} [fallback=''] Optional fallback unicode emoji or Discord client
 * @param {import('discord.js').Client} [client=null] Optional Discord client
 * @returns {Object|undefined} Object `{ id: '...' }` or `{ name: '...' }` or `undefined`
 */
function getEmojiComponent(key, fallback = '', client = null) {
  let actualFallback = fallback;
  let actualClient = client;

  if (typeof fallback === 'object' && fallback !== null) {
    actualClient = fallback;
    actualFallback = '';
  }

  const normalizedKey = key ? key.toLowerCase() : '';

  if (actualClient?.application?.emojis?.cache) {
    const appEmoji = actualClient.application.emojis.cache.find(
      (e) => e.name.toLowerCase() === normalizedKey || (APPLICATION_EMOJIS[normalizedKey] && e.id === APPLICATION_EMOJIS[normalizedKey])
    );
    if (appEmoji) {
      return { id: appEmoji.id, name: appEmoji.name, animated: appEmoji.animated || false };
    }
  }

  const emojiId = APPLICATION_EMOJIS[normalizedKey];
  if (emojiId && emojiId.trim() !== '') {
    return { id: emojiId, name: normalizedKey };
  }

  if (actualFallback && typeof actualFallback === 'string') {
    return { name: actualFallback };
  }

  return undefined;
}

module.exports = {
  APPLICATION_EMOJIS,
  fetchEmojis,
  getEmoji,
  getEmojiComponent,
};

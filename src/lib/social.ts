import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import cacheJson from '../data/social-cache.json';

const UID = '3546622048864404';
const STEAM_ID = '76561199888306296';
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
const PROXY = process.env.https_proxy || process.env.HTTPS_PROXY || '';
const CACHE_PATH = path.resolve('src/data/social-cache.json');
const PUBLIC_DIR = path.resolve('public/social');

export interface BangumiItem {
  title: string;
  cover: string;
  coverLocal: string;
  type: string;
}

export interface GameItem {
  name: string;
  hours: number;
  lastPlayed: string;
}

export interface FavItem {
  title: string;
  cover: string;
  coverLocal: string;
}

export interface FavFolder {
  title: string;
  count: number;
  items: FavItem[];
}

export interface BiliInfo {
  name: string;
  avatar: string;
  avatarLocal: string;
  sign: string;
  fans: number;
  following: number;
  videos: number;
  likes: number;
  level: number;
  sex: string;
  vipLabel: string;
  bangumi: BangumiItem[];
  bangumiTotal: number;
  bangumiPublic: boolean;
  favFolders: FavFolder[];
}

export interface SteamInfo {
  name: string;
  avatar: string;
  avatarLocal: string;
  state: string;
  stateText: string;
  privacy: string;
  memberSince: string;
  location: string;
  hours2wk: string;
  vacBanned: number;
  games: GameItem[];
  gamesTotal: number;
  hoursTotal: number;
  gamesPublic: boolean;
}

export interface SocialData {
  bilibili: BiliInfo;
  steam: SteamInfo;
  updatedAt: string;
}

interface Res {
  status: number;
  body: Buffer;
}

function viaProxy(url: string, headers: Record<string, string>): Promise<Res> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const p = new URL(PROXY);
    const req = http.request({
      host: p.hostname,
      port: Number(p.port) || 80,
      method: 'CONNECT',
      path: `${u.hostname}:443`,
      timeout: 20000,
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        reject(new Error('proxy connect ' + res.statusCode));
        return;
      }
      const r = https.request(
        { host: u.hostname, path: u.pathname + u.search, method: 'GET', socket, agent: false, headers },
        (resp) => {
          const chunks: Buffer[] = [];
          resp.on('data', (c: Buffer) => chunks.push(c));
          resp.on('end', () => resolve({ status: resp.statusCode || 0, body: Buffer.concat(chunks) }));
        }
      );
      r.on('error', reject);
      r.setTimeout(20000, () => r.destroy(new Error('proxy timeout')));
      r.end();
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('proxy timeout')));
    req.end();
  });
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Res> {
  const h = { 'User-Agent': UA, Accept: '*/*', ...headers };
  if (PROXY) return viaProxy(url, h);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: h, signal: ctrl.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, body: buf };
  } finally {
    clearTimeout(timer);
  }
}

async function saveImage(url: string, name: string): Promise<string> {
  if (!url) return '';
  const clean = url.replace(/^http:\/\//, 'https://');
  const ext = clean.includes('.png') ? 'png' : 'jpg';
  const local = `/social/${name}.${ext}`;
  // 仓库已有本地图 → 直接使用, 不依赖网络
  if (fs.existsSync(path.join(PUBLIC_DIR, `${name}.${ext}`))) return local;
  try {
    const r = await get(clean);
    if (r.status === 200 && r.body.length > 200) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      fs.writeFileSync(path.join(PUBLIC_DIR, `${name}.${ext}`), r.body);
      return local;
    }
  } catch {
    /* ignore */
  }
  return '';
}

async function fetchBangumi(): Promise<{ items: BangumiItem[]; total: number; isPublic: boolean }> {
  try {
    const raw = JSON.parse(
      (await get(`https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&vmid=${UID}&pn=1&ps=12`)).body.toString('utf8')
    );
    if (raw?.code !== 0 || !raw?.data?.list) return { items: [], total: 0, isPublic: false };
    const items: BangumiItem[] = [];
    let i = 0;
    for (const b of raw.data.list) {
      items.push({
        title: b.title || '',
        cover: (b.cover || '').replace(/^http:\/\//, 'https://'),
        coverLocal: await saveImage(b.cover, `bangumi-${i++}`),
        type: b.season_type_name || '',
      });
    }
    return { items, total: raw.data.total ?? items.length, isPublic: true };
  } catch {
    return { items: [], total: 0, isPublic: false };
  }
}

async function fetchFavs(): Promise<FavFolder[]> {
  try {
    const raw = JSON.parse(
      (await get(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${UID}`)).body.toString('utf8')
    );
    const folders = raw?.data?.list;
    if (!Array.isArray(folders) || folders.length === 0) return [];
    const out: FavFolder[] = [];
    for (const f of folders.slice(0, 3)) {
      const folder: FavFolder = { title: f.title || '', count: f.media_count ?? 0, items: [] };
      try {
        const res = JSON.parse(
          (await get(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${f.id}&pn=1&ps=6&platform=web`)).body.toString('utf8')
        );
        const medias = res?.data?.medias;
        if (Array.isArray(medias)) {
          let i = 0;
          for (const m of medias) {
            folder.items.push({
              title: m.title || '',
              cover: (m.cover || '').replace(/^http:\/\//, 'https://'),
              coverLocal: await saveImage(m.cover, `fav-${out.length}-${i++}`),
            });
          }
        }
      } catch {
        /* 单个收藏夹失败不影响其他 */
      }
      out.push(folder);
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchBilibili(): Promise<BiliInfo> {
  const spi = JSON.parse((await get('https://api.bilibili.com/x/frontend/finger/spi')).body.toString('utf8'));
  const buvid = spi?.data?.b_3 || '';
  const raw = JSON.parse(
    (await get(`https://api.bilibili.com/x/web-interface/card?mid=${UID}&photo=true`, { Cookie: `buvid3=${buvid}` })).body.toString('utf8')
  );
  const d = raw?.data;
  const c = d?.card;
  if (!c?.name) throw new Error('bilibili card empty');
  const bangumi = await fetchBangumi();
  const favFolders = await fetchFavs();
  return {
    name: c.name,
    avatar: (c.face || '').replace(/^http:\/\//, 'https://'),
    avatarLocal: await saveImage(c.face, 'bilibili'),
    sign: c.sign || '',
    fans: c.fans ?? 0,
    following: c.friend ?? 0,
    videos: d.archive_count ?? 0,
    likes: d.like_num ?? 0,
    level: c.level_info?.current_level ?? 0,
    sex: c.sex || '',
    vipLabel: c.vip?.status === 1 ? c.vip?.label?.text || '大会员' : '',
    bangumi: bangumi.items,
    bangumiTotal: bangumi.total,
    bangumiPublic: bangumi.isPublic,
    favFolders,
  };
}

async function fetchSteamProfile(): Promise<{ total: number; games: GameItem[]; hours2wk: string; isPublic: boolean }> {
  try {
    const body = (await get(`https://steamcommunity.com/profiles/${STEAM_ID}/`)).body.toString('utf8');
    const decode = (t: string) =>
      t
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    const totalM = body.match(/count_link_label">Games<\/span>[\s\S]*?profile_count_link_total">\s*(\d+)/);
    const total = totalM ? Number(totalM[1]) : 0;
    const h2w = body.match(/([\d.]+)\s*hours? past 2 weeks/);
    const games: GameItem[] = [];
    for (const chunk of body.split('<div class="recent_game">').slice(1)) {
      const part = chunk.slice(0, 2500);
      const nameM = part.match(/<div class="game_name">\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if (!nameM) continue;
      const hoursM = part.match(/([\d.]+)\s*hrs? on record/);
      const lastM = part.match(/last played on ([^<]+)</);
      games.push({
        name: decode(nameM[1]),
        hours: hoursM ? Number(hoursM[1]) : 0,
        lastPlayed: lastM ? lastM[1].trim() : '',
      });
    }
    return { total, games, hours2wk: h2w ? h2w[1] : '', isPublic: total > 0 };
  } catch {
    return { total: 0, games: [], hours2wk: '', isPublic: false };
  }
}

async function fetchSteam(): Promise<SteamInfo> {
  const body = (await get(`https://steamcommunity.com/profiles/${STEAM_ID}/?xml=1`)).body.toString('utf8');
  const tag = (t: string) => {
    const m = body.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`));
    return m ? m[1].trim() : '';
  };
  const name = tag('steamID');
  if (!name) throw new Error('steam xml empty');
  const avatar = tag('avatarFull').replace(/^http:\/\//, 'https://');
  const profile = await fetchSteamProfile();
  return {
    name,
    avatar,
    avatarLocal: await saveImage(avatar, 'steam'),
    state: tag('onlineState') || 'offline',
    stateText: tag('stateMessage'),
    privacy: tag('privacyState'),
    memberSince: tag('memberSince'),
    location: tag('location'),
    hours2wk: profile.hours2wk || tag('hoursPlayed2Wk'),
    vacBanned: Number(tag('vacBanned') || 0),
    games: profile.games,
    gamesTotal: profile.total,
    hoursTotal: 0,
    gamesPublic: profile.isPublic,
  };
}

let pending: Promise<SocialData> | null = null;
let pendingAt = 0;

export function getSocial(): Promise<SocialData> {
  const now = Date.now();
  if (pending && (import.meta.env.PROD || now - pendingAt < 60_000)) return pending;
  pendingAt = now;
  pending = (async () => {
    let cache: Partial<SocialData> = cacheJson as Partial<SocialData>;
    try {
      if (fs.existsSync(CACHE_PATH)) cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch {
      /* 用打包进来的缓存 */
    }
    console.log('[social] cache source:', fs.existsSync(CACHE_PATH) ? 'fs' : 'bundled');
    let bilibili = cache.bilibili;
    let steam = cache.steam;
    try {
      bilibili = await fetchBilibili();
    } catch (e) {
      console.warn('[social] bilibili fetch failed, using cache:', String(e));
    }
    try {
      steam = await fetchSteam();
    } catch (e) {
      console.warn('[social] steam fetch failed, using cache:', String(e));
    }
    // 图片一律优先用仓库里的本地文件(缓存中的路径), 不依赖构建环境的文件系统/网络
    const cb = cache.bilibili;
    const cs = cache.steam;
    const merged: SocialData = {
      bilibili: bilibili
        ? {
            ...bilibili,
            avatarLocal: cb?.avatarLocal || bilibili.avatarLocal || '',
            bangumi: bilibili.bangumi.map((b, i) => ({
              ...b,
              coverLocal: cb?.bangumi?.[i]?.coverLocal || b.coverLocal || '',
            })),
            favFolders: bilibili.favFolders.map((f, fi) => ({
              ...f,
              items: f.items.map((it, ii) => ({
                ...it,
                coverLocal: cb?.favFolders?.[fi]?.items?.[ii]?.coverLocal || it.coverLocal || '',
              })),
            })),
          }
        : (cb as BiliInfo),
      steam: steam
        ? { ...steam, avatarLocal: cs?.avatarLocal || steam.avatarLocal || '' }
        : (cs as SteamInfo),
      updatedAt: new Date().toISOString(),
    };
    const data = merged;
    try {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
    } catch {
      /* ignore */
    }
    return data;
  })();
  return pending;
}

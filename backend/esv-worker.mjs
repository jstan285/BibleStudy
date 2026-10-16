const SITE = 'https://jstan285.github.io/BibleStudy/';
const ORIGIN = new URL(SITE).origin;
// Verse totals are used conservatively to keep a study below half of any book.
const BOOKS = {'genesis':1533,'exodus':1213,'leviticus':859,'numbers':1288,'deuteronomy':959,'joshua':658,'judges':618,'ruth':85,'1 samuel':810,'2 samuel':695,'1 kings':816,'2 kings':719,'1 chronicles':942,'2 chronicles':822,'ezra':280,'nehemiah':406,'esther':167,'job':1070,'psalm':2461,'psalms':2461,'proverbs':915,'ecclesiastes':222,'song of solomon':117,'song of songs':117,'isaiah':1292,'jeremiah':1364,'lamentations':154,'ezekiel':1273,'daniel':357,'hosea':197,'joel':73,'amos':146,'obadiah':21,'jonah':48,'micah':105,'nahum':47,'habakkuk':56,'zephaniah':53,'haggai':38,'zechariah':211,'malachi':55,'matthew':1071,'mark':678,'luke':1151,'john':879,'acts':1007,'romans':433,'1 corinthians':437,'2 corinthians':257,'galatians':149,'ephesians':155,'philippians':104,'colossians':95,'1 thessalonians':89,'2 thessalonians':47,'1 timothy':113,'2 timothy':83,'titus':46,'philemon':25,'hebrews':303,'james':108,'1 peter':105,'2 peter':61,'1 john':105,'2 john':13,'3 john':14,'jude':25,'revelation':404};
const normalize = ref => ref.replaceAll('–', '-').replaceAll('—', '-').trim();
const recentRequests = new Map();
// Only one study is held in memory, for one minute. Nothing is stored on disk.
let latestStudy = null;
let pendingStudy = null;

function reply(data, status = 200, origin = ORIGIN, extra = {}) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','X-Content-Type-Options':'nosniff',...extra}});
}

export function validateReferences(study) {
  const refs = [...new Set(study.steps.filter(step => step.kind === 'discussion').flatMap(step => step.refs || []).map(normalize))];
  if (!refs.length || refs.length > 30) throw new Error('The study needs a review of its Scripture references.');
  let total = 0;
  const byBook = new Map();
  for (const ref of refs) {
    const match = /^([1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(ref);
    const book = match?.[1].toLowerCase().replace('psalms', 'psalm').replace('song of songs', 'song of solomon');
    if (!match || !BOOKS[book]) throw new Error('This study contains an unsupported Scripture reference.');
    const chapter = Number(match[2]), start = Number(match[3]), end = Number(match[4] || match[3]);
    if (chapter < 1 || start < 1 || end < start || end > 176) throw new Error('This study contains an invalid Scripture range.');
    const count = end - start + 1;
    total += count;
    byBook.set(book, (byBook.get(book) || 0) + count);
    // A margin below the published limits also accommodates numbering differences.
    if (total > 450 || byBook.get(book) > Math.floor(BOOKS[book] * 0.45)) throw new Error('This study exceeds the configured ESV quotation limits and needs review.');
  }
  return refs;
}

async function siteJSON(path) {
  const target = new URL(path, SITE);
  if (!target.href.startsWith(SITE)) throw new Error('Invalid study file.');
  const response = await fetch(target, {signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('The study library could not be reached.');
  return response.json();
}

async function getPassage(reference, key) {
  const target = new URL('https://api.esv.org/v3/passage/html/');
  const options = {'q':reference,'include-passage-references':'false','include-verse-numbers':'true','include-first-verse-numbers':'true','include-headings':'false','include-footnotes':'false','include-footnote-body':'false','include-chapter-numbers':'false','include-audio-link':'false','include-css-link':'false','inline-styles':'false','include-short-copyright':'false','include-copyright':'true'};
  for (const [name,value] of Object.entries(options)) target.searchParams.set(name,value);
  const response = await fetch(target, {headers:{Authorization:`Token ${key}`},signal:AbortSignal.timeout(12000)});
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'ESV is receiving too many requests. Please try again in a minute.' : `ESV could not load passages (HTTP ${response.status}). Please check the ESV connection.`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const result = await response.json();
  if (!Array.isArray(result.passages) || !result.passages.length || result.passages.some(html => typeof html !== 'string' || !html.trim())) throw new Error('ESV returned an incomplete passage.');
  const range = / (\d+):(\d+)(?:-(\d+))?$/.exec(reference);
  const [start, end] = result.parsed?.[0] || [];
  if (result.parsed?.length !== 1 || !Number.isInteger(start) || !Number.isInteger(end) || Math.floor(start / 1000) !== Math.floor(end / 1000) || Math.floor(start / 1000) % 1000 !== Number(range[1]) || start % 1000 !== Number(range[2]) || end % 1000 !== Number(range[3] || range[2])) throw new Error('ESV returned a different Scripture range. This study needs review.');
  return {reference, canonical:result.canonical, html:result.passages.join('\n')};
}

async function studyReadings(id, key) {
  if (latestStudy?.id === id && latestStudy.until > Date.now()) return latestStudy.data;
  if (pendingStudy?.id === id) return pendingStudy.promise;
  latestStudy = null;
  const pending = {id, promise:null};
  pending.promise = (async () => {
    const catalog = await siteJSON('studies/index.json');
    const entry = catalog.studies?.find(item => item.id === id);
    if (!entry || !/^studies\/[a-z0-9-]+\.json$/.test(entry.file)) {
      const error = new Error('This study is not in the published library.');
      error.status = 404;
      throw error;
    }
    const study = await siteJSON(entry.file);
    if (study.id !== id || !Array.isArray(study.steps)) throw new Error('The published study could not be read.');
    const refs = validateReferences(study);
    const readings = {};
    for (let index = 0; index < refs.length; index += 3) {
      const batch = await Promise.all(refs.slice(index,index+3).map(ref => getPassage(ref,key)));
      for (const reading of batch) readings[reading.reference] = reading;
    }
    const data = {study:id,translation:'ESV',readings};
    if (pendingStudy === pending) latestStudy = {id,data,until:Date.now()+60000};
    return data;
  })();
  pendingStudy = pending;
  try { return await pending.promise; }
  finally { if (pendingStudy === pending) pendingStudy = null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && origin !== ORIGIN) return reply({error:'This connection is for Bible Studies.'},403,'null');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600','Vary':'Origin'}});
    if (request.method !== 'GET') return reply({error:'Method not allowed.'},405,ORIGIN,{Allow:'GET, OPTIONS'});
    if (url.pathname === '/health') return reply({service:'Bible Studies ESV',configured:!!env.ESV_API_KEY});
    if (url.pathname !== '/study') return reply({error:'Not found.'},404);
    const id = url.searchParams.get('id');
    if (!id || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return reply({error:'Choose a published study.'},400);
    if (!env.ESV_API_KEY) return reply({error:'The ESV connection is still being set up.'},503);
    // This is a per-instance guard; Crossway also enforces its account-wide limits.
    const now = Date.now();
    for (const [ip, value] of recentRequests) if (value.until < now) recentRequests.delete(ip);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const count = recentRequests.get(ip) || {count:0,until:now+60000};
    if (count.count >= 4 || recentRequests.size > 2000) return reply({error:'Please wait a minute before reloading Scripture.'},429,ORIGIN,{'Retry-After':'60'});
    count.count++;
    recentRequests.set(ip,count);
    try {
      return reply(await studyReadings(id,env.ESV_API_KEY));
    } catch (error) {
      return reply({error:error.message || 'Scripture could not be loaded.'},error.status || 502);
    }
  }
};

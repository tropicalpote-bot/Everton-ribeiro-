const ALLOWED_MAP_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
]);
const PLACE_FIELDS = [
  'displayName',
  'formattedAddress',
  'googleMapsUri',
  'primaryTypeDisplayName',
  'rating',
  'userRatingCount',
  'websiteUri',
  'nationalPhoneNumber',
  'regularOpeningHours',
  'photos',
  'businessStatus',
].join(',');

function isAllowedMapUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_MAP_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

async function resolveMapUrl(value) {
  let current = value;
  for (let i = 0; i < 5; i += 1) {
    if (!isAllowedMapUrl(current)) break;
    const response = await fetch(current, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 PerfilEmFoco/1.0' },
    });
    const location = response.headers.get('location');
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!isAllowedMapUrl(next)) break;
    current = next;
  }
  return current;
}

function parseGoogleInput(input) {
  if (!/^https?:\/\//i.test(input)) return { textQuery: input };
  if (!isAllowedMapUrl(input)) throw new Error('Use um link do Google Maps ou digite o nome do negócio.');
  const url = new URL(input);
  const id = url.searchParams.get('query_place_id') || url.searchParams.get('place_id');
  if (id && /^[\w-]{5,200}$/.test(id)) return { placeId: id };
  const query = url.searchParams.get('query') || url.searchParams.get('q');
  if (query) return { textQuery: query };
  const segments = url.pathname.split('/').filter(Boolean);
  const mapsIndex = segments.indexOf('maps');
  if (mapsIndex >= 0) {
    const mode = segments[mapsIndex + 1];
    if ((mode === 'place' || mode === 'search') && segments[mapsIndex + 2]) {
      return { textQuery: decodeURIComponent(segments[mapsIndex + 2].replace(/\+/g, ' ')) };
    }
  }
  return { mapUrl: input };
}

async function googleFetch(url, options, apiKey) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': options.method === 'POST'
        ? `places.id,places.${PLACE_FIELDS}`
        : PLACE_FIELDS,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message || 'A API do Google recusou a consulta.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Falta configurar a chave do Google Maps Platform na Vercel (GOOGLE_MAPS_API_KEY).' });
  const input = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!input || input.length > 300) return res.status(400).json({ error: 'Informe um nome ou link válido (até 300 caracteres).' });

  try {
    let query = parseGoogleInput(input);
    if (query.mapUrl) {
      try {
        const resolved = await resolveMapUrl(query.mapUrl);
        if (resolved !== query.mapUrl) query = parseGoogleInput(resolved);
      } catch {
        // Some Maps short links do not allow server-side expansion; the UI will suggest a name + city.
      }
    }
    let data;
    if (query.placeId) {
      const id = encodeURIComponent(query.placeId);
      const place = await googleFetch(`https://places.googleapis.com/v1/places/${id}`, { method: 'GET' }, apiKey);
      data = { places: [place] };
    } else if (query.textQuery && query.textQuery.length <= 300) {
      data = await googleFetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        body: JSON.stringify({ textQuery: query.textQuery, maxResultCount: 5, languageCode: 'pt-BR', regionCode: 'BR' }),
      }, apiKey);
    } else {
      return res.status(400).json({ error: 'Não consegui ler esse link curto. Tente digitar o nome do negócio e a cidade.' });
    }
    return res.status(200).json({ places: data.places || [] });
  } catch (error) {
    console.error('Google Places lookup failed:', error.message);
    const status = error.status === 403 ? 502 : 502;
    return res.status(status).json({ error: 'A busca no Google falhou. Confira se a Places API (New) está ativada, com faturamento e chave válidos.' });
  }
};

const axios = require('axios');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1'
};

const client = axios.create({
  headers: BROWSER_HEADERS,
  responseType: 'text',
  maxRedirects: 5
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url) return res.status(400).send('Missing ?url=');

  try {
    // Крок 1: отримати PHPSESSID з пошукової форми
    const sessionRes = await client.get('https://uafix.net/search.html?do=search');
    const rawCookies = sessionRes.headers['set-cookie'] || [];
    const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');
    const fullCookie = cookieStr + (cookieStr ? '; ' : '') + 'b=b';

    // Визначаємо Referer залежно від типу URL
    const isSerial = url.includes('/serials/');
    const referer = isSerial
      ? url.replace(/\/season-\d+-episode-\d+\/$/, '/').replace(/\/sezon-\d+\/$/, '/')
      : 'https://uafix.net/';

    // Крок 2: виконати цільовий запит з cookie
    const response = await client.get(url, {
      headers: {
        'Referer': referer,
        'Cookie': fullCookie
      }
    });

    res.send(response.data);
  } catch (e) {
    res.status(500).send(e.message);
  }
};

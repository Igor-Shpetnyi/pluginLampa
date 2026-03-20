const axios = require('axios');

const client = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
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
    // Крок 1: отримати сесійний cookie з головної сторінки uafix
    const sessionRes = await client.get('https://uafix.net/', {
      responseType: 'text'
    });
    const cookies = sessionRes.headers['set-cookie'];
    const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    // Крок 2: виконати цільовий запит з cookie
    const response = await client.get(url, {
      headers: {
        'Referer': 'https://uafix.net/search.html?do=search',
        'Cookie': cookieStr
      }
    });

    res.send(response.data);
  } catch (e) {
    res.status(500).send(e.message);
  }
};

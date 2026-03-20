const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url) return res.status(400).send('Missing ?url=');

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://uafix.net/search.html?do=search',
        'Origin': 'https://uafix.net'
      },
      responseType: 'text'
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e.message);
  }
};

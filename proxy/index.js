const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.sendStatus(200);
});

app.get('/fetch', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing ?url=');
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      responseType: 'text'
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.listen(PORT, () => console.log('UAflix proxy running on http://localhost:' + PORT));

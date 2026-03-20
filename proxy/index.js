const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.all('/fetch', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing ?url=');
  try {
    const isPost = req.method === 'POST';
    const response = await axios({
      method: isPost ? 'post' : 'get',
      url,
      data: isPost ? req.body : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': isPost ? 'application/x-www-form-urlencoded' : undefined
      },
      responseType: 'text'
    });
    res.send(response.data);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.listen(PORT, '0.0.0.0', () => console.log('UAflix proxy running on port ' + PORT));

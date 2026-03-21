(function () {
  'use strict';

  // ─── Налаштування ────────────────────────────────────────────────────────────
  var UAFIX = 'https://uafix.net';           // сайт з фільмами і серіалами
  var ZETVIDEO = 'https://zetvideo.net';     // відеохостинг де зберігаються m3u8 потоки
  var PROXY = 'https://plugin-lampa.vercel.app/api/fetch?url='; // наш проксі (обхід CORS для uafix/zetvideo)
  var PROXY2 = 'https://corsproxy.io/?url='; // альтернативний проксі для episode сторінок
  var PASSWORD = '0308';                     // пароль для доступу до плагіна

  // ─── HTTP запити ─────────────────────────────────────────────────────────────

  // Звичайний запит через наш Vercel проксі (для пошуку, фільмів, zetvideo)
  function request(url, callback) {
    fetch(PROXY + encodeURIComponent(url))
      .then(function (r) { return r.text(); })
      .then(callback)
      .catch(function (err) { Lampa.Noty.show('Помилка: ' + err.message); });
  }

  // Запит сторінки серії через альтернативний проксі
  // (Vercel отримує від uafix іншу версію HTML без zetvideo — IP-проблема)
  function requestEpisode(url, callback) {
    fetch(PROXY2 + encodeURIComponent(url))
      .then(function (r) { return r.text(); })
      .then(callback)
      .catch(function (err) { Lampa.Noty.show('Помилка: ' + err.message); });
  }

  // ─── Парсери HTML ─────────────────────────────────────────────────────────────

  // Витягує числовий ID відео з zetvideo (напр. zetvideo.net/vod/12345)
  function extractZetvideoId(html) {
    var match = html.match(/zetvideo\.net\/vod\/(\d+)/);
    return match ? match[1] : null;
  }

  // Витягує пряме m3u8 посилання зі сторінки zetvideo
  function extractM3u8(html) {
    var match = html.match(/file:"(https:\/\/zetvideo\.net[^"]+\.m3u8)"/);
    return match ? match[1] : null;
  }

  // Витягує URL фільму або серіалу з результатів пошуку uafix
  function extractFilmUrl(html) {
    // Фільми: /films/ або /film/
    var match = html.match(/class="sres-wrap[^"]*"\s+href="(https?:\/\/uafix\.net\/films?\/[^"]+)"/);
    if (match) return match[1];
    match = html.match(/href="(https?:\/\/uafix\.net\/films?\/[a-z0-9][a-z0-9-]+\/)"/);
    if (match) return match[1];
    // Серіали: /serials/
    match = html.match(/class="sres-wrap[^"]*"\s+href="(https?:\/\/uafix\.net\/serials\/[^"]+)"/);
    if (match) return match[1];
    match = html.match(/href="(https?:\/\/uafix\.net\/serials\/[a-z0-9][a-z0-9-]+\/)"/);
    return match ? match[1] : null;
  }

  // Витягує список серій зі сторінки серіалу
  // Повертає об'єкт: { 1: [{season, episode, url, title}, ...], 2: [...], ... }
  function extractEpisodes(html) {
    var seasons = {};
    var re = /href="(https?:\/\/uafix\.net\/serials\/[^"]+\/season-(\d+)-episode-(\d+)\/)"[^>]*>[\s\S]*?<div class="vi-title">[^<]*(?:Сезон \d+ )?Серія \d+[^<]*<\/div>[\s\S]*?<div class="vi-rate">([^<]*)<\/div>/g;
    var match;
    while ((match = re.exec(html)) !== null) {
      var url = match[1];
      var s = parseInt(match[2], 10);
      var e = parseInt(match[3], 10);
      var desc = match[4].trim();
      if (!seasons[s]) seasons[s] = [];
      seasons[s].push({ season: s, episode: e, url: url, title: desc });
    }
    Object.keys(seasons).forEach(function (s) {
      seasons[s].sort(function (a, b) { return a.episode - b.episode; });
    });
    return seasons;
  }

  // Шукає пряме m3u8 посилання на сторінці серії
  // (деякі серії мають <video src="...m3u8"> або file:"...m3u8" напряму)
  function extractM3u8Direct(html) {
    var match = html.match(/[<\s]src="(https?:\/\/[^"]+\.m3u8)"/);
    if (match) return match[1];
    match = html.match(/file:"(https?:\/\/[^"]+\.m3u8)"/);
    return match ? match[1] : null;
  }

  // ─── Відтворення ─────────────────────────────────────────────────────────────

  // Програє одну серію:
  // 1. Шукає пряме m3u8 на сторінці серії
  // 2. Якщо ні — шукає zetvideo ID і завантажує m3u8 звідти
  function playEpisode(url, title) {
    Lampa.Noty.show('Завантаження серії\u2026');
    requestEpisode(url, function (html) {
      var m3u8 = extractM3u8Direct(html);
      if (m3u8) {
        Lampa.Player.play({ url: m3u8, title: title });
        return;
      }
      var zetId = extractZetvideoId(html);
      if (!zetId) { Lampa.Noty.show('Плеєр не знайдено'); return; }
      request(ZETVIDEO + '/vod/' + zetId, function (zetHtml) {
        var m3u8z = extractM3u8(zetHtml);
        if (!m3u8z) { Lampa.Noty.show('Потік не знайдено'); return; }
        Lampa.Player.play({ url: m3u8z, title: title });
      });
    });
  }

  // Програє фільм:
  // пошук на uafix → URL фільму → zetvideo ID → m3u8 → плеєр
  function playFilm(movie) {
    var title = movie.title || movie.original_title;
    Lampa.Noty.show('Пошук фільму\u2026');
    var searchUrl = UAFIX + '/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=' + encodeURIComponent(title);
    request(searchUrl, function (searchHtml) {
      var filmUrl = extractFilmUrl(searchHtml);
      if (!filmUrl) { Lampa.Noty.show('Фільм не знайдено'); return; }
      request(filmUrl, function (filmHtml) {
        var zetId = extractZetvideoId(filmHtml);
        if (!zetId) { Lampa.Noty.show('Плеєр не знайдено'); return; }
        request(ZETVIDEO + '/vod/' + zetId, function (zetHtml) {
          var m3u8 = extractM3u8(zetHtml);
          if (!m3u8) { Lampa.Noty.show('Потік не знайдено'); return; }
          Lampa.Player.play({ url: m3u8, title: movie.title || title });
        });
      });
    });
  }

  // ─── UI вибору серій ──────────────────────────────────────────────────────────

  // Показує меню вибору серії всередині сезону
  function showEpisodeSelect(seasons, seasonNum, seriesTitle) {
    var episodes = seasons[seasonNum];
    var items = episodes.map(function (ep) {
      return { title: 'Серія ' + ep.episode + (ep.title ? ' — ' + ep.title : ''), ep: ep };
    });
    Lampa.Select.show({
      title: 'Сезон ' + seasonNum + ' — виберіть серію',
      items: items,
      onSelect: function (item) {
        Lampa.Select.hide();
        playEpisode(item.ep.url, seriesTitle + ' S' + seasonNum + 'E' + item.ep.episode);
      },
      onBack: function () { Lampa.Select.hide(); }
    });
  }

  // Показує меню вибору сезону (якщо сезон один — одразу переходить до серій)
  function showSeasonSelect(seasons, seriesTitle) {
    var seasonNums = Object.keys(seasons).map(Number).sort(function (a, b) { return a - b; });
    if (seasonNums.length === 1) {
      showEpisodeSelect(seasons, seasonNums[0], seriesTitle);
      return;
    }
    var items = seasonNums.map(function (s) {
      return { title: 'Сезон ' + s + ' (' + seasons[s].length + ' серій)', season: s };
    });
    Lampa.Select.show({
      title: 'Виберіть сезон',
      items: items,
      onSelect: function (item) {
        Lampa.Select.hide();
        showEpisodeSelect(seasons, item.season, seriesTitle);
      },
      onBack: function () { Lampa.Select.hide(); }
    });
  }

  // Завантажує сторінку серіалу, парсить список серій і показує меню вибору
  function playSerial(movie, serialUrl) {
    var title = movie.name || movie.title || movie.original_name || '';
    Lampa.Noty.show('Завантаження серіалу\u2026');
    request(serialUrl, function (html) {
      var seasons = extractEpisodes(html);
      if (!Object.keys(seasons).length) { Lampa.Noty.show('Серії не знайдено'); return; }
      showSeasonSelect(seasons, title);
    });
  }

  // Визначає тип контенту (серіал чи фільм) і запускає відповідний потік
  function play(movie) {
    var isSerial = movie.media_type === 'tv' || movie.number_of_seasons;
    if (isSerial) {
      var searchTitle = movie.name || movie.original_name || movie.title || '';
      Lampa.Noty.show('Пошук серіалу\u2026');
      var searchUrl = UAFIX + '/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=' + encodeURIComponent(searchTitle);
      request(searchUrl, function (searchHtml) {
        var serialUrl = extractFilmUrl(searchHtml);
        if (!serialUrl) { Lampa.Noty.show('Серіал не знайдено'); return; }
        playSerial(movie, serialUrl);
      });
    } else {
      playFilm(movie);
    }
  }

  // ─── Захист паролем ───────────────────────────────────────────────────────────

  // Перевіряє пароль через localStorage (зберігається між сесіями)
  // Якщо вже введено правильний — одразу пускає без повторного запиту
  function checkPassword(onSuccess) {
    if (localStorage.getItem('shpet_auth') === PASSWORD) {
      onSuccess();
      return;
    }
    var value = window.prompt('Введіть пароль:');
    if (value === PASSWORD) {
      localStorage.setItem('shpet_auth', value);
      onSuccess();
    } else {
      Lampa.Noty.show('Невірний пароль');
    }
  }

  // ─── Інтеграція з Lampa ───────────────────────────────────────────────────────

  // Слухає подію відкриття картки фільму/серіалу і додає кнопку "Шукати фільм"
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;

    var movie = e.data.movie;
    var render = e.object.activity.render();

    var button = $('<div class="full-start__button selector">\u25b6 \u0428\u0443\u043a\u0430\u0442\u0438 \u0444\u0456\u043b\u044c\u043c (by Shpet)</div>');

    button.on('hover:enter', function () {
      checkPassword(function () {
        play(movie);
      });
    });

    // Підтримка двох версій Lampa UI (full-start-new і старий full-start)
    var container = $('.full-start-new__buttons', render);
    if (!container.length) container = $('.full-start__buttons', render);
    container.append(button);
  });

})();

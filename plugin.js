(function () {
  'use strict';

  // ─── Налаштування ────────────────────────────────────────────────────────────
  var UAFIX = 'https://uafix.net';           // сайт з фільмами
  var ZETVIDEO = 'https://zetvideo.net';     // відеохостинг де зберігаються m3u8 потоки
  var PROXY = 'https://plugin-lampa.vercel.app/api/fetch?url='; // проксі (обхід CORS)
  var PASSWORD = '0308';                     // пароль для доступу до плагіна

  // ─── HTTP запити ─────────────────────────────────────────────────────────────

  // Запит через Vercel проксі (для пошуку, фільмів, zetvideo)
  function request(url, callback) {
    fetch(PROXY + encodeURIComponent(url))
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

  // Витягує URL фільму з результатів пошуку uafix
  function extractFilmUrl(html) {
    var match = html.match(/class="sres-wrap[^"]*"\s+href="(https?:\/\/uafix\.net\/films?\/[^"]+)"/);
    if (match) return match[1];
    match = html.match(/href="(https?:\/\/uafix\.net\/films?\/[a-z0-9][a-z0-9-]+\/)"/);
    return match ? match[1] : null;
  }

  // ─── Відтворення ─────────────────────────────────────────────────────────────

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

  // Визначає тип контенту і запускає відповідний потік
  // Серіали наразі не підтримуються (GeoIP обмеження uafix.net)
  function play(movie) {
    var isSerial = movie.media_type === 'tv' || movie.number_of_seasons;
    if (isSerial) {
      Lampa.Noty.show('Серіали поки що не підтримуються');
      return;
    }
    playFilm(movie);
  }

  // ─── Захист паролем ───────────────────────────────────────────────────────────

  // Перевіряє пароль через localStorage (зберігається між сесіями)
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

  // Слухає подію відкриття картки фільму/серіалу і додає кнопку
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

    // Підтримка двох версій Lampa UI
    var container = $('.full-start-new__buttons', render);
    if (!container.length) container = $('.full-start__buttons', render);
    container.append(button);
  });

})();

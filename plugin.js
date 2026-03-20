(function () {
  'use strict';

  var UAFIX = 'https://uafix.net';
  var ZETVIDEO = 'https://zetvideo.net';

  // На Android TV CORS не потрібен, в браузері — локальний проксі
  var PROXY = 'https://plugin-lampa.vercel.app/api/fetch?url=';

  function request(url, callback) {
    fetch(PROXY + encodeURIComponent(url))
      .then(function (r) { return r.text(); })
      .then(callback)
      .catch(function (err) { Lampa.Noty.show('\u041f\u043e\u043c\u0438\u043b\u043a\u0430: ' + err.message); });
  }

function extractZetvideoId(html) {
    var match = html.match(/zetvideo\.net\/vod\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractM3u8(html) {
    var match = html.match(/file:"(https:\/\/zetvideo\.net[^"]+\.m3u8)"/);
    return match ? match[1] : null;
  }

  function extractFilmUrl(html) {
    // Результат пошуку має клас sres-wrap з абсолютним посиланням
    var match = html.match(/class="sres-wrap[^"]*"\s+href="(https?:\/\/uafix\.net\/films?\/[^"]+)"/);
    if (match) return match[1];
    // Запасний варіант
    match = html.match(/href="(https?:\/\/uafix\.net\/films?\/[a-z0-9][a-z0-9-]+\/)"/);
    return match ? match[1] : null;
  }

  function playFilm(movie) {
    var title = movie.title || movie.original_title;
    Lampa.Noty.show('\u041f\u043e\u0448\u0443\u043a \u0444\u0456\u043b\u044c\u043c\u0443\u2026');

    // Крок 1: пошук фільму на UAfix.net (GET)
    var searchUrl = UAFIX + '/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=' + encodeURIComponent(title);
    request(searchUrl, function (searchHtml) {
      var filmUrl = extractFilmUrl(searchHtml);
      if (!filmUrl) {
        Lampa.Noty.show('\u0424\u0456\u043b\u044c\u043c \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e');
        return;
      }

      // Крок 2: сторінка фільму → ID zetvideo
      request(filmUrl, function (filmHtml) {
        var zetId = extractZetvideoId(filmHtml);
        if (!zetId) {
          Lampa.Noty.show('\u041f\u043b\u0435\u0454\u0440 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e');
          return;
        }

        // Крок 3: zetvideo → m3u8
        request(ZETVIDEO + '/vod/' + zetId, function (zetHtml) {
          var m3u8 = extractM3u8(zetHtml);
          if (!m3u8) {
            Lampa.Noty.show('\u041f\u043e\u0442\u0456\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e');
            return;
          }

          Lampa.Player.play({
            url: m3u8,
            title: movie.title || title
          });
        });
      });
    });
  }

  // Додаємо кнопку на картку фільму
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;

    var movie = e.data.movie;
    var render = e.object.activity.render();

    var button = $('<div class="full-start__button selector">\u25b6 \u0428\u0443\u043a\u0430\u0442\u0438 \u0444\u0456\u043b\u044c\u043c (by Shpet)</div>');

    button.on('hover:enter', function () {
      playFilm(movie);
    });

    var container = $('.full-start-new__buttons', render);
    if (!container.length) container = $('.full-start__buttons', render);
    container.append(button);
  });

})();

(function () {
  'use strict';

  var UAFLIX = 'https://uafix.net';
  var ZETVIDEO = 'https://zetvideo.net';

  // На Android TV CORS не потрібен, в браузері — локальний проксі
  var PROXY = 'https://plugin-lampa.vercel.app/api/fetch?url=';

  function request(url, callback) {
    fetch(PROXY + encodeURIComponent(url))
      .then(function (r) { return r.text(); })
      .then(callback)
      .catch(function (err) { Lampa.Noty.show('[UAflix] ' + err.message); });
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
    // Шукаємо перший результат пошуку — посилання на сторінку фільму
    var match = html.match(/href="(https?:\/\/uafix\.net\/film\/[^"]+)"/);
    return match ? match[1] : null;
  }

  function playFilm(movie) {
    var title = movie.title || movie.original_title;
    Lampa.Noty.show('\u041f\u043e\u0448\u0443\u043a \u043d\u0430 UAflix\u2026');

    // Крок 1: пошук фільму на uaflix.net (GET)
    var searchUrl = UAFLIX + '/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=' + encodeURIComponent(title);
    request(searchUrl, function (searchHtml) {
      console.log('[UAflix] search HTML (500 chars):', searchHtml.slice(0, 500));
      var filmUrl = extractFilmUrl(searchHtml);
      if (!filmUrl) {
        Lampa.Noty.show('[UAflix] \u0424\u0456\u043b\u044c\u043c \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e \u043d\u0430 uaflix.net');
        return;
      }

      // Крок 2: сторінка фільму → ID zetvideo
      request(filmUrl, function (filmHtml) {
        var zetId = extractZetvideoId(filmHtml);
        if (!zetId) {
          Lampa.Noty.show('[UAflix] \u041f\u043b\u0435\u0454\u0440 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e');
          return;
        }

        // Крок 3: zetvideo → m3u8
        request(ZETVIDEO + '/vod/' + zetId, function (zetHtml) {
          var m3u8 = extractM3u8(zetHtml);
          if (!m3u8) {
            Lampa.Noty.show('[UAflix] \u041f\u043e\u0442\u0456\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e');
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

    var button = $('<div class="full-start__button selector">\u25b6 UAflix</div>');

    button.on('hover:enter', function () {
      playFilm(movie);
    });

    var container = $('.full-start-new__buttons', render);
    if (!container.length) container = $('.full-start__buttons', render);
    container.append(button);
  });

})();

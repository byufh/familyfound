// NOT USED atm.

var template_loader = {
  templates: {},
  loading: 0,
  get_templates: function (onDone) {
    return function () {
      _.templateSettings = {
        'interpolate': /{([\s\S]+?)}/g
      };
      var running = 0;
      var base = TEMPLATES[0];
      $(TEMPLATES.slice(1)).each(function (i, name) {
        var src = base + name + '.html';
        var name = src.split('/').slice(-1)[0].split('.')[0];
        template_loader.loading++;
        $.ajax({
          'method': 'GET',
          'url': src,
          'success': function (data, thing, xhr) {
            template_loader.templates[name] = _.template(data, null, {'sourceURL': src, });
            template_loader.loading--;
            if (template_loader.loading <= 0) {
              onDone();
            }
          },
          'error': function (xhr, error) {
            template_loader.loading--;
            throw "Failed! to load template: " + name + ' from ' + src;
          },
        });
      });
    };
  }
}


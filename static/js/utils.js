
_.templateSettings = {
  'interpolate': /{([\s\S]+?)}/g
};

var utils = {

  first_date: function (person) {
    var ev = utils.get_event(person);
    var date = ev ? ev.date_num : null;
    date = date ? date : utils.get_date(person);
    return date;
  },

  get_templates: function () {
    $('script[type="text/tpl"]').each(function (i, val) {
      template_loader.templates[val.getAttribute('name')] = _.template(val.innerHTML);
    });
  },

  get_event: function (person) {
    var birth = null;
    for (var i=0; i<person.events.length; i++) {
      if (person.events[i].type === 'Birth' && person.events[i].place_geo) {
        return person.events[i];
      }
    }
    for (var i=0; i<person.events.length; i++) {
      if (person.events[i].place_geo) {
        return person.events[i];
      }
    }
  },

  get_date: function (person) {
    for (var i=0; i<person.events.length; i++) {
      if (person.events[i].date_num) {
        return person.events[i].date_num;
      }
    }
  },

  loc_to_ll: function (location) {
    return new google.maps.LatLng(location.lat, location.lng);
  },

  txt2date: function (txt) {
    return new Date(txt.replace(/-/g, ' '));
  },

  ev2date: function (ev) {
    var d = ev.date_num || ev.date_fallback;
    return d ? utils.txt2date(d) : null;
  },

  ev2place: function (ev) {
    var p = ev.place_fallback || ev.place_geo;
    return (p && p.geometry) ? utils.loc_to_ll(p.geometry.location) : null;
  },

};


(function($){

  window.get_spouse = function (id, fam) {
    return fam.parents[id === fam.parents.father ? 'mother' : 'father'];
  };

  window.make_events_dict = function (events) {
    var dict = {};
    var keys = [];
    for (var i=0; i<events.length; i++) {
      if (keys.indexOf(events[i].type) === -1) {
        dict[events[i].type] = [];
        keys.push(events[i].type);
      }
      dict[events[i].type].push(events[i]);
    }
    return dict;
  };

  window.between = function (a, b, c) {
    return (c - a)/(b - a)*100;
  };

  window.commet = function (url, options) {
    /** recieve JSON objects **/
    var xhr = new $.ajaxSettings.xhr();
    var loading = options.loading || function (){};
    var done = options.done || function (){};
    var error = options.error || function (){};
    var data_pos = 0;
    xhr.onreadystatechange = function () {
      var new_data, parsed;
      if (this.readyState === 3) {
        new_data = this.responseText.slice(data_pos).split('\n');
        for (var i=0; i<new_data.length; i++) {
          if (!new_data[i].replace(/^\s+/, '').length) {
            continue;
          }
          parsed = false;
          try {
            parsed = JSON.parse(new_data[i]);
            data_pos += new_data[i].length + 1;
          } catch (e) {
            // assume it got cut off in the middle
            break;
          }
          loading.call(this, parsed);
        }
        return;
      } else if (this.readyState === 4) {
        new_data = this.responseText.slice(data_pos).replace(/^\s+/, '').split('\n');
        data_pos = this.responseText.length;
        if (this.status === 200) {
          for (var i=0; i<new_data.length; i++) {
            if (!new_data[i].replace(/^\s+/, '').length) {
              continue;
            }
            try {
              parsed = JSON.parse(new_data[i]);
            } catch (e) {
              error.call(this, 'json parse error', [i, new_data[i]]);
              continue;
            }
            loading.call(this, parsed);
          }
          return done.call(this);
        } else {
          return error.call(this, this.status);
        }
      }
    };
    xhr.open('GET', url);
    xhr.send();
    return xhr;
  };

    $.fn.autoGrowInput = function(o) {

        o = $.extend({
            maxWidth: 1000,
            minWidth: 0,
            comfortZone: 70
        }, o);

        this.filter('input:text').each(function(){

            var minWidth = o.minWidth || $(this).width(),
                val = '',
                input = $(this),
                testSubject = $('<tester/>').css({
                    position: 'absolute',
                    top: -9999,
                    left: -9999,
                    width: 'auto',
                    fontSize: input.css('fontSize'),
                    fontFamily: input.css('fontFamily'),
                    fontWeight: input.css('fontWeight'),
                    letterSpacing: input.css('letterSpacing'),
                    whiteSpace: 'nowrap'
                }),
                check = function() {

                    if (val === (val = input.val())) {return;}

                    // Enter new content into testSubject
                    var escaped = val.replace(/&/g, '&amp;').replace(/\s/g,'&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    testSubject.html(escaped);

                    // Calculate new width + whether to change
                    var testerWidth = testSubject.width(),
                        newWidth = (testerWidth + o.comfortZone) >= minWidth ? testerWidth + o.comfortZone : minWidth,
                        currentWidth = input.width(),
                        isValidWidthChange = (newWidth < currentWidth && newWidth >= minWidth)
                                             || (newWidth > minWidth && newWidth < o.maxWidth);

                    // Animate width
                    if (isValidWidthChange) {
                        input.width(newWidth);
                    }

                };

            testSubject.insertAfter(input);

            $(this).bind('keyup keydown blur update', check);

        });

        return this;

    };

    /**
    * Auto-growing textareas; technique ripped from Facebook
    *
    * http://github.com/jaz303/jquery-grab-bag/tree/master/javascripts/jquery.autogrow-textarea.js
    */
    $.fn.autogrow = function(options)
    {
        return this.filter('textarea').each(function()
        {
            var self = this;
            var $self = $(self);
            var minHeight = $self.height();
            var noFlickerPad = $self.hasClass('autogrow-short') ? 0 : parseInt($self.css('lineHeight'));

            var shadow = $('<div></div>').css({
                position: 'absolute',
                top: -10000,
                left: -10000,
                width: $self.width(),
                fontSize: $self.css('fontSize'),
                fontFamily: $self.css('fontFamily'),
                fontWeight: $self.css('fontWeight'),
                lineHeight: $self.css('lineHeight'),
                resize: 'none'
            }).appendTo(document.body);

            var update = function()
            {
                var times = function(string, number)
                {
                    for (var i=0, r=''; i<number; i++) r += string;
                    return r;
                };

                var val = self.value.replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/&/g, '&amp;')
                                    .replace(/\n$/, '<br/>&nbsp;')
                                    .replace(/\n/g, '<br/>')
                                    .replace(/ {2,}/g, function(space){ return times('&nbsp;', space.length - 1) + ' ' });

                shadow.css('width', $self.width());
                shadow.html(val);
                $self.css('height', Math.max(shadow.height() + noFlickerPad, minHeight));
            }

            $self.change(update).keyup(update).keydown(update);
            $(window).resize(update);

            update();
        });
    };
})(jQuery);


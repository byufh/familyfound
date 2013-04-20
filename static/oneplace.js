
var URL = '/ajax/get-pedigree'

/**

jqueryget

**/

var geocoder, map;
var res;

function New(protoProps, staticProps) {
  var child;
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function (options) {
      this.options = options;
      (this.initialize && this.initialize(options));
    };
  }
  // add static props to the class
  _.extend(child, staticProps);
  // add the protoProps to the prototype
  if (protoProps) {
    _.extend(child.prototype, protoProps);
  }
  child.extend = Backbone.Model.extend;
  return child;
}

var Person = New({
  constructor: function (data) {
    this.data = data;
  },
});

var MainApp = Application.extend({

  initialize: function () {
    this.db = {};
    this.map = new Map({parent: this, el: $('#map_canvas')});
    // this.fetch();
    this.login();
  },

  login: function () {
    var that = this;
    jQuery.ajax(URLS['check-login'], {
      success: function (data, txt, xhr) {
      if (data.authorized) {
        return this.logged_in(data.info);
      } else {
        $('#login-modal iframe')[0].src = data.url
        $('#login-modal').modal({backdrop: 'static', keyboard: false});
      }
    });
  },

  done_oauth: function (info) {
    $('#login-modal iframe')[0].src = '';
    $('#login-modal').modal('hide');
    this.logged_in(info);
  },

  logged_in: function (info) {
    this.user_data = info;
    this.render_user_data();
    this.fetch_pedigree();
  },

  render_user_data: function() {
    $('#user-name').text('My Friend!');
    // todo fill in
  },

  fetch: function () {
    var that = this;
    jQuery.ajax(URL, {
      success: function (data, txt, xhr) {
        that.load(data);
      }
    });
  },

  load: function (data) {
    this.db['people'] = data;
    var min = null, max = null;
    _.forOwn(data, function (person, id) {
      var ev = get_event(person);
      var date = ev ? ev.date_num : null;
      date = date? date : get_date(person);
      if (!date) return;
      var dobj = new Date(date.replace(/-/g, ' '));
      if (min === null || dobj < min) min = dobj;
      if (max === null || dobj > max) max = dobj;
    });
    this.mmdate = [min, max];
    this.map.load(data);
  }

});

function first_date(person) {
  var ev = get_event(person);
  var date = ev ? ev.date_num : null;
  date = date ? date : get_date(person);
  return date;
}

var TPL = {};
_.templateSettings = {
  'interpolate': /{([\s\S]+?)}/g
};
function get_templates() {
  TPL = {};
  $('script[type="text/tpl"]').each(function (i, val) {
    TPL[val.getAttribute('name')] = _.template(val.innerHTML);
  });
}

var MapInfo = Backbone.View.extend({
  el: '#info',
  initialize: function () {
    this.name = this.$('.name');
    this.the_events = this.$('.events');
    this.children = this.$('.children');
    this.pedigree = this.$('.pedigree');
  },
  load: function (id, person, people) {
    this.name.text(person.names[0] + ' ' + id);
    this.load_events(person);
    this.load_children(person, people);
  },
  load_events: function (person) {
    this.the_events.empty();
    for (var i=0; i<person.events.length; i++) {
      $(TPL['tpl-event']({
        'type': person.events[i].type,
        'place': person.events[i].place || 'unknown',
        'date': person.events[i].date || 'unknown'
      })).appendTo(this.the_events);
    }
  },
  load_children: function (person, people) {
    this.children.empty();
    for (var i=0; i<person.families.length; i++) {
      for (var c=0; c<person.families[i].children.length; c++) {
        var child = person.families[i].children[c];
        if (!people[child]) continue;
        $(TPL['tpl-child']({
          'name': people[child].names[0],
          'date': people[child].first_date
        })).appendTo(this.children);
      }
    }
  }
});

var mmarker;
var Map = Backbone.View.extend({

  initialize: function () {
    var mapOptions = {
      zoom: 3,
      center: new google.maps.LatLng(43, -45),
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      maxZoom: 8,
      overviewMapControl: false,
      panControl: false,
      rotateControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      scaleControl: false
    }
    get_templates();
    this.parent = this.options.parent;
    this.map = new google.maps.Map(this.el, mapOptions);
    this.oms = new OverlappingMarkerSpiderfier(this.map, {
      keepSpiderfied: true,
    });
    this.info = new MapInfo();
    this.markers = [];
    this.selected_marker = null;
    this.lines = [];
    this.mhash = {}
    var that = this;
    $('#play-it').click(_.bind(this.play, this));
    $('#controls button.lines').click(function () {
      if ($(this).hasClass('active')) {
        for (var i=0;i<that.lines.length; i++) {
          that.lines[i].setVisible(false);
        }
      } else {
        for (var i=0;i<that.lines.length; i++) {
          that.lines[i].setVisible(true);
        }
      }
    });
    this.slider = $('#time-slider > .slider').slider({
      step: 1,
      slide: _.bind(function (event, ui) {
        this.set_year(ui.value);
      }, this),
      start: _.bind(function (event, ui) {
        if (this.play_interval) {
          $('#play-it').text('Play');
          clearInterval(this.play_interval);
          this.play_interval = false;
        }
      }, this)
    });
  },

  load: function (data) {
    var that = this;
    $('#time-slider > .slider').slider('option', 'min', this.parent.mmdate[0].getFullYear());
    $('#time-slider > .slider').slider('option', 'max', this.parent.mmdate[1].getFullYear());
    $('#time-slider > .slider').slider('option', 'value', this.parent.mmdate[0].getFullYear());
    this.at = new Date(this.parent.mmdate[0]);
    $('#control-bar span.year').text(this.at.getFullYear());

    var info = new InfoBox({
      boxStyle: {
        border: '1 px solid white',
        backgroundColor: 'black',
        color: 'white',
        fontSize: '8pt',
        textAlign: 'center',
        padding: '5px',
        borderRadius: '5px',
        closeBoxURL: '',
        pixelOffset: new google.maps.Size(50, 50)
      },
      disableAutoPan: true,
    });
    _.forOwn(data, function (person, id) {
      if (!person.events.length) return;
      var fe = person.events[0];
      var le = person.events.slice(-1)[0];
      if (!fe || !le) return;
      var first = ev2date(fe);
      var last = ev2date(le);
      if (!first || !last) return;
      // date = ev.date_num || get_date(person);
      var eventsandplaces = [];
      for (var i=0; i<person.events.length; i++) {
        eventsandplaces.push([ev2date(person.events[i]), ev2place(person.events[i])]);
      }
      var marker = that.make_marker(id, ev2place(fe), ev2place(le), first, last, eventsandplaces);
      mmarker = marker;
      google.maps.event.addListener(marker, 'mouseover', function () {
        info.setPosition(marker.getPosition());
        info.setContent(person.names[0]);
        info.open(that.map);
      });
      google.maps.event.addListener(marker, 'mouseout', function () {
        info.close();
      });
    });
    that.oms.addListener('click', function (marker) {
      that.info.load(marker.id, marker.person, that.parent.db.people);
      if (that.selected_marker) {
        that.selected_marker.icon.strokeWeight = 2;
        that.selected_marker.setIcon(that.selected_marker.icon);
      }
      that.selected_marker = marker;
      marker.icon.strokeWeight = 5;
      marker.setIcon(marker.icon);
    });
    for (var i=0; i<this.markers.length; i++) {
      var person = this.parent.db.people[this.markers[i].pid];
      for (var c=0; c<person.families.length; c++) {
        for (var b=0; b<person.families[c].children.length; b++) {
          var child = person.families[c].children[b];
          if (!this.mhash[child]) continue;
          var line = new google.maps.Polyline({
            path:[this.markers[i].getPosition(),
                  this.mhash[child].getPosition()],
            strokeColor: 'black',
            strokeOpacity: 0.3,
            strokeWeight: 2,
            map: this.map,
            visible: false
          });
          this.lines.push(line);
        }
      }
    }
  },

  make_marker: function (pid, where1, where2, first, last, events) {
    var dobj = new Date(first.getTime() + (last.getTime() - first.getTime())/2);
    var perc = (dobj - this.parent.mmdate[0])/(this.parent.mmdate[1] - this.parent.mmdate[0]);
    var person = this.parent.db['people'][pid];
    var marker = new google.maps.Marker({
      map: this.map, position: where1,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: hsl2hex(perc*.5, 1, .5),
        fillOpacity: 1,
        scale: 5,
        strokeWeight: 2,
      },
      flat: true,
    });
    this.oms.addMarker(marker);
    marker.id = pid;
    marker.person = person;
    marker.start = first;
    marker.events = events;
    marker.cevent = 0;
    marker.end = last;
    marker.pid = pid;
    this.markers.push(marker);
    this.mhash[pid] = marker;
    return marker;
  },

  play: function () {
    if (this.play_interval) {
      clearInterval(this.play_interval);
      this.play_interval = false;
      $('#play-it').text('Play');
      return;
    }
    $('#play-it').text('Pause');
    if (!this.at)
      this.at = new Date(this.parent.mmdate[0]);
    this.update_showing();
    this.play_interval = setInterval(_.bind(this.inc_play, this), 200);
  },

  inc_play: function () {
    var incby = 1;
    this.at.setFullYear(this.at.getFullYear() + incby);
    $('#time-slider > .slider').slider('option', 'value', this.at.getFullYear());
    this.update_showing();
    if (this.at > this.parent.mmdate[1]) {
      clearInterval(this.play_interval);
      this.play_interval = false;
      this.at = new Date(this.parent.mmdate[0]);
      this.show_all();
    }
  },

  set_year: function (year) {
    this.at.setFullYear(year);
    $('#control-bar .title').text(year);
    this.update_showing();
  },

  update_showing: function () {
    $('#control-bar span.year').text(this.at.getFullYear());
    var m;
    for (var i=0; i<this.markers.length; i++) {
      if (this.markers[i].start < this.at && this.markers[i].end > this.at) {
        m = this.markers[i];
        m.setVisible(true);
        var nc = m.cevent;
        for (var e=1; e<m.events.length; e++) {
          if (this.at >= m.events[e-1][0] && this.at < m.events[e][0]) {
            nc = e - 1;
            break;
          }
        }
        if (nc !== m.cevent) {
          var fromto = [m.getPosition(), m.events[nc][1]];
          var line = new google.maps.Polyline({
            path: fromto,
            strokeColor: 'blue',
            strokeOpacity: 0.3,
            strokeWeight: 4,
            map: this.map
          });
          (function (line) {
          setTimeout(function () {line.setVisible(false);}, 500);
          }(line));
          m.setPosition(m.events[nc][1]);
          m.cevent = nc;
        }
      } else {
        this.markers[i].setVisible(false);
      }
    }
  },

  show_all: function () {
    for (var i=0; i<this.markers.length; i++) {
      this.markers[i].setVisible(true);
    }
  }

});

function get_event(person) {
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
}

function get_date(person) {
  for (var i=0; i<person.events.length; i++) {
    if (person.events[i].date_num) {
      return person.events[i].date_num;
    }
  }
}

function loc_to_ll(location) {
  return new google.maps.LatLng(location.lat, location.lng);
}

function txt2date(txt) {
  return new Date(txt.replace(/-/g, ' '));
}

function ev2date(ev) {
  var d = ev.date_num || ev.date_fallback;
  return d ? txt2date(d) : null;
}

function ev2place(ev) {
  var p = ev.place_fallback || ev.place_geo;
  return p ? loc_to_ll(p.geometry.location) : null;
}

var main;
$(function () {
  main = new MainApp();
});



var TPL = template_loader.templates;

var MapInfo = Backbone.View.extend({
  el: '#person-preview',
  initialize: function () {
    this.name = this.$('.name');
    this.current_person = false;
    this.the_events = this.$('.events tbody');
    this.children = this.$('.marriages .body');
    this.parents = this.$('.parents tbody');
    this.$('.single-line').click(_.bind(function () {
      if (!this.current_person || this.$('.single-line').hasClass('disabled')) return;
      this.options.app.add_single_line(this.current_person, true);
    }, this));
    this.$('.icon-resize-full').click(_.bind(function () {
      if (!this.current_person) return;
      this.options.app.switch_to('list');
      this.options.app.person_detail.show(this.current_person);
    }, this));
    this.db = this.options.db;
  },

  /* load for a particular person
   * - id : the PID
   * - person: the Person object
   */
  load: function (id, person, from_self) {
    if (from_self && this.options.onload) {
      this.options.onload(id);
    }
    this.options.parent.show_marker(id);
    this.current_person = person;
    if (!person.data.link) {
      this.$('.single-line').addClass('disabled');
    } else {
      this.$('.single-line').removeClass('disabled');
    }

    var header = this.$('> .header');
    header.find('> .name').text(person.name);
    header.find('> .id').text(id);
    header.find('> .generation > a').text(person.gen + ' gen');
    var trail = person.get_breadcrumb(this.db);
    var crumb = header.find('> .generation > ul');
    crumb.empty();
    for (var i=0; i<trail.length; i++) {
      $('<li><a>' + this.db[trail[i]].name_id() + '</a></li>').appendTo(crumb)
        .click(_.bind(this.load, this, trail[i], this.db[trail[i]], true));
    }
    this.load_events(person.data);
    this.load_children(person.id, person.data);
    this.load_parents(person);
  },

  /** load the events **/
  load_events: function (person) {
    this.the_events.empty();
    for (var i=0; i<person.events.length; i++) {
      $(TPL['detail-event']({
        'type': person.events[i].type,
        'place': person.events[i].place || 'unknown',
        'date': person.events[i].date || 'unknown'
      })).appendTo(this.the_events);
    }
  },

  /** load the "families" part **/
  load_children: function (id, person) {
    this.children.empty();
    for (var i=0; i<person.families.length; i++) {
      var parents = person.families[i].parents;
      var spouse_id = parents[id == parents.father? 'mother': 'father'];
      var marriage = person.families[i].marriage;
      var spouse = this.db[spouse_id];
      if (!spouse) {
        spouse = {'name': '&lt;not loaded&gt;',
          'years': ''};
      }
      var fam = $(TPL['family-listing']({
        spouse_id: spouse_id,
        spouse_name: spouse.name,
        spouse_years: spouse.years,
        marriage_date: (marriage ? marriage.date : false) || '&lt;date unknown&gt;',
        marriage_place: (marriage? marriage.place : false) || '&lt;place unknown&gt;'
      })).appendTo(this.children);
      // can't check `spouse` because it may be overridden
      if (this.db[spouse_id]) {
        fam.find('div.spouse').click(_.bind(this.load, this, spouse_id, spouse, true));
      }
      var children = fam.find('tbody');
      for (var c=0; c<person.families[i].children.length; c++) {
        var child = person.families[i].children[c];
        if (!this.db[child]) continue;
        $(TPL['child-listing']({
          'name': this.db[child].data.names[0],
          'date': this.db[child].data.first_date,
          'id': child
        })).appendTo(children)
          .click(_.bind(this.load, this, child, this.db[child], true));
      }
    }
  },

  /** load the parents **/
  load_parents: function (person) {
    this.parents.empty();
    var parents = person.data.parents;
    var node, parent;
    for (var i=0; i<parents.length; i++) {
      parent = this.db[parents[i][0]];
      node = $(TPL['parent-listing']({
        'id': parents[i][0],
        'name': parent?parent.name:'&lt;not loaded&gt;',
        'years': parent?parent.years:''
      })).appendTo(this.parents);
      if (parent)
         node.click(_.bind(this.load, this, parents[i][0], this.db[parents[i][0]], true));
    }
    if (parents.length === 0) {
      $(TPL['no-parents']()).appendTo(this.parents);
    }
  },

});

var MapView = Backbone.View.extend({
  name: 'map',
  el: '#map-view',
  buttons: false,
  default_center: [43, -45],

  info_box_options: {
    boxStyle: {
      border: '1 px solid white',
      backgroundColor: 'black',
      color: 'white',
      fontSize: '8pt',
      textAlign: 'center',
      padding: '5px',
      'min-width': '50px',
      width: 'auto',
      'white-space': 'nowrap',
      borderRadius: '5px',
      closeBoxURL: '',
      pixelOffset: [50, 50]
    },
    disableAutoPan: true,
    content: 'People'
  },

  initialize: function (options) {
    this.parent = options.parent;
    this.rendered = false;
    this.first_show = true;
    this.pedigree = new MapPedigree({parent: this});
    this.info = new MapInfo({parent: this, db: this.parent.db, onload: _.bind(this.pedigree.show, this.pedigree), app:this.parent});
    this.single_line = false;
  },

  /** show this view - recenter the map if this is the first time **/
  show: function () {
    this.$el.show();
    $('#right-pane').addClass('map');
    google.maps.event.trigger(this.map, 'resize');
    if (this.first_show) {
      var x = this.default_center[0],
          y = this.default_center[1];
      this.map.setCenter(new google.maps.LatLng(x, y));
      this.first_show = false;
    }
    if (this.parent.loading) {
      // we're still fetching people, so relaod
      this.set_items(this.parent.lists[this.parent.current_list]);
    }
  },

  hide: function () {
    $('#right-pane').removeClass('map');
    this.$el.hide();
  },

  render: function () {
    this.rendered = true;
    // page switcher
    this.$('.page-switcher button.list')
      .click(_.bind(this.parent.switch_to, this.parent, 'list'));
    var x = this.default_center[0],
        y = this.default_center[1];
    var mapOptions = {
      zoom: 3,
      center: new google.maps.LatLng(x, y),
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      maxZoom: 8,
      overviewMapControl: false,
      panControl: false,
      rotateControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      scaleControl: false
    }
    this.parent = this.options.parent;
    this.map = new google.maps.Map(this.$('.map-container')[0], mapOptions);
    this.oms = new OverlappingMarkerSpiderfier(this.map, {
      keepSpiderfied: true,
    });
    this.info_box = this.create_infobox();
    this.info_box.open(this.map);
    this.info_box.setVisible(false);

    var that = this;
    this.oms.addListener('click', function (marker) {
      that.info.load(marker.id, marker.person);
      that.set_selected(marker);
    });
    this.markers = [];
    this.selected_marker = null;
    this.lines = [];
    this.mhash = {}
    this.create_controls();
  },

  /** create the slider controls **/
  create_controls: function () {
    
    this.$('button.play-button').click(_.bind(this.play, this));
    
    this.slider_el = this.$('#timeline .slider');
    this.slider = this.slider_el.slider({
      step: 1,
      slide: _.bind(function (event, ui) {
        this.set_year(ui.value);
      }, this),
      start: _.bind(function (event, ui) {
        this.oms.unspiderfy();
        if (this.play_interval) {
          this.$('button.play-button i')
            .removeClass('icon-pause').addClass('icon-play');
          clearInterval(this.play_interval);
          this.play_interval = false;
        }
      }, this)
    });
    this.slider_el.find('a.ui-slider-handle').append('<span>all</span>');
  },

  /**
   * Update the slider, meaning the Widget + year tick marks, to reflect
   * a new first and last year
   */
  load_slider: function (first, last) {
    var num = 10;
    var ival = Math.ceil((last-first)/num/10)*10;
    
    // load the years
    var slnode = this.$('.slider');
    slnode.find('div.year-label').remove();
    var year;
    var TPL = template_loader.templates['slider-year'];
    $(TPL({year: first, left: 0})).appendTo(slnode);
    $(TPL({year: last, left: 100})).appendTo(slnode);
    for (var i=1; i < num - 1; i++) {
      year = first + i * ival;
      $(TPL({year: year, left: i*ival/(last - first)*100})).appendTo(slnode)
    }
      
    this.slider_el.slider('option', 'min', first);
    this.slider_el.slider('option', 'max', last);
    this.slider_el.slider('option', 'value', first);
    this.at = new Date(first,0,1,0,0);
    // this.$('div.control-bar span.year').text(this.at.getFullYear());
  },
 
  /** create the InfoBox **/
  create_infobox: function () {
    var xy = this.info_box_options.boxStyle.pixelOffset;
    this.info_box_options.boxStyle.pixelOffset = new google.maps.Size(xy[0], xy[1]);
    var info = new InfoBox(this.info_box_options);
    return info;
  },

  add_person_marker: function (info, pobj, id) {
    var person = pobj.data;
    if (!person.events.length) return;
    var fe = person.events[0];
    var le = person.events.slice(-1)[0];
    if (!fe || !le) return;
    var first = utils.ev2date(fe);
    var last = utils.ev2date(le);
    if (!first || !last) return;
    var first_year = first.getFullYear();
    var last_year = last.getFullYear();
    if (!first || !last) return;
    // date = ev.date_num || utils.get_date(person);
    var eventsandplaces = [];
    pobj.first = first;
    pobj.last = last;
    this.all_people.push(pobj);
    for (var i=0; i<person.events.length; i++) {
      eventsandplaces.push([utils.ev2date(person.events[i]), utils.ev2place(person.events[i])]);
    }
    var that = this;
    var marker = this.make_marker(id, utils.ev2place(fe), utils.ev2place(le), first, last, eventsandplaces);
    google.maps.event.addListener(marker, 'mouseover', function () {
      info.setPosition(marker.getPosition());
      info.setContent(TPL['map-marker-info']({
        name: pobj.name,
        years: pobj.years,
        gen: pobj.gen,
        place: person.events[marker.cevent].place
      }));
      if (that.info_waiting) {
        clearTimeout(that.info_waiting);
      }
      info.setVisible(true);
    });
    google.maps.event.addListener(marker, 'mouseout', function () {
      info.setVisible(false);
    });
  },

  /** load some new list of items **/
  set_items: function (list) {
    var that = this;
    this.current_list = list;
    var data = list.people;
    this.single_line = false;
    this.bounds = list.bounds;
    this.info.load(list.id, list.people[list.id]);
    var time_span = this.bounds[1].getFullYear() - this.bounds[0].getFullYear();
    var first = Math.floor(this.bounds[0].getFullYear()/10)*10;
    var last = Math.ceil(this.bounds[1].getFullYear()/10)*10;
    this.normal_bounds = [first, last];

    this.load_slider(first, last);

    for (var i=0; i<this.markers.length; i++) {
      this.markers[i].setMap(null);
    }
    this.markers = [];
    // add all of the markers
    this.all_people = [];
    _.forOwn(data, _.bind(this.add_person_marker, this, this.info_box));
    this.pedigree.load(this.all_people, this.normal_bounds);
  },

  show_marker: function (pid) {
    for (var i=0; i<this.markers.length; i++) {
      if (this.markers[i].id == pid) {
        this.set_selected(this.markers[i], true);
        break;
      }
    }
  },

  show_person: function (pid, person) {
    this.info.load(pid, person, true);
  },

  set_selected: function (marker, show_info) {
    if (this.selected_marker) {
      this.selected_marker.icon.strokeWeight = 2;
      this.selected_marker.setIcon(this.selected_marker.icon);
    }
    this.oms.unspiderfy();
    this.selected_marker = marker;
    marker.icon.strokeWeight = 5;
    marker.setIcon(marker.icon);
    if (show_info) {
      var person = marker.person;
      this.info_box.setPosition(marker.getPosition());
      this.info_box.setContent(TPL['map-marker-info']({
        name: person.name,
        years: person.years,
        gen: person.gen,
        place: person.data.events[marker.cevent].place
      }));
      this.info_box.setVisible(true);
      if (this.info_waiting) {
        clearTimeout(this.info_waiting);
      }
      this.info_waiting = setTimeout(_.bind(function () {
        this.info_box.setVisible(false);
      }, this), 1000);
    }
  },

  make_marker: function (pid, where1, where2, first, last, events) {
    var dobj = new Date(first.getTime() + (last.getTime() - first.getTime())/2);
    var perc = (dobj - this.bounds[0])/(this.bounds[1] - this.bounds[0]);
    var person = this.parent.db[pid];
    var marker = new google.maps.Marker({
      map: this.map, position: where1,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: hsl2hex(perc * .5, 1, .5),
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

  /**
  start_single_line: function (person, line) {
    this.single_line = line;
    this.$('#single-line-ind .name').text(person.name + ' ' + person.years);
    this.$('#single-line-ind').show();
  },

  stop_single_line: function () {
    this.single_line = false;
    this.set_items(this.current_list);
  },
  **/

  play: function () {
    if (this.play_interval) {
      clearInterval(this.play_interval);
      this.play_interval = false;
      this.$('button.play-button i')
        .removeClass('icon-pause').addClass('icon-play');
      return;
    }
    this.$('button.play-button i')
      .removeClass('icon-play').addClass('icon-pause');
    if (!this.at)
      this.at = new Date(this.normal_bounds[0], 0, 1, 0, 0);
    this.update_showing();
    this.play_interval = setInterval(_.bind(this.inc_play, this), 200);
  },

  inc_play: function () {
    var incby = 1;
    this.at.setFullYear(this.at.getFullYear() + incby);
    this.slider_el.slider('option', 'value', this.at.getFullYear());
    this.update_showing();
    if (this.at.getFullYear() >= this.normal_bounds[1]) {
      clearInterval(this.play_interval);
      this.$('button.play-button i')
        .addClass('icon-play').removeClass('icon-pause');
      this.play_interval = false;
      this.at = new Date(this.normal_bounds[0], 0, 1, 0, 0);
      this.slider_el.slider('option', 'value', this.normal_bounds[0]);
      this.$('#timeline .slider > a.ui-slider-handle span').text('all');
      this.show_all();
    }
  },

  set_year: function (year) {
    this.at.setFullYear(year);
    this.update_showing();
  },

  update_showing: function () {
    var m;
    var all = this.at.getFullYear() == this.normal_bounds[0];
    var text = all ? 'all' : this.at.getFullYear();
    this.$('#timeline .slider > a.ui-slider-handle span').text(text);
    for (var i=0; i<this.markers.length; i++) {
      if (all) {
        this.markers[i].setVisible(true);
        continue;
      }
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



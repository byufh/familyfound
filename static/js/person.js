/** Keeping track of a single person **/

/**
 * This class manages the "person" data structure.
 */
var Person = New({
  constructor: function (id, gen, data) {
    this.id = id;
    this.gen = gen;
    this.data = data;
    this.process_data();
  },

  /** return "{name} {id}" for display **/
  name_id: function () {
    return this.name + ' ' + this.id;
  },

  /** return a list of "links" down to the base person, one for each
   * separating generation **/
  get_breadcrumb: function (db) {
    if (!this.data.link) return [];
    var crumb = [this.data.link];
    var down = db[this.data.link];
    if (down) {
      crumb = crumb.concat(down.get_breadcrumb(db));
    }
    return crumb;
  },

  /** override the internal data with some new and process it **/
  refresh: function (new_data) {
    this.data = new_data;
    this.process_data();
  },

  /** get the familysearch/tree url **/
  url: function (type) {
    if (type == 'familysearch/tree') {
      return 'https://familysearch.org/tree/#view=ancestor&person=' + this.id;
    } else {
      return 'http://example.com';
    }
  },

  /** get data for populating the research urls. Takes one arg "db" for
   * filling in names of relatives **/
  url_data: function (db) {
    var data = {};
    if (this.name && this.name !== 'Unknown') {
      var nparts = this.name.split(' ');
      if (nparts.length > 1) {
        data['given_names'] = nparts.slice(0, -1).join(' ');
      }
      data['last_name'] = nparts.slice(-1)[0];
    }
    var events_dict = make_events_dict(this.data.events);
    // get birth and death events!
    var ev;
    var get_country = function (geo) {
      var add = geo.address_components;
      for (var i=0; i<add.length; i++) {
        if (add[i].types[0] === 'country') {
          return add[i].long_name;
        }
      }
    };
    var update_events = function (data, events_dict, type, dest, override) {
      if (events_dict[type]) {
        if (data[dest + '_year'] && data[dest + '_place'] && data[dest + '_country']) {
          return;
        }
        for (var i=0; i<events_dict[type].length; i++) {
          ev = events_dict[type][i];
          if (ev.date_num && (override || !data[dest + '_year'])) {
            data[dest + '_year'] = utils.txt2date(ev.date_num).getFullYear();
          }
          if (ev.place && (override || !data[dest + '_place'])) {
            data[dest + '_place'] = ev.place;
          }
          if (ev.place_geo && (override || !data[dest + '_country'])) {
            data[dest + '_country'] = get_country(ev.place_geo);
          }
        }
      }
    };
    update_events(data, events_dict, 'Birth', 'birth', true);
    update_events(data, events_dict, 'Christening', 'birth', false);
    update_events(data, events_dict, 'Death', 'death', true);
    update_events(data, events_dict, 'Burial', 'death', false);
    update_events(data, events_dict, 'Marriage', 'marriage', true);
    // get spouses
    var spouse_id;
    for (var i=0; i<this.data.families.length; i++) {
      spouse_id = get_spouse(this.id, this.data.families[i]);
      if (spouse_id && db[spouse_id]) {
        if (db[spouse_id].name !== 'Unknown') {
          sparts = db[spouse_id].name.split(' ');
          if (sparts.length > 1) {
            data.spouse_given_names = sparts.slice(0, -1).join(' ');
          }
          data.spouse_last_name = sparts.slice(-1)[0];
        }
      }
    }
    return data;
  },

  /** post-process the data from the server. Most of this should probably be
   * moved to the backend **/
  process_data: function () {
    var birth = '??';
    var death = '??';
    var e = this.data.events;
    for (var i=0; i<e.length; i++) {
      if (e[i].type === 'Birth') {
        d = utils.ev2date(e[i]);
        if (d) {
          birth = d.getFullYear();
        }
      } else if (e[i].type === 'Death') {
        d = utils.ev2date(e[i]);
        if (d) {
          death = d.getFullYear();
        }
      }
    }
    this.birth_year = birth;
    this.death_year = death;
    if (death !== '??' && birth !== '??') {
      this.lifespan = death - birth;
    } else {
      this.lifespan = false;
    }
    this.years = birth + ' - ' + death;
    this.name = 'Unknown';
    for (var i=0; i<this.data.names.length; i++) {
      if (this.data.names[i].replace(/\s/, '').length) {
        this.name = this.data.names[i].replace(/^s+/, '').replace(/\s+$/, '');
      }
    }
    this.last_name = this.name.split(' ').slice(-1)[0];
  },

  /** get data for the template **/
  tpl_data: function () {
    return {
      gen: this.gen,
      width: 5 + (this.gen - 1)*10,
      name: this.name,
      pid: this.id,
      born: this.birth_year,
      died: this.death_year,
      people_alerts: this.data.people_alerts.length,
      info_alerts: this.data.info_alerts.length
    }
  }
});


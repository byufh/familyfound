
/**

jqueryget

**/

function show_error(title, body) {
  $('#error-modal .title').html(title);
  $('#error-modal .body').html(body);
  $('#error-modal').modal('show');
}
  
var geocoder, map;
var res;
var FamilyFound = Application.extend({

  initialize: function () {
    this.db = {};
    utils.get_templates();
    this.map_view = new MapView({parent: this});
    this.map_view.render();
    this.people_view = new PeopleView({app: this, items: []});
    this.people_view.render();
    this.person_detail = new PersonDetail({app: this});
    this.page = 'list';
    this.pages = {};
    this.pages['list'] = this.people_view;
    this.pages['map'] = this.map_view;
    this.lists = {};
    this.current_list = null;
    var that = this;
    $('#groups-listing > div').live('click', function () {
      var node = $(this);
      if (node.hasClass('active') || node.hasClass('loading')) return;
      node.siblings('.active').removeClass('active');
      that.show_list(node.data('id'));
      node.addClass('active');
    });
    $('#groups-listing > div i.icon-refresh').live('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (that.loading) return;
      var node = $(this).parent();
      that.refresh_list(node.data('id'), node);
    });
    // initialize all tooltips
    $('.tipme').tooltip();
    if (sessionStorage) {
      this.store = true;
    } else {
      this.store = false;
    }
  },

  switch_to: function (what) {
    if (what === this.page) return;
    this.person_detail.hide();
    this.pages[this.page].hide();
    this.pages[what].show();
    this.page = what;
  },

  start: function () {
    this.login();
  },

  login: function () {
    var that = this;
    jQuery.ajax(URLS['check-login'], {
      dataType: 'json',
      error: function () {
        show_error('Unable to connect to the server',
                   'There was an error communicating with the server. Check your internet connection');
      },
      success: _.bind(function (data, txt, xhr) {
        if (data.error) {
          return show_error('Server error', 'The server encountered an error. Try reloading the page')
        }
        if (data.authorized) {
          return this.logged_in(data.user);
        } else {
          $('#login-modal iframe')[0].src = data.url
          $('#login-modal').modal({backdrop: 'static', keyboard: false});
        }
      }, this)
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
    this.add_list(info.id, 'Ancestors of ' + info.name, 0, true);
    this.get_ancestors(info.id, 0, true);
  },

  add_single_line: function (person, active) {
    if (this.lists[person.id + '-single']) {
      this.show_list(person.id + '-single');
      return;
    }
    var id = person.id;
    var gen = person.gen;
    var name = person.name;
    this.add_list(id + '-single', name + ' single line', gen, active);
    this.lists[id + '-single'].id = id;
    /**
    var node = $(template_loader.templates['tpl-list']({
      id: id + '-single', name: name
    }));
    this.lists[id + '-single'] = {'id': id, 'people': {},
                      'gen': gen, 'name': name,
                      'el': node, 'bounds': [null, null]};
    if (active) {
      $('#groups-listing .active').removeClass('active');
      node.addClass('active');
    }
    $('#groups-listing').append(node);
    **/
    if (active) {
      this.current_list = id + '-single';
    }
    var person = this.db[id];
    var line = [id].concat(person.get_breadcrumb(this.db));
    var lperson, child_id, spouse_id;
    for (var i=0; i<line.length; i++) {
      lperson = this.db[line[i]];
      for (var f=0; f<lperson.data.families.length; f++) {
        spouse_id = lperson.data.families[f].parents[lperson.data.families[f].parents.father === lperson.id? 'mother' : 'father'];
        if (this.db[spouse_id]) {
          this.add_person({gen: lperson.gen, pid: spouse_id,
                           person: this.db[spouse_id].data}, gen, id + '-single');
        }
        /**
        for (var c=0; c<lperson.data.families[f].children.length; c++) {
          child_id = lperson.data.families[f].children[c];
          if (this.db[child_id]) {
            this.add_person({gen: lperson.gen + 1, pid: child_id,
                            person: this.db[child_id].data}, gen, id + '-single');
          }
        }
        **/
      }
      this.add_person({gen:lperson.gen, pid:line[i], person:lperson.data}, gen, id + '-single');
    }
    this.done_loading_list(id + '-single');
    this.show_list(id + '-single');
  },

  add_list: function (id, name, gen, active) {
    var node = $(template_loader.templates['tpl-list']({
      id: id, name: name
    }));
    // var node = $('<div class="loading" data-id="' + id + '">' + name + '</div>');
    this.lists[id] = {'id': id, 'people': {},
                      'gen': gen, 'name': name,
                      'el': node, 'bounds': [null, null]};
    if (active) {
      $('#groups-listing .active').removeClass('active');
      node.addClass('active');
    }
    $('#groups-listing').append(node);
  },

  show_list: function (id) {
    this.person_detail.hide();
    this.current_list = id;
    this.people_view.set_items(this.lists[id].people);
    // update map accordingly
    this.map_view.set_items(this.lists[id]);
  },

  refresh_list: function (id, node) {
    node.addClass('loading');
    if (id == this.current_list) {
      this.people_view.list.empty();
    }
    this.lists[id].people = {};
    this.get_ancestors(id, this.lists[id].gen, true, true);
  },

  done_loading_list: function (id) {
    this.lists[id].el.removeClass('loading');
    if (id == this.current_list) {
      this.map_view.set_items(this.lists[id]);
    }
  },

  reload_person: function (person_id, ondone) {
    var that = this;
    $.ajax(URLS['reload-person'] + person_id, {
      success: function (data) {
        that.db[person_id].refresh(data.person);
        ondone(that.db[person_id]);
      },
      dataType: 'json'
    });
  },

  get_ancestors: function (base_id, base_gen, switch_to, no_cache) {
    // get 9 gens of ancestors from a base id [ gens are then generated
    // relative to the current user, not to the base id ]
    var that = this;
    this.start_loading('Loading generation 1');
    if (switch_to) {
      this.current_list = base_id;
    }
    if (!no_cache && this.store && sessionStorage[base_id + '-ancestors']) {
      try {
        var result = this.get_ancestors_local(base_id, base_gen);
      } catch (e) {
        console.log('Error loading from session:' + e);
        delete sessionStorage[base_id + '-ancestors'];
      }
      if (result) {
        return;
      }
    }
    var url = URLS[no_cache? 'reload-pedigree' : 'get-pedigree'];
    var gen = 0;
    var num_loaded = 0;
    window.commet(url + base_id, {
      json: true,
      loading: function (data) {
        num_loaded += 1;
        if (data['person']) {
          if (that.store) {
            sessionStorage[data.pid] = JSON.stringify({data: data.person, date: new Date()});
          }
          that.add_person(data, base_gen, base_id, no_cache);
          $('#loading-top').text('Loading ' + gen + ' of 9 generations (' + num_loaded + ')');
        } else {
          $('#loading-top').text('Loading ' + (data.gen + 1) + ' of 9 generations');
          gen = data.gen + 1;
        }
      },
      done: function () {
        that.stop_loading();
        that.done_loading_list(base_id);
        if (that.store) {
          sessionStorage[base_id + '-ancestors'] = new Date();
        }
      },
      error: function (error, data) {
        that.show_error(error, data);
        that.stop_loading();
        that.done_loading_list(base_id);
      }
    });
  },

  get_ancestors_local: function (base_id, base_gen) {
    var gen = [base_id], next_gen;
    var load = function (pid) {
      if (typeof(sessionStorage[pid]) === 'undefined') {
        return false;
      }
      try {
        return JSON.parse(sessionStorage[pid]).data;
      } catch (e) {
        console.log('couldnt parse: ' + sessionStorage[pid]);
        return false;
      }
    };
    // this.db[base_id] = load(base_id);
    var gotten = [];
    for (var i=1; i<11; i++) {
      next_gen = [];
      for (var j=0; j<gen.length; j++) {
        person = load(gen[j]);
        if (!person) {
          // couldnt load the whole pedigree, abort!
          return false;
        }
        this.add_person({gen: i, person: person, pid: gen[j]}, base_gen, base_id);
        for (var p=0; p<person.parents.length; p++) {
          next_gen.push(person.parents[p][0]);
        }
      }
      gen = next_gen;
    }
    this.stop_loading();
    this.done_loading_list(base_id);
    return true;
  },

  add_person: function (data, base_gen, base_id, no_cache) {
    var person = this.db[data.pid];
    if (!person || no_cache) {
      person = new Person(data.pid, data.gen + base_gen, data.person);
      this.db[data.pid] = person;
    }
    if (!this.lists[base_id].people[data.pid]) {
      // getting min and max
      var ev = utils.get_event(person.data);
      var date = ev ? ev.date_num : null;
      date = date? date : utils.get_date(person.data);
      if (date) {
        var dobj = new Date(date.replace(/-/g, ' '));
        var bounds = this.lists[base_id].bounds;
        if (bounds[0] === null || dobj < bounds[0])
            bounds[0] = dobj;
        if (bounds[1] === null || dobj > bounds[1])
            bounds[1] = dobj;
      }
      // add the the list
      this.lists[base_id].people[data.pid] = person;
      if (this.current_list == base_id) {
        this.people_view.add_item(person);
      }
    }
  },

  show_error: function (error, data) {
    console.log("issue: " + error + " ( " + data + ")");
  },

  start_loading: function (text) {
    $('#loading-top').text(text).show();
    $('#loading-ind').show();
    this.loading = true;
  },

  stop_loading: function () {
    $('#loading-ind').hide();
    this.loading = false;
    var that = this;
    $('#loading-top').text('Finished Loading');
    setTimeout(function () {
      if (!that.loading) {
        $('#loading-top').fadeOut();
      }
    }, 1500);
  },

  render_user_data: function() {
    $('#user-name').text(this.user_data.name);
    // todo fill in
  },

/*
  load: function (data) {
    this.db['people'] = data.people;
    this.generations = data.generations;
    var min = null, max = null;
    _.forOwn(data.people, function (person, id) {
      var ev = utils.get_event(person);
      var date = ev ? ev.date_num : null;
      date = date? date : utils.get_date(person);
      if (!date) return;
      var dobj = new Date(date.replace(/-/g, ' '));
      if (min === null || dobj < min) min = dobj;
      if (max === null || dobj > max) max = dobj;
    });
    this.mmdate = [min, max];
    this.pages['map'].load(data);
    this.nav('map');
  }
  */

});



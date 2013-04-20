
/** Here we define the "search links" **/
/** format:
 *
 *  {
 *      name: str
 *      link: the href, must end in ? or & (ready for args to be appended)
 *      args: [
 *        // one of three options:
 *          [argname, argval, ...]
 *              argval must match a key in the url_data
 *              dictionary of the person object. If the first argval is not
 *              present, the second will be tried, etc.
 *          [argname, 1]
 *              means argval is the same as argname
 *          [argname, function, argval, ...]
 *              function takes data arguments and returns a *folly escaped*
 *              string. The arguments are passed in by looking up the value of
 *              argval in the url_data dictionary. If the function returns
 *              something falsey (null, '', false), the arg will not be added
 *      ]
 *  }
 */
var SEARCH_LINKS = [
  /*{
    'name': 'FamilySearch',
    'link': 'http://familysearch.org/search?',
    'args': {
      'name': 1,
      'born': 'birth_year',
      'bornat': 'birth_place',
    }
  },*/
  {
    'name': 'BillionGraves.com',
    'link': 'http://billiongraves.com/pages/search/#year_range=10&action=search&exact=false&',
    'args': [
      ['given_names', 1],
      ['family_names', 'last_name'],
      ['birth_year', 1],
      ['death_year', 1],
      ['country', 'death_country', 'birth_country'],
    ]
  },
  {
    'name': 'Ancestry.com',
    'link': 'http://search.ancestry.com/cgi-bin/sse.dll?rank=1&',
    'args': [
      ['gsfn', 'given_names'],
      ['gsln', 'last_name'],
      ['msbpn__ftp', 'birth_place'],
      ['msbdy', 'birth_year'],
      ['msddy', 'death_year'],
      ['msdpn__ftp', 'death_place'],
      ['msgdy', 'marriage_year'],
      ['msgpn__ftp', 'marriage_place'],
      ['mssng0', 'spouse_given_names'],
      ['mssns0', 'spouse_last_name'],
    ]
  },
  {
    'name': 'findmypast.com',
    'link': 'http://www.findmypast.com/Search?FirstName_variants=true&Region=All&',
    'args': [
      ['FirstName', 'given_names'],
      ['LastName', 'last_name'],
      ['EventYear', 'birth_year'],
      ['EventYear_offset', 'death_year']
    ]
  },
  {
    'name': 'Fold3',
    'link': 'http://www.fold3.com/s.php?advanced=1#ocr=1&',
    'args': [
      ['s_given_name', 'given_names'],
      ['s_surname', 'last_name'],
      ['s_place', 'birth_place', 'death_place'],
      ['dr_year', function (birth, death) {
        if (!birth || !death) return false;
        return 'm,' + birth + '-' + death;
      }, 'birth_year', 'death_year']
    ]
  }
];

var PersonDetail = Backbone.View.extend({
  el: '#person-detail',
  initialize: function (options) {
    this.app = options.app;
    this.$('.close-btn').click(_.bind(this.hide, this));
    this.$('i.icon-refresh').click(_.bind(this.reload, this));
    this.$('i.icon-map-marker').click(_.bind(this.show_on_map, this));
    this.current = null;
    this.loading = false;
    this.events_list = this.$('.events-listing tbody');
    this.families = this.$('.families-listing .body');
    var that = this;
    this.$('.families-listing .spouse').live('click', function () {
      var node = $(this);
      that.load(that.app.db[node.data('id')]);
    });
    this.$('.families-listing .child').live('click', function () {
      var node = $(this);
      that.load(that.app.db[node.data('id')]);
    });
    this.$('.fetch-links button.ancestors').click(function () {
      var cp = that.current;
      var cg = that.app.db[cp.id].gen;
      if (that.app.lists[cp.id]) {
        return;
      }
      that.app.add_list(cp.id, 'Ancestors of ' + cp.name, cg, false);
      that.app.get_ancestors(cp.id, cg, false, true);
      $(this).addClass('disabled').attr('disabled', true);
    });
  },

  hide: function () {
    $('#people-view').removeClass('view-detail');
  },

  /** accepts person objects [person.js] **/
  show: function (person) {
    $('#people-view').addClass('view-detail');
    this.load(person);
  },

  show_on_map: function () {
    if (this.loading) return;
    this.hide();
    this.app.switch_to('map');
    this.app.map_view.show_person(this.current.id, this.current);
  },

  reload: function () {
    if (this.loading) return;
    this.$el.addClass('loading');
    this.loading = true;
    var that = this;
    this.app.reload_person(this.current.id, function (person) {
      that.loading = false;
      that.$el.removeClass('loading');
      that.load(person);
    });
  },

  load: function (person) {
    /** accepts a person object [person.js] **/
    if (!person) return;
    this.current = person;
    if (this.app.lists[person.id]) {
      this.$('button.ancestors').addClass('disabled').attr('disabled', true);
    } else {
      this.$('button.ancestors').removeClass('disabled').attr('disabled', false);
    }
    this.$('.header .gen').text(this.app.db[person.id].gen);
    this.$('.header .name').text(person.name);
    this.$('.header .id').text(person.id);
    this.$('.header .years').text(person.birth_year + ' - ' + person.death_year);
    this.$('.header .links .icon-edit').attr('href', person.url('familysearch/tree'));
    var evt = template_loader.templates['detail-event'];
    this.events_list.empty();
    if (!person.data.events.length) {
      this.events_list.append('<div>No life events</div>');
    }
    for (var i=0; i<person.data.events.length; i++) {
      this.events_list.append(evt(person.data.events[i]));
    }
    var fm = template_loader.templates['family-listing'];
    var ch = template_loader.templates['child-listing'];
    this.families.empty();
    var family, spouse, child, child_node, fobj;
    if (!person.data.families.length) {
      $('<div>No marriages</div>').appendTo(this.families);
    }
    for (var i=0; i<person.data.families.length; i++) {
      fobj = person.data.families[i];
      spouse = this.app.db[person.id == fobj.parents.father? fobj.parents.mother : fobj.parents.father];
      if (!fobj.marriage && !spouse && !fobj.children.length) {
        continue;
      }
      var data = {
        'marriage_date': fobj.marriage && fobj.marriage.date,
        'marriage_place': fobj.marriage && fobj.marriage.place
      };
      if (spouse) {
        data = _.extend(data, {
          'spouse_name': spouse.name,
          'spouse_id': spouse.id,
          'spouse_years': spouse.years,
        });
      } else {
        data['spouse_name'] = '[no spouse listed]';
      }
      family = $(fm(data));
      if (!fobj.marriage || !fobj.marriage.date) {
        family.addClass('missing-marriage-date');
      }
      if (!fobj.marriage || !fobj.marriage.place) {
        family.addClass('missing-marriage-place');
      }
      if (!spouse) {
        family.addClass('missing-spouse');
      }
      var ftable = family.find('.children tbody');
      for (var c=0; c<fobj.children.length; c++) {
        child = this.app.db[fobj.children[c]];
        if (!child) {
          // TODO: always grab children of people in the main line
          continue;
        }
        child_node = ch(child);
        ftable.append(child_node);
      }
      this.families.append(family);
    }
    this.load_alerts(person);
    this.load_parents(person);
    this.load_links(person);
  },

  /**
   * Get the url_data dictionary from [person.js] and create the buttons for
   * all the research engines defined in SEARCH_LINKS
   */
  load_links: function (person) {
    var body = this.$('.search-links .body');
    body.empty();
    var link, href, fargs;
    var person_data = person.url_data(this.app.db);
    for (var i=0; i<SEARCH_LINKS.length; i++) {
      link = SEARCH_LINKS[i];
      href = link.link;
      parts = [];
      for (var a=0; a<link.args.length; a++) {
        if (link.args[a][1] === 1) {
          link.args[a][1] = link.args[a][0];
        } else if (typeof(link.args[a][1]) === 'function') {
          fargs = [];
          for (var b=2; b<link.args[a].length; b++) {
            fargs.push(person_data[link.args[a][b]]);
          }
          var res = link.args[a][1].apply(null, fargs);
          if (res) {
            parts.push(link.args[a][0] + '=' + res);
          }
          continue;
        }
        for (var ap = 1; ap<link.args[a].length; ap++) {
          if (person_data[link.args[a][ap]]) {
            parts.push(link.args[a][0] + '=' + escape(person_data[link.args[a][ap]]));
            break;
          }
        }
      }
      href += parts.join('&');
      $(TPL['research-button']({
        title: link.name,
        href: href
      })).appendTo(body).tooltip();
    }
  },

  load_parents: function (person) {
    var parents_obj = this.$('.left-side .parents-listing table');
    parents_obj.empty();
    var parents = person.data.parents;
    var node, parent;
    for (var i=0; i<parents.length; i++) {
      parent = this.app.db[parents[i][0]];
      node = $(TPL['parent-listing']({
        'id': parents[i][0],
        'name': parent?parent.name:'&lt;not loaded&gt;',
        'years': parent?parent.years:''
      })).appendTo(parents_obj);
      if (parent) {
        node.click(_.bind(this.load, this, this.app.db[parents[i][0]]));
      }
    }
    if (parents.length === 0) {
      $(TPL['no-parents']()).appendTo(parents_obj);
    }

  },

  load_alerts: function (person) {
    // load the alerts
    var info_alerts = this.$('.right-side .info-alerts');
    info_alerts.empty();
    if (!person.data.info_alerts.length) {
      $('<div class="alert alert-success">No missing information!</div>').appendTo(info_alerts);
    }
    for (var i=0; i<person.data.info_alerts.length; i++) {
      $('<div class="alert alert-error">' + person.data.info_alerts[i] + '</div>').appendTo(info_alerts);
    }
    var people_alerts = this.$('.right-side .people-alerts');
    people_alerts.empty();
    if (!person.data.people_alerts.length) {
      $('<div class="alert alert-success">No missing relationships!</div>').appendTo(people_alerts);
    }
    for (var i=0; i<person.data.people_alerts.length; i++) {
      $('<div class="alert alert-error">' + person.data.people_alerts[i] + '</div>').appendTo(people_alerts);
    }
  }
});



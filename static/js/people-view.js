

var PeopleView = Backbone.View.extend({
  el: '#people-view',
  initialize: function (options) {
    this.app = options.app;
    this.items = options.items || [];
    this.list = this.$('#people-listing');
    var that = this;
    this.$('> .header button.map').click(_.bind(this.app.switch_to, this.app, 'map'));
    this.$('#people-listing > div.person').live('click', function () {
      var node = $(this);
      var pid = node.data('id');
      that.app.person_detail.show(that.app.db[pid]);
    });
    this.ctrls = {
      'search': this.$('> .header .search-query'),
      'filters': this.$('> .header div.btn-group.filter button'),
      'sorts': this.$('> .header div.btn-group.sort button')
    };
  },

  show: function () {
    this.$el.show();
  },

  hide: function () {
    this.$el.hide();
  },

  add_item: function (person) {
    var el = this.make_child(person);
    this.items.push({data: person, el: el});
    this.list.append(el);
  },

  set_items: function (people) {
    this.reset_controls();
    this.items = [];
    var that = this;
    _.forOwn(people, function (value, key) {
      that.items.push({data: value, el: that.make_child(value)});
    });
    this.list.empty();
    this.reload_people();
  },

  reset_controls: function () {
    this.ctrls.search.val('');
    this.ctrls.sorts.removeClass('active');
    this.ctrls.sorts.filter('.gen').addClass('active');
    this.ctrls.filters.removeClass('active');
    this.ctrls.filters.filter('.all').addClass('active');
  },

  make_child: function (person) {
    var node = $(TPL['tpl-person'](person.tpl_data()));
    if (person.data.people_alerts.length) {
      node.addClass('people-alert');
    }
    if (person.data.info_alerts.length) {
      node.addClass('info-alert');
    }
    return node;
  },

  render: function () {
    var that = this;
    var bgclick = function (node) {
      if (node.hasClass('active')) return false;
      node.siblings('.active').removeClass('active');
      node.addClass('active');
      return true;
    };
    this.$('> .header div.btn-group.sort button').click(function () {
      if (bgclick($(this))) {
        that.sort_by(this.innerText);
      }
    });
    this.$('> .header div.btn-group.show button').click(function () {
      if (bgclick($(this))) {
        that.filter_by(this.innerText);
      }
    });
    this.$('> .header .search-query').change(_.debounce(function() {
      that.search_by(this.value);
    }), 200);
  },

  reload_people: function () {
    /** add the people back in the order that they are in this.list **/
    for (var i=0; i<this.items.length; i++) {
      this.list.append(this.items[i].el);
    }
  },

  search_by: function (text) {
    console.log('searching!' + text);
  },
  
  sort_by: function (type) {
    var cmp_str = function (attr) {
      return function (a, b) {
        if (a.data[attr] == b.data[attr]) return 0;
        if (a.data[attr].toLowerCase() < b.data[attr].toLowerCase()) return -1;
        return 1;
      };
    };
    var cmp_num = function (attr) {
      return function (a, b) {
        if (typeof(a.data[attr]) == 'string') return 1;
        if (typeof(b.data[attr]) == 'string') return -1;
        if (a.data[attr] == b.data[attr]) return 0;
        if (a.data[attr] < b.data[attr]) return -1;
        return 1;
      };
    };
    if (type === 'Name') {
      this.items.sort(cmp_str('name'));
    } else if (type === 'Surname') {
      this.items.sort(cmp_str('last_name'));
    } else if (type === 'Generation') {
      this.items.sort(cmp_num('gen'));
    } else if (type === 'Year') {
      this.items.sort(cmp_num('birth_year'));
    }
    this.reload_people();
  },

  filter_by: function (type) {
    this.list.removeClass('filter-info').removeClass('filter-people');
    if (type === 'Info') {
      this.list.addClass('filter-info');
    } else if (type === 'People') {
      this.list.addClass('filter-people');
    }
  }
});



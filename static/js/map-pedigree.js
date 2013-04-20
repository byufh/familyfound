/** handles the pedigree **/

/**
 * This sorts a list of people into pedigreedical order.
 */
var find_parents = function (child, people, db) {
  var parents = [], parent, found, fparent, gparents;
  for (var p=0; p<child.data.parents.length; p++) {
    parent = child.data.parents[p];
    found = false;
    for (var i=0; i<people.length; i++) {
      if (people[i].id == parent[0]) {
        found = i;
      }
    }

    // if the parent is not in the list (or doesn't have enough dates) look
    // for the grandparents
    if (found === false) {
      if (!db[parent[1]]) continue;
      grandparents = find_parents(db[parent[1]], people, db);
      if (grandparents) {
        parents.push(grandparents);
      }
    } else {
      fparent = people.splice(found, 1)[0];
      gparents = find_parents(fparent, people, db);
      gparents.splice(gparents.length/2, 0, fparent);
      gparents.gender = parent[1];
      parents.push(gparents);
    }
  }

  // if there were only two parents found, try to put the father on top
  if (child.data.parents.length == 2 && parents.length == 2) {
    if (parents[0].gender == 'Female') {
      parents = [parents[1], parents[0]];
    }
  }
  return parents;
};

var COLORS = '#1f77b4 #ff7f0e #2ca02c #d62728 #9467bd #8c564b #e377c2 #7f7f7f #bcbd22 #17becf'.split(' ');

var MapPedigree = Backbone.View.extend({
  el: '#timeline',

  initialize: function () {
    this.parent = this.options.parent;
    this.people = [];
    var that = this;
    this.$('.control li a').click(function () {
      that.set_sort($(this).data('name'));
      $(this).parent().siblings().find('a.disabled').removeClass('disabled');
      $(this).addClass('disabled');
    });
    this.body = this.$('> .pedigree');
  },

  /**
   * load a new list of people. bounds = [start_year, end_year] 
   */
  load: function (people, bounds) {
    // work with the pedigree
    this.people = people;
    this.bounds = bounds;
    this.sort = 'birth';
    this.refresh();
  },

  show: function (id) {
    this.$('.person-line.showing').removeClass('showing');
    var dv = this.$('.person-line[data-id=' + id + ']').addClass('showing')[0]
    if (dv) dv.scrollIntoViewIfNeeded();
  },

  /** sets the sort (called by the widget `.control`. type is one of 'birth',
   * 'death', or 'pedigree'
   */
  set_sort: function (type) {
    if (this.sort == type) {
      return;
    }
    this.sort = type;
    this.refresh();
  },

  /**
   * Sort the people and display them
   */
  refresh: function () {
    var first = this.bounds[0];
    var last = this.bounds[1];
    if (this.sort == 'death') {
      this.people.sort(function(a,b) {
        if (a.last == b.last) return 0;
        if (a.last < b.last) return -1;
        return 1;
      });
    } else {
      this.people.sort(function(a,b) {
        if (a.first == b.first) return 0;
        if (a.first < b.first) return -1;
        return 1;
      });
    }
    if (this.sort == 'pedigree') {
      var new_people = [], child, parents;
      while (this.people.length) {
        child = this.people.splice(-1, 1)[0];
        parents = find_parents(child, this.people, this.parent.parent.db);
        // insert the child in the middle of it's parents
        parents.splice(parents.length/2, 0, child);
        new_people.push(parents);
      }
      this.people = _.flatten(new_people);
    }
    var left, width, pf, pl;
    var span = last - first;
    this.body.empty();
    for (var i=0; i<this.people.length; i++) {
      pf = this.people[i].first.getFullYear();
      pl = this.people[i].last.getFullYear();
      if (pf == pl) continue;
      left = (pf - first)/span*100;
      width = (pl - pf)/span*100;
      name = this.people[i].gen + ' ' + this.people[i].name + ' (' + this.people[i].years + ')';
      if (this.people[i].lifespan) {
        name += ' ' + this.people[i].lifespan + ' years';
      }
      person = $(TPL['map-ped-person']({
        pid: this.people[i].id,
        left: left,
        width: width,
        name: name
      }))
          .appendTo(this.body).data('data', this.people[i])
          .click(_.bind(this.parent.info.load, this.parent.info, this.people[i].id, this.people[i], this.parent.parent.db))
          .find('.person')
          .tooltip({placement: 'right', animation: false, title:name});
      // TODO: setup birth, marriage, death tooltips
      var fm = this.people[i].data.families;
      for (var f=0; f<fm.length; f++) {
        if (!fm[f].marriage) continue;
        var d = utils.ev2date(fm[f].marriage);
        if (!d) continue;
        var m_title = 'Married ' + fm[f].marriage.date;
        if (this.people[i].birth_year !== '??') {
          m_title += ', age ' + (d.getFullYear() - this.people[i].birth_year);
        }
        $('<div class="marriage" style="left:' + between(pf, pl, d.getFullYear()) + '%"></div>').appendTo(person).tooltip({title:m_title});
      }
    }
  },

});


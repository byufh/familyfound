
var PageView = Backbone.View.extend({
  // override! string name of page
  page: null,
  el: function () {
    var el = $('#page-' + this.name);
    if (el.length === 0) {
      throw "Page Element not found: #page-" + this.name;
    }
    return el;
  },
  named: {},
  // if buttons == true, then all buttons will be mapped to their "name"
  // function. If it's a list, only those named will be mapped.
  buttons: false,

  initialize: function (options) {
    // initializes the instance
    this.app = options.app;
    var that = this;
    _.forOwn(this.named, function (value, key) {
      if (value === 1) value = '.' + key;
      that[key] = that.$(value);
    });
    this.loading = false;
    if (this.buttons === true) {
      this.$('button').each(function (i, node) {
        var b = $(this);
        var name = b.attr('name').replace('-', '_');
        // TODO: change to be like "click_{name}"?
        if (!that[name]) {
          throw "Button callback " + name + " not found";
        }
        b.click(_.bind(that[name], that));
      });
    } else if (this.buttons && this.buttons.length) {
      for (var i=0; i<this.buttons.length; i++) {
        this.$('button[name="' + this.buttons[i] + '"]').click(_.bind(this[this.buttons[i]], this));
      }
    }
  },

  ajax: function (url, data, success, error) {
    // run an ajax call, handling errors intelligently
    var that = this;
    error = error || function (data) {
      this.error(data.error);
    };
    $.ajax(URLS['ajax-' + url], {
      type: 'POST',
      dataType: 'json',
      data: data,
      error: function (xhr, error, httperror) {
        that.stop_loading();
        if (error === 'timeout') { // lost connection!
          Backbone.trigger('lost-connection');
          that.error('Unable to communicate with server');
        } else if (error === 'abort') {
          that.error('Connection was broken');
        } else if (error === 'parsererror') {
          that.error('Unrecognized response from the server');
        } else {
          that.error('Server Error:' + httperror);
        }
      },
      success: function (data, httpstatus, xhr) {
        that.stop_loading();
        if (data.error) {
          error.call(that, data);
          return;
        }
        success.call(that, data, httpstatus);
      }
    });
  },

  start_loading: function () {
    if (this.loading) return false;
    this.loading = true;
    this.$el.addClass('loading');
    return true;
  },

  stop_loading: function () {
    if (!this.loading) return false;
    this.loading = false;
    this.$el.removeClass('loading');
    return true;
  },

  error: function (text) {
    this.$('.error').text(text).show();
    // TODO: add "phone-home"
  },

  clear_error: function () {
    this.$('.error').text('').hide();
  },

  clear: function () {
    this.$('textarea,input').val('');
  },

  // overrideable
  onshow: function (previous) {
  },

  // Return false to prevent page change.
  onhide: function () {
    return true;
  },

  show: function () {
    if (false === this.onshow()) return false;
    this.$el.show();
    return true;
  },

  hide: function () {
    if (false === this.onhide()) return false;
    this.$el.hide();
    return true;
  }
});

var Application = Backbone.Router.extend({
  page_classes: {},
  current_page: false,

  setup_csrf: function () {
    // using jQuery
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    var csrftoken = getCookie('csrftoken');
    $.ajaxSetup({headers: {'X-CSRFToken': csrftoken}});
  },

  // something about page routing?
  _bindRoutes: function () {
    // Overriding _bindroots: include "pages" (added with app.add_page) 
    Backbone.Router.prototype._bindRoutes.apply(this, arguments);
    var that = this;
    this.pages = {};
    _.forOwn(this.page_classes, function (cls, name) {
      var page = that.pages[name] = new cls({app: that});
      page.render();
      var route = page.route || page.name;
      if (typeof(route) === 'string') {
        that.route(route, 'page:' + name, _.bind(that.view_page, that, name));
      } else if (route instanceof Backbone.Router) {
        throw "Can't deal with sub routes yet";
      }
    });
    this.current_page = false;
  },

  // switch to the given page
  view_page: function (name) {
    if (this.current_page && !this.pages[this.current_page].hide()) {
      // somehow communicate this failure?
      return false;
    }
    var prev = this.current_page;
    this.current_page = name;
    this.pages[name].show(prev);
  },

  nav: function (route) {
    return this.navigate(route, {trigger: true});
  }

}, {
  // add a page type to the hash (gets populated with page elements)
  add_page: function (page) {
    if (typeof(page) !== 'function') {
      page = PageView.extend(page);
    }
    this.prototype.page_classes[page.prototype.name] = page;
    return page;
  }
});


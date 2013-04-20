
function keys(options) {
  var evts = {
    9: 'tab',
    13: 'return',
    40: 'down',
    38: 'up',
    8: 'backspace'
  };
  return function (e) {
    var evt = evts[e.keyCode];
    if (!evt) return;
    if (e.shiftKey) evt = 'shift ' + evt;
    if (e.ctrlKey) evt = 'ctrl ' + evt;
    if (options[evt]) {
      return options[evt].call(this, e);
    }
  };
}

var template_loader = {templates: {}};
var TemplateView = Backbone.View.extend({
  template: null,
  template_loader: template_loader,

  /**
  * Children: a list of objects, that look like:
  *
  *  { 
  *      view: the class to use,
  *      name: string, 
  *        will be this.*name*
  *      selector: string, 
  *        the node to attach it to
  *      context: a function
  *        gets called with the parent view as "this". should return a hash
  *        of options to be passed to the view constructor
  *  }
  */
  children: [],

  /**
  * Bulk Children: a list of factories for creating multiple children of
  * the same view type.
  *
  * {
  *      view: the view type,
  *      args: a list of arguments to pass to the factory,
  *      func: the function,
  *        gets called for each element in `args`, should return a context
  *        hash, and is called with `this` being the parent view:
  *          {
  *              name: string,
  *              selector: string,
  *              context: a hash to be passed to the constructor
  *          }
  * }
  */
  bulk_children: [],

  // a list of options to be mapped to attributes ; in `initialize`,
  // this[name] = options[name] for name in opt_attrs (defaults to false if
  // the option is not specified)
  opt_attrs: [],

  // listeners is a hash of model events (mapped to 'this.model', and the
  // corresponting function names (bound to this)
  listeners: {},

  // a hash of name: selector -> this[name] = this.$(selector) at render time
  // if selector is 1, then it's '.' + name
  named: {},

  // override this. Should return a hash of things to hand to the template.
  // could also be an object itself
  template_context: function () {
    throw new Error('override this');
  },

  initialize: function (options) {
    var that = this;
    _.each(this.opt_attrs, function (attr) {
      that[attr] = options[attr] || false;
    });
    if (typeof(this.listeners) === 'function') {
      this.listeners = this.listeners.apply(this);
    }
    _.forOwn(this.listeners, function (fn, evt) {
      if (typeof(fn) !== 'function') {
        fn = that[fn];
      }
      if (!fn) {
        throw new Error('member function "' + fname +
            '" doesnt exist (binding to ' + evt + ')');
      }
      that.listenTo(that.model, evt, _.bind(fn, that));
    });
  },

  render: function () {
    var child, config, context, bulk;
    if (!this.template_loader.templates[this.template]) {
      throw new Error('Template not loaded: ' + this.template);
    }
    this.$el.addClass('tpl-' + this.template);
    this.$el.html(template_loader.templates[this.template](_.result(this, 'template_context')));
    for (var i=0; i<this.children.length; i++) {
      child = this.children[i];
      context = (child.context? child.context.call(this): {});
      this.make_child(child.view, child, context);
    }
    for (var i=0; i<this.bulk_children.length; i++) {
      bulk = this.bulk_children[i];
      for (var j=0; j<bulk.args.length; j++) {
        var args = bulk.args[j];
        child = bulk.func.apply(this, args);
        this.make_child(bulk.view, child, child.context || {});
      }
    }
    var that = this;
    _.forOwn(this.named, function (selector, name) {
      if (selector === 1) selector = '.' + name;
      that[name] = that.$(selector);
    });
    return this;
  },

  make_child: function (view, child, context) {
    var config = { el: this.$(child.selector) };
    if (context) {
      _.extend(config, context);
    }
    this[child.name] = new view(config).render();
  }
});



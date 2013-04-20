/** A little library making a "new" function that gets you a new class. **/

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


// render and put in the document
var renderToDiv = function (comp) {
  var div = document.createElement("DIV");
  UI.materialize(comp, div);
  return div;
};

// for events to bubble an element needs to be in the DOM.
// @return {Function} call this for cleanup
var addToBody = function (el) {
  el.style.display = "none";
  document.body.appendChild(el);
  return function () {
    document.body.removeChild(el);
  };
};


Tinytest.add("templating - assembly", function (test) {

  // Test for a bug that made it to production -- after a replacement,
  // we need to also check the newly replaced node for replacements
  var div = renderToDiv(Template.test_assembly_a0);
  test.equal(canonicalizeHtml(div.innerHTML),
               "Hi");

  // Another production bug -- we must use LiveRange to replace the
  // placeholder, or risk breaking other LiveRanges
  Session.set("stuff", true); // XXX bad form to use Session in a test?
  Template.test_assembly_b1.stuff = function () {
    return Session.get("stuff");
  };
  var onscreen = renderToDiv(Template.test_assembly_b0);
  test.equal(canonicalizeHtml(onscreen.innerHTML), "xyhi");
  Session.set("stuff", false);
  Deps.flush();
  test.equal(canonicalizeHtml(onscreen.innerHTML), "xhi");
  Deps.flush();
});

// Test that if a template throws an error, then pending_partials is
// cleaned up properly (that template rendering doesn't break..)






Tinytest.add("templating - table assembly", function(test) {
  var childWithTag = function(node, tag) {
    return _.find(node.childNodes, function(n) {
      return n.nodeName === tag;
    });
  };

  var table;
  table = childWithTag(renderToDiv(Template.test_table_a0), "TABLE");

  // table.rows is a great test, as it fails not only when TR/TD tags are
  // stripped due to improper html-to-fragment, but also when they are present
  // but don't show up because we didn't create a TBODY for IE.
  test.equal(table.rows.length, 3);

  // this time with an explicit TBODY
  table = childWithTag(renderToDiv(Template.test_table_b0), "TABLE");
  test.equal(table.rows.length, 3);

  var c = new LocalCollection();
  c.insert({bar:'a'});
  c.insert({bar:'b'});
  c.insert({bar:'c'});
  var onscreen = renderToDiv(Template.test_table_each.extend({data: {foo: c.find()}}));
  table = childWithTag(onscreen, "TABLE");

  test.equal(table.rows.length, 3, table.parentNode.innerHTML);
  var tds = onscreen.getElementsByTagName("TD");
  test.equal(tds.length, 3);
  test.equal(canonicalizeHtml(tds[0].innerHTML), "a");
  test.equal(canonicalizeHtml(tds[1].innerHTML), "b");
  test.equal(canonicalizeHtml(tds[2].innerHTML), "c");

  Deps.flush();
});

Tinytest.add("templating - event handler this", function(test) {

  Template.test_event_data_with.ONE = {str: "one"};
  Template.test_event_data_with.TWO = {str: "two"};
  Template.test_event_data_with.THREE = {str: "three"};

  Template.test_event_data_with.events({
    'click': function(event, template) {
      test.isTrue(this.str);
      test.equal(template.data.str, "one");
      event_buf.push(this.str);
    }
  });

  var event_buf = [];
  var containerDiv = renderToDiv(Template.test_event_data_with.extend({data:
    Template.test_event_data_with.ONE}));
  var cleanupDiv = addToBody(containerDiv);

  var divs = containerDiv.getElementsByTagName("div");
  test.equal(3, divs.length);

  clickElement(divs[0]);
  test.equal(event_buf, ['one']);
  event_buf.length = 0;

  clickElement(divs[1]);
  test.equal(event_buf, ['two']);
  event_buf.length = 0;

  clickElement(divs[2]);
  test.equal(event_buf, ['three']);
  event_buf.length = 0;

  cleanupDiv();
  Deps.flush();
});


if (document.addEventListener) {
  // Only run this test on browsers with support for event
  // capturing. A more detailed analysis can be found at
  // https://www.meteor.com/blog/2013/09/06/browser-events-bubbling-capturing-and-delegation

  // This is related to issue at https://gist.github.com/mquandalle/8157017
  // Tests two situations related to events that can only be captured, not bubbled:
  // 1. Event should only fire the handler that matches the selector given
  // 2. Event should work on every element in the selector and not just the first element
  // This test isn't written against mouseenter because it is synthesized by jQuery,
  // the bug also happened with the play event
  Tinytest.add("templating - capturing events", function (test) {
    var video1Played = 0,
        video2Played = 0;

    Template.test_capture_events.events({
      'play .video1': function () {
        video1Played++;
      },
      'play .video2': function () {
        video2Played++;
      }
    });

    // add to body or else events don't actually fire
    var containerDiv = renderToDiv(Template.test_capture_events);
    var cleanupDiv = addToBody(containerDiv);

    var checkAndResetEvents = function(video1, video2) {
      test.equal(video1Played, video1);
      test.equal(video2Played, video2);

      video1Played = 0;
      video2Played = 0;
    };

    simulateEvent($(containerDiv).find(".video1").get(0),
                  "play", {}, {bubbles: false});
    checkAndResetEvents(1, 0);

    simulateEvent($(containerDiv).find(".video2").get(0),
                  "play", {}, {bubbles: false});
    checkAndResetEvents(0, 1);

    simulateEvent($(containerDiv).find(".video2").get(1),
                  "play", {}, {bubbles: false});
    checkAndResetEvents(0, 1);

    // clean up DOM
    cleanupDiv();
    Deps.flush();
  });
}

Tinytest.add("templating - safestring", function(test) {

  Template.test_safestring_a.foo = function() {
    return "<br>";
  };
  Template.test_safestring_a.bar = function() {
    return new Handlebars.SafeString("<hr>");
  };

  var obj = {fooprop: "<br>",
             barprop: new Handlebars.SafeString("<hr>")};
  var html = canonicalizeHtml(
    renderToDiv(Template.test_safestring_a.extend({data: obj})).innerHTML);

  test.equal(html.replace(/\s+/g, ' '),
             "&lt;br&gt; <br> <hr> <hr> "+
             "&lt;br&gt; <br> <hr> <hr>");

});

Tinytest.add("templating - helpers and dots", function(test) {
  Handlebars.registerHelper("platypus", function() {
    return "eggs";
  });
  Handlebars.registerHelper("watermelon", function() {
    return "seeds";
  });

  Handlebars.registerHelper("daisygetter", function() {
    return this.daisy;
  });

  // XXX for debugging
  Handlebars.registerHelper("debugger", function() {
    debugger;
  });

  var getFancyObject = function() {
    return {
      foo: 'bar',
      apple: {banana: 'smoothie'},
      currentFruit: function() {
        return 'guava';
      },
      currentCountry: function() {
        return {name: 'Iceland',
                _pop: 321007,
                population: function() {
                  return this._pop;
                },
                unicorns: 0, // falsy value
                daisyGetter: function() {
                  return this.daisy;
                }
               };
      }
    };
  };

  Handlebars.registerHelper("fancyhelper", getFancyObject);

  Template.test_helpers_a.platypus = 'bill';
  Template.test_helpers_a.warthog = function() {
    return 'snout';
  };

  var listFour = function(a, b, c, d, options) {
    test.isTrue(options instanceof Spacebars.kw);
    var keywordArgs = _.map(_.keys(options.hash), function(k) {
      var val = options.hash[k];
      return k+':'+val;
    });
    return [a, b, c, d].concat(keywordArgs).join(' ');
  };

  var dataObj = {
    zero: 0,
    platypus: 'weird',
    watermelon: 'rind',
    daisy: 'petal',
    tree: function() { return 'leaf'; },
    thisTest: function() { return this.tree(); },
    getNull: function() { return null; },
    getUndefined: function () { return; },
    fancy: getFancyObject(),
    methodListFour: listFour
  };

  var html;
  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_a.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    'platypus=bill', // helpers on Template object take first priority
    'watermelon=seeds', // global helpers take second priority
    'daisy=petal', // unshadowed object property
    'tree=leaf', // function object property
    'warthog=snout' // function Template property
  ]);

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_b.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    // unknown properties silently fail
    'unknown=',
    // falsy property comes through
    'zero=0'
  ]);

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_c.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    // property gets are supposed to silently fail
    'platypus.X=',
    'watermelon.X=',
    'daisy.X=',
    'tree.X=',
    'warthog.X=',
    'getNull.X=',
    'getUndefined.X=',
    'getUndefined.X.Y='
  ]);

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_d.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    // helpers should get current data context in `this`
    'daisygetter=petal',
    // object methods should get object in `this`
    'thisTest=leaf',
    // nesting inside {{#with fancy}} shouldn't affect
    // method
    '../thisTest=leaf',
    // combine .. and .
    '../fancy.currentFruit=guava'
  ]);

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_e.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    'fancy.foo=bar',
    'fancy.apple.banana=smoothie',
    'fancy.currentFruit=guava',
    'fancy.currentCountry.name=Iceland',
    'fancy.currentCountry.population=321007',
    'fancy.currentCountry.unicorns=0'
  ]);

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_f.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    'fancyhelper.foo=bar',
    'fancyhelper.apple.banana=smoothie',
    'fancyhelper.currentFruit=guava',
    'fancyhelper.currentCountry.name=Iceland',
    'fancyhelper.currentCountry.population=321007',
    'fancyhelper.currentCountry.unicorns=0'
  ]);

  // test significance of 'this', which prevents helper from
  // shadowing property
  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_g.extend({data: dataObj})).innerHTML);
  test.equal(html.match(/\S+/g), [
    'platypus=eggs',
    'this.platypus=weird'
  ]);

  // test interpretation of arguments

  Template.test_helpers_h.helperListFour = listFour;

  html = canonicalizeHtml(
    renderToDiv(Template.test_helpers_h.extend({data: dataObj})).innerHTML);
  var trials =
        html.match(/\(.*?\)/g);
  test.equal(trials[0],
             '(methodListFour 6 7 8 9=6 7 8 9)');
  test.equal(trials[1],
             '(methodListFour platypus thisTest fancyhelper.currentFruit fancyhelper.currentCountry.unicorns=eggs leaf guava 0)');
  test.equal(trials[2],
             '(methodListFour platypus thisTest fancyhelper.currentFruit fancyhelper.currentCountry.unicorns a=platypus b=thisTest c=fancyhelper.currentFruit d=fancyhelper.currentCountry.unicorns=eggs leaf guava 0 a:eggs b:leaf c:guava d:0)');
  test.equal(trials[3],
             '(helperListFour platypus thisTest fancyhelper.currentFruit fancyhelper.currentCountry.unicorns=eggs leaf guava 0)');
  test.equal(trials[4],
             '(helperListFour platypus thisTest fancyhelper.currentFruit fancyhelper.currentCountry.unicorns a=platypus b=thisTest c=fancyhelper.currentFruit d=fancyhelper.currentCountry.unicorns=eggs leaf guava 0 a:eggs b:leaf c:guava d:0)');
  test.equal(trials.length, 5);

});


Tinytest.add("templating - rendered template", function(test) {
  var R = ReactiveVar('foo');
  Template.test_render_a.foo = function() {
    R.get();
    return this.x + 1;
  };

  var div = renderToDiv(Template.test_render_a.extend({data: {x: 123}}));
  test.equal($(div).text().match(/\S+/)[0], "124");

  var br1 = div.getElementsByTagName('br')[0];
  var hr1 = div.getElementsByTagName('hr')[0];
  test.isTrue(br1);
  test.isTrue(hr1);

  R.set('bar');
  Deps.flush();
  var br2 = div.getElementsByTagName('br')[0];
  var hr2 = div.getElementsByTagName('hr')[0];
  test.isTrue(br2);
  test.isTrue(br1 === br2);
  test.isTrue(hr2);
  test.isTrue(hr1 === hr2);

  Deps.flush();

  /////

  R = ReactiveVar('foo');

  Template.test_render_b.foo = function() {
    R.get();
    return (+this) + 1;
  };

  div = renderToDiv(Template.test_render_b.extend({data: {x: 123}}));
  test.equal($(div).text().match(/\S+/)[0], "201");

  var br1 = div.getElementsByTagName('br')[0];
  var hr1 = div.getElementsByTagName('hr')[0];
  test.isTrue(br1);
  test.isTrue(hr1);

  R.set('bar');
  Deps.flush();
  var br2 = div.getElementsByTagName('br')[0];
  var hr2 = div.getElementsByTagName('hr')[0];
  test.isTrue(br2);
  test.isTrue(br1 === br2);
  test.isTrue(hr2);
  test.isTrue(hr1 === hr2);

  Deps.flush();

});

Tinytest.add("templating - template arg", function (test) {
  Template.test_template_arg_a.events({
    click: function (event, template) {
      template.firstNode.innerHTML = 'Hello';
      template.lastNode.innerHTML = 'World';
      template.find('i').innerHTML =
        (template.findAll('*').length)+"-element";
      template.lastNode.innerHTML += ' (the secret is '+
        template.secret+')';
    }
  });

  Template.test_template_arg_a.created = function() {
    var self = this;
    test.isFalse(self.firstNode);
    test.isFalse(self.lastNode);
    test.throws(function () { return self.find("*"); });
    test.throws(function () { return self.findAll("*"); });
  };

  Template.test_template_arg_a.rendered = function () {
    var template = this;
    template.firstNode.innerHTML = 'Greetings';
    template.lastNode.innerHTML = 'Line';
    template.find('i').innerHTML =
      (template.findAll('b').length)+"-bold";
    template.secret = "strawberry "+template.data.food;
  };

  Template.test_template_arg_a.destroyed = function() {
    var self = this;
    test.isFalse(self.firstNode);
    test.isFalse(self.lastNode);
    test.throws(function () { return self.find("*"); });
    test.throws(function () { return self.findAll("*"); });
  };

  var div = renderToDiv(Template.test_template_arg_a.extend({data: {food: "pie"}}));
  var cleanupDiv = addToBody(div);
  Deps.flush(); // cause `rendered` to be called
  test.equal($(div).text(), "Greetings 1-bold Line");
  clickElement(div.querySelector('i'));
  test.equal($(div).text(), "Hello 3-element World (the secret is strawberry pie)");

  cleanupDiv();
  Deps.flush();
});

Tinytest.add("templating - helpers", function (test) {
  var tmpl = Template.test_template_helpers_a;

  tmpl.foo = 'z';
  tmpl.helpers({bar: 'b'});
  // helpers(...) takes precendence of assigned helper
  tmpl.helpers({foo: 'a', baz: function() { return 'c'; }});

  var div = renderToDiv(tmpl);
  test.equal($(div).text().match(/\S+/)[0], 'abc');
  Deps.flush();

  tmpl = Template.test_template_helpers_b;

  tmpl.helpers({
    'name': 'A',
    'arity': 'B',
    'toString': 'C',
    'length': 4,
    'var': 'D'
  });

  div = renderToDiv(tmpl);
  var txt = $(div).text().match(/\S+/)[0];
  test.isTrue(txt.match(/^ABC?4D$/));
  // We don't get 'C' (the ability to name a helper {{toString}})
  // in IE < 9 because of the famed DontEnum bug.  This could be
  // fixed but it would require making all the code that handles
  // the dictionary of helpers be DontEnum-aware.  In practice,
  // the Object prototype method names (toString, hasOwnProperty,
  // isPropertyOf, ...) make poor helper names and are unlikely
  // to be used in apps.
  test.expect_fail();
  test.equal(txt, 'ABC4D');
  Deps.flush();

  // test that helpers don't "leak"
  tmpl = Template.test_template_helpers_c;
  div = renderToDiv(tmpl);
  test.equal($(div).text(), 'x');
  Deps.flush();
});

Tinytest.add("templating - events", function (test) {
  var tmpl = Template.test_template_events_a;

  var buf = [];

  // old style
  tmpl.events = {
    'click b': function () { buf.push('b'); }
  };

  var div = renderToDiv(tmpl);
  var cleanupDiv = addToBody(div);
  clickElement($(div).find('b')[0]);
  test.equal(buf, ['b']);
  cleanupDiv();
  Deps.flush();

  ///

  tmpl = Template.test_template_events_b;
  buf = [];
  // new style
  tmpl.events({
    'click u': function () { buf.push('u'); }
  });
  tmpl.events({
    'click i': function () { buf.push('i'); }
  });

  div = renderToDiv(tmpl);
  cleanupDiv = addToBody(div);
  clickElement($(div).find('u')[0]);
  clickElement($(div).find('i')[0]);
  test.equal(buf, ['u', 'i']);
  cleanupDiv();
  Deps.flush();

  //Test for identical callbacks for issue #650
  tmpl = Template.test_template_events_c;
  buf = [];
  tmpl.events({
    'click u': function () { buf.push('a'); }
  });
  tmpl.events({
    'click u': function () { buf.push('b'); }
  });

  div = renderToDiv(tmpl);
  cleanupDiv = addToBody(div);
  clickElement($(div).find('u')[0]);
  test.equal(buf.length, 2);
  test.isTrue(_.contains(buf, 'a'));
  test.isTrue(_.contains(buf, 'b'));
  cleanupDiv();
  Deps.flush();
});


Tinytest.add('templating - helper typecast Issue #617', function (test) {

  Handlebars.registerHelper('testTypeCasting', function (/*arguments*/) {
    // Return a string representing the arguments passed to this
    // function, including types. eg:
    // (1, true) -> "[number,1][boolean,true]"
    return _.reduce(_.toArray(arguments), function (memo, arg) {
      if (typeof arg === 'object')
        return memo + "[object]";
      return memo + "[" + typeof arg + "," + arg + "]";
    }, "");
    return x;
  });

  var div = renderToDiv(Template.test_type_casting);
  var result = canonicalizeHtml(div.innerHTML);
  test.equal(
    result,
    // This corresponds to entries in templating_tests.html.
    // true/faslse
    "[string,true][string,false][boolean,true][boolean,false]" +
      // numbers
      "[number,0][number,1][number,-1][number,10][number,-10]" +
      // handlebars 'options' argument. appended to args of all helpers.
      "[object]");
});

Tinytest.add('templating - each falsy Issue #801', function (test) {
  //Minor test for issue #801 (#each over array containing nulls)
  Template.test_template_issue801.values = function() { return [0,1,2,null,undefined,false]; };
  var div = renderToDiv(Template.test_template_issue801);
  test.equal(canonicalizeHtml(div.innerHTML), "012");
});

Tinytest.add('templating - duplicate template error', function (test) {
  Template.__define__("test_duplicate_template", function () {});
  test.throws(function () {
    Template.__define__("test_duplicate_template", function () {});
  });
});

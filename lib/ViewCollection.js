"use strict";

/**
 * Provide methods to a list of views
 * @class ViewCollection
 */
function ViewCollection() {
	this.initialize.apply(this, [].slice.call(arguments));
}

ViewCollection.prototype = {
	/**
	 * Store the list of views
	 * @constructor
	 * @param {Array} views  A collection of View objects
	 */
	initialize: function initialize(views) {
		for (var i = 0, len = views.length; i < len; i++) {
			this[i] = views[i];
		}
		this.length = views.length;
	},
	
	get: function get(i) {
		return this[i];
	},
	
	eq: function eq(i) {
		return new ViewCollection(this[i]);
	},
	
	first: function first() {
		return this[0];
	},
	
	last: function last() {
		return this[this.length-1];
	},
	
	push: function push(view) {
		this[this.length++] = view;
		return this;
	},
	
	append: function append(view) {
		this.last().add(view);
		return this;
	},
	
	appendTo: function appendTo(view) {
		var i = 0;
		while (i < this.length) {
			view.add(this[i]);
			i++;
		}		
		return this;		
	},
	
	// insertBefore: function(view) {},
	
	remove: function remove() {
		var i = 0;
		while (i < this.length) {
			this[i].getParent().remove(this[i]);
			i++;
		}		
		return this;
	},
	
// need to handle views with multiple classes	
//	up: function(selector) {
//		var match;
//		var view = this[0];
//		var parent;
//		if (!this[0]) {
//			return new ViewCollection([]);
//		}
//		parent = view.getParent();
//		if (!parent) {
//			return new ViewCollection([]);			
//		}
//		if (arguments.length === 0 || selector === 0) {
//			return new ViewCollection(parent);
//		}
//		if (typeof selector == 'number') {
//			while ((parent = parent.getParent())) {
//				if (--selector === 0) {
//					return new ViewCollection(parent);
//				}
//			}
//			return new ViewCollection([]);
//		}
//		match = selector.match(/^(\.|#)(\S+)$/);
//		if (!match) {
//			throw new Error('ViewCollection#up(selector): if given, selector must be a Number or a String that begins with "." or "#" and contain no spaces.');
//		}
//		var prop = match[1] == '.' ? 'riClass' : 'riId';
//		var value = match[2];
//		while ((parent = parent.getParent())) {
//			if (parent[prop] == value) {
//				return new ViewCollection(parent);
//			}
//		}
//		return new ViewCollection([]);		
//	},
	
	children: function children() {
		var children = [];
		this.forEach(function forEachView(view) {
			children = children.concat(view.children);
		});
		return new ViewCollection(children);
	},
	
	descendants: function descendants() {
		var views = [];
		function walk(view) {
			for (var i = 0, len = view.children.length; i < len; i++) {
				views.push(view.children[i]);
				walk(view.children[i]);
			}
		}
		this.forEach(walk);
		return new ViewCollection(views);
	},
	
//	down: function find(selector) {
//		if (this.length === 0) {
//			return new ViewCollection([]);
//		}
//		if (arguments.length === 0) {
//			if (this.children.length) {
//				return new ViewCollection(this.children[0]);
//			}
//			return new ViewCollection([]);
//		}
//		var match = selector.match(/^(\.|#)(\S+)$/);
//		if (!match) {
//			throw new Error('ViewCollection#down(selector): if given, selector must be a String that begins with "." or "#" and contain no spaces.');
//		}
//		var prop = match[1] == '.' ? 'riClass' : 'riId';
//		var value = match[2];
//		var matches = new ViewCollection([]);			
//		var walk = function(view) {
//			for (var i = 0, len = view.children.length; i < len; i++) {
//				if (view.children[i][prop] == value) {
//					matches.push(view.children[i]);
//				}
//				walk(view.children[i]);
//			}
//		};
//		walk(this[0]);
//		return matches;
//	},
	
	filter: function filter(callback) {
		var passes = new ViewCollection([]);
		var i = 0;
		while (i < this.length) {
			if (!!callback(this[i], i, this)) {
				passes.push(this[i]);
			}
			i++;
		}
		return passes;
	},
	
	forEach: function forEach(callback) {
		var i = 0;
		while (i < this.length) {
			callback(this[i], i, this);
			i++;
		}
		return this;
	},
	
	each: function each(callback) {
		var i = 0;
		while (i < this.length) {
			if (callback(i, this[i]) === false) {
				return this;
			}
			i++;
		}
		return this;
	},
	
	invoke: function invoke(name) {
		var args = [].slice.call(arguments, 1);
		var i = 0;
		while (i < this.length) {
			this[i][name].apply(this[i], args);
			i++;
		}
		return this;	
	},
	
	collect: function collect(callback) {
		var items = [];
		var i = 0;
		while (i < this.length) {
			items[i] = callback(this[i]);
			i++;
		}
		return items;			
	},
	
	collectResults: function collectResults(method) {
		var args = [].slice.call(arguments, 1);
		var items = [];
		var i = 0;
		while (i < this.length) {
			items[i] = this[i][method].apply(this[i], args);
			i++;
		}
		return items;			
	},
	
	pluck: function pluck(name) {
		var items = [];
		var i = 0;
		while (i < this.length) {
			items[i] = this[i][name];
			i++;
		}
		return items;	
	},
	
	show: function show() {
		this.invoke('show');
		return this;
	},
	
	hide: function hide() {
		this.invoke('hide');
		return this;
	},
	
	applyProperties: function applyProperties(props) {
		this.invoke('applyProperties', props);
		return this;
	},
	
	animate: function animate(animation) {
		this.invoke('animate', animation);
		return this;		
	},
	
	prop: function prop(name, value) {
		if (arguments.length == 1 && typeof name == 'string') {
			return this[0][name];
		}
		var i = 0;
		while (i < this.length) {
			if (arguments.length == 1) {
				this[i].applyProperties(name);
			}
			else {				
				this[i][name] = value;
			}
			i++;
		}
		return this;
	},
	
	click: function click(handler) {
		if (typeof handler == 'function') {
			this.on('click', handler);
		}
		else {
			this.invoke('fireEvent', 'click', handler || {});
		}
		return this;
	},
	
	on: function on(type, handler) {
		this.invoke('addEventListener', type, handler);
		return this;
	},
	
	off: function off(type, handler) {
		this.invoke('removeEventListener', type, handler);
		return this;
	},
	
	one: function one(type, handler) {
		this.invoke('addEventListener', type, handler);
		this.invoke('addEventListener', type, function() {
			this.removeEventListener(type, handler);
		});
		return this;
	}
	
};

ViewCollection.create = function create(views) {
	// array of views: wrap in ViewCollection
	if (Array.isArray(views)) {
		return new ViewCollection(views);
	}
	// ViewCollection instance: simply return it
	if (views instanceof ViewCollection) {
		return views;
	}
	// single view: create ViewCollection with one item
	return new ViewCollection([views]);
};

module.exports = ViewCollection;

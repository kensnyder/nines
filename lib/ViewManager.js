"use strict";

var ViewCollection = require('ViewCollection');

function ViewManager() {
	this.initialize.apply(this, [].slice.call(arguments));
}

ViewManager.prototype = {

	initialize: function initialize() {
		this.byId = {};
		this.byClass = {};
		this.byTag = {};
	},
	
	addView: function addView(view, id, classNames, tag, parent) {
		if (parent === null) {
			this.root = parent;
		}
		if (id) {
			this.byId[id] = view;
		}
		(classNames || '').trim().split(/\s+/).forEach(function(className) {
			if (className === '') {
				return;
			}
			if (!this.byClass[className]) {
				this.byClass[className] = [];
			}
			this.byClass[className].push(view);
		}, this);
		if (!this.byTag[tag]) {
			this.byTag[tag] = [];
		}
		this.byTag[tag].push(view);
	},
	
	collect: function collect(selector) {		
		if (selector == 'root' || selector === undefined) {
			return new ViewCollection([this.root]);
		}
		if (selector.substring(0,1) == '#' && byId[selector.substring(1)]) {
			return new ViewCollection([this.byId[selector.substring(1)]]);
		}
		if (selector.substring(0,1) == '.' && byClass[selector.substring(1)]) {
			return new ViewCollection(this.byClass[selector.substring(1)]);
		}
		// unsupported selector or no elements matching selector
		return new ViewCollection([]);
	}
	
};

module.exports = ViewManager;

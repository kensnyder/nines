"use strict";

var fs = require('fs');
var extend = require('extend');

/**
 * Parse CSS files, load styles, and apply styles to Ti.UI.View objects
 * @class CSS
 */
function StyleSheetCompiler() {
	this.initialize.apply(this, [].slice.call(arguments));
}

StyleSheetCompiler.prototype = {
	
	/**
	 * Track all the loaded styles and number of stylesheets
	 * @method initialize
	 * @constructor
	 */
	initialize: function() {
		this.stylesheets = {};
//		this.styles = {};
//		this.numStylesheets = 0;
	},	

//	apply: function(stylesheets, attributes) {
//		// load file if not yet loaded
//		var js = 'options = ';
//		js += this._attributesToJs(attributes) + ';';
//		// add conditionals based on media queries
//		return js;
//	},
//	_attributesToJs: function(attributes) {
//		var js = '{';
//		var plainObject = [];
//		for (var p in attributes) {
//			plainObject.push('"' + p + '":' + attributes[p]);
//		}
//		js += plainObject.join(',\n');
//		js += '}';
//		return js;
//	},

	_splitOnSymbols: function(styles) {
		// remove comments
		styles = styles.replace(/\/\*.+?\*\//, ''); 
		// split on comments, xml tags, or <% %> script tags
		return styles.split(/(\{|\}|;|,)/).
			map(function(s) {
				return s.trim();
			}).
			filter(function(s) {
				// filter out empty strings
				return s !== '';
			})
		;		
	},
	
	_tokenize: function(styles) {
		var tokens = [];
		var conditions;
		var expectMediaQueryBlock = false;
		var mediaQueryDepth = 0;
		var inDeclarationBlock = false;
		this._splitOnSymbols(styles).forEach(function(word) {
			if (word == '{' && expectMediaQueryBlock) {
				tokens.push({
					type: 'beginMediaQueryBlock'
				});
				expectMediaQueryBlock = false;
				mediaQueryDepth++;
			}
			else if (word == '{') {
				tokens.push({
					type: 'beginDeclarationBlock'
				});
				inDeclarationBlock = true;
			}
			else if (word == '}' && inDeclarationBlock) {
				tokens.push({
					type: 'endDeclarationBlock'
				});
				inDeclarationBlock = false;
			}
			else if (word == '}' && mediaQueryDepth > 0) {
				tokens.push({
					type: 'endMediaQueryBlock'
				});
				mediaQueryDepth--;
			}
			else if (word.indexOf('@media') === 0) {
				// strip off "@media ", split on "and" and trim all parts
				conditions = word.substring(7).split('and').map(function(s) {
					return s.trim();
				});
				tokens.push({
					type: 'mediaQuery',
					conditions: conditions
				});
				expectMediaQueryBlock = true;
			}
			else if (word.indexOf('.') === 0) {
				tokens.push({
					type: 'class',
					value: word.substring(1)
				});
			}
			else if (word.indexOf('#') === 0) {
				tokens.push({
					type: 'id',
					value: word.substring(1)
				});
			}
			else if (inDeclarationBlock && word.indexOf(':') > 0) {
				tokens.push({
					type: 'property',
					name: word.split(':')[0].trim(),
					value: word.split(':')[1].trim()
				});
			}
			else if (word == ';' || word == ',') {
				// ignore
			}
			else {
				throw new Error('Unexpected token `' + word + '`');
			}
		});
		return tokens;
	},
	
	compile: function(filepath) {
		var self = this;
		var css = fs.readFileSync(filepath, "utf8");
		self.stylesheets[filepath] = {
			ids: {},
			classes: {}
		};
		var currClass;
		var currId;
		var conditions = [];
		self._tokenize(css).forEach(function(token) {
			if (token.type == 'mediaQuery') {
				conditions = conditions.concat(token.conditions);
			}
			else if (token.type == 'class') {
				currClass = token.value;
				self.stylesheets[filepath].classes[currClass] = {};
			}
			else if (token.type == 'property') {
				self.stylesheets[filepath].classes[currClass || currId][token.name] = {
					name: token.name,
					value: token.value,
					conditions: conditions
				};
			}
			
		});
		return this.stylesheets[filepath];
	},
	
	_interpolateProperty: function(property/* with name, value, conditions*/) {
		
	},

	/**
	 * Merges the CSS rules found in filename into this.styles
	 * @method loadFile
	 *
	 * @param {String} filename  the name of the file that contains the CSS rules we want to load into this.styles
	 * @return {CSS}
	 * @chainable
	 */
	loadFile: function(filename) {
		var fileString = this._getFile(filename);
		this.loadCss(fileString);
		return this;
	},
	/**
	 * Load a string of CSS and merge into this.styles. Called by #loadFile()
	 * @method loadCSS
	 * 
	 * @param {String} cssString
	 * @return {CSS}
	 * @chainable
	 */
	loadCss: function(cssString) {
		var css = this._parseCSS(cssString);
		if (++this.numStylesheets == 1) {
			this.styles = css;
		}
		else {
			extend(true, this.styles, css);
		}
		return this;
	},
	/**
	 * Gets the CSS rules that apply to the id and classNames from this.styles;
	 * merges them into attrValues for application to a Ti.UI view. During merge,
	 * id styles overwrite class styles, and attrValues overwrite them all.
	 * @method applyStyles
	 *
	 * @param {Object} attrValues  contains the "inline" values applied to the view
	 * @param {String} id  the view element's id
	 * @param {array} classNames  the view element's classes
	 * @return {Object}  rule declarations that apply to the view
	 */
	applyStyles: function(attrValues, id, classNames) {
		var camelized = {}, name;
		for (name in attrValues) {
			if (!attrValues.hasOwnProperty(name)) {
				continue;
			}
			camelized[this._camelize(name)] = attrValues[name];
		}
		CSS.expanders.apply(camelized);
		var styles = extend(
			{},
			this.styles.base || {}, 
			this._getValuesForClassNames(classNames), 
			this._getValuesForId(id), 
			camelized
		);
		return styles;
	},
//	/**
//	 * Gets the CSS file contents
//	 * @method _getFile
//	 *
//	 * @param {String} fileName  the CSS file we want to retreive; path relative to ingot/css directory
//	 * @return {String}
//	 */
//	_getFile: function(fileName) {
//		var cssFile = Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory + '/ingot', fileName);
//		var blob = cssFile.read();
//		var css = blob.text;
//		var trimmedCss = css.trim();
//		var commentsRegex = /\/\*[.\s\S]+?\*\//g;
//		var noComment = trimmedCss.replace(commentsRegex, '');
//
//		cssFile = null;
//		blob = null;
// 
//		return noComment;
//	},
	/**
	 * Divides a CSS file by CSS declaration blocks
	 * @method _splitRight
	 *
	 * @param {String} fromFile the string extracted from the CSS file
	 * @return {Array}  an array of CSS blocks
	 */
	_splitRight: function(fromFile) {
		var splitRight = fromFile.split('}');

		return splitRight;
	},
	/**
	 * Splits each CSS block into an array: `[[selector, declarations], ...]`
	 * @method _splitMiddle
	 *
	 * @param {Array} splitRight  an array with 1 or more CSS blocks
	 * @return {Array} blocks  an array with arrays for each CSS block with the block's selector separated from the style declarations
	 */
	_splitMiddle: function(splitRight) {
		var blocks = [];
		var parts;
		var criteria;
		var i;
		var ilen = splitRight.length;
		var commaSep;
		var j;
		var jlen;
		for (i = 0; i < ilen; i++) {
			if (splitRight[i].length === 0) {
				continue;
			}
			parts = splitRight[i].split('{');
			commaSep = parts[0].split(/\s*,\s*/g);
			for (j = 0, jlen = commaSep.length; j < jlen; j++) {				
				criteria = commaSep[j].trim().match(/^(.+?)(\[.+\])\s*$/);
				// we have an attribute selector such as .foo[platform=ios]
				// or .foo[platform=ios][formFactor=tablet]
				if (criteria) {
					commaSep[j] = criteria[1];
					if (!CSS.attributeSelectors.passes(criteria[2])) {
						continue;
					}
				}
				else {
						
				}				
				blocks.push([ commaSep[j], parts[1] ]);
			}
		}
		return blocks;
	},
	/**
	 * Gets the CSS selector
	 * @method _getSelector
	 *
	 * @param {Array} cssDeclaration  a CSS declaration divided into selector and declarations
	 * @return {String} trimmed  the block's CSS selector
	 */
	_getSelector: function(cssDeclaration) {
		var selector = cssDeclaration[0];
		var trimmed = selector.trim();

		return trimmed;
	},
	/**
	 * Creates a CSS declaration object out of an array
	 * @method _createObject
	 *
	 * @param {Array} splitMiddle  similar to this: `[ [ '#Container ', ' \tmargin: 12px; \theight: 50px; ' ] ]`
	 * @return {Object} css  similar to this: `{"#Container":{ "margin": "12px", "height": "50px"}}`
	 */
	_createObject: function(splitMiddle) {
		var styles, stylesLength, selector, declaration, property, value;
		var splitMiddleLength = splitMiddle.length;
		var css = {};
		var sIdx;

		for (var i = 0; i < splitMiddleLength; i++) {
			if (!splitMiddle[i][1]) {
				// extra white space
				continue;
			}			
			styles = splitMiddle[i][1].split(';');
			stylesLength = styles.length;
			selector = this._getSelector(splitMiddle[i]);
			if (!css[selector]) {
				css[selector] = {};
			}

			for (sIdx = 0; sIdx < stylesLength; sIdx++) {
				declaration = styles[sIdx].split(':');

				if (typeof declaration[0] === 'undefined' || typeof declaration[1] === 'undefined') {
					continue;
				}

				property = this._camelize(declaration[0].trim());
				value = declaration[1].trim();

				// expand/transform values before they are put in obj
				css[selector][property] = value;
			}
		}
		for (selector in css) {
			CSS.expanders.apply(css[selector]);
		}
		return css;
	},
	/**
	 * Parses a CSS file using all of the methods above
	 * @method _parseFile
	 *
	 * @param {String} filename  the name of the CSS file that we need to parse
	 * @return {Object} css  each member of the object is a css block;
	 * the CSS selector is the key in each block, and the group of properties/values make up the value
	 */
	_parseFile: function(filename) {
		var fileString = this._getFile(filename);
		var css = this._parseCSS(fileString);
		return css;
	},
	/**
	 * Parses CSS text
	 * @method _parseCSS
	 *
	 * @param {String} fileString  the string
	 * @return {Object} css  each member of the object is a css block;
	 * the CSS selector is the key in each block, and the group of properties/values make up the value
	 */
	_parseCSS: function(fileString) {
		var splitRight = this._splitRight(fileString);
		var splitMiddle = this._splitMiddle(splitRight);
		var obj = this._createObject(splitMiddle);
		return obj;
	},
	/**
	 * Iterates through classNames and looks in `this.styles` for any CSS rules related to any class in `classNames`
	 * @method _getValuesForClassNames
	 *
	 * @param {Array} classNames
	 * @return {Object}  any style rules that relate to any class in `classNames`
	 */
	_getValuesForClassNames: function(classNames) {
		var classNamesLength = classNames.length;
		var classStyles = {};

		for (var i = 0; i < classNamesLength; i++) {
			var thisClass = '.' + classNames[i];
			var thisClassStyle = this.styles[thisClass];

			extend(true, classStyles, thisClassStyle);
		}

		return classStyles;
	},
	/**
	 * Looks in `this.styles` for any CSS rules related to `id`
	 * @method _getValuesForId
	 *
	 * @param {String} id  the view id we'd like to get styles for. The '#' is prepened and does not need to be sent.
	 * @return {Object}  any style rules that relate to `id`
	 */
	_getValuesForId: function(id) {
		var idAndHash = '#' + id;
		return this.styles[idAndHash];
	},
	/**
	 * Titanium view object properties have camel case names. This camelizes dashed CSS property names;
	 * @method _camelize
	 *
	 * @param {String} str  the string to be camelized
	 * @return {String} camelized
	 */
	_camelize: function(str) {
		var camelized = str.replace(/-[a-z]/, function($0) { return $0.substring(1).toUpperCase(); });
		return camelized;
	}	
};
//
//
///**
// * Class to manage property and attribute extensions
// * @class PluginManager
// * @private
// */
//var PluginManager = Class.create({
//	
//	/**
//	 * Create an array of handlers
//	 * @method initialize
//	 * @constructor
//	 */
//	initialize: function() {
//		this.handlers = [];
//	},
//	/**
//	 * Register an extension
//	 * @method register
//	 * 
//	 * @param {String} name  The name of the extension used to get or unregister an extension by name
//	 * @param {Function} handler  The handler to call for each CSS declaration
//	 * @return {PluginManager}
//	 */
//	register: function(name, handler) {
//		this.handlers.push({
//			name: name,
//			handler: handler
//		});
//		return this;
//	},
//	/**
//	 * Get the handler for a registered extension
//	 * @method get
//	 * 
//	 * @param {String} name  The name of the extension to fetch
//	 * @return {Function|undefined}
//	 */
//	get: function(name) {
//		for (var i = 0, len = this.handlers.length; i < len; i++) {
//			if (this.handlers[i].name == name) {
//				return this.handlers[i].handler;
//			}
//		}
//		return undefined;
//	},
//	/**
//	 * Unregister a handler
//	 * @method unregister
//	 * 
//	 * @param {String} name  The name of the extension to unregister
//	 * @return {PluginManager}
//	 */
//	unregister: function(name) {
//		for (var i = 0, len = this.handlers.length; i < len; i++) {
//			if (this.handlers[i].name == name) {
//				this.handlers = this.handlers.splice(i, 1);
//				break;
//			}
//		}
//		return this;
//	}
//});
///**
// * The plugin manager for processing properties
// * @class CSS.ExpanderManager
// */
//CSS.ExpanderManager = PluginManager.subclass({
//	/**
//	 * Create this.fonts to store font names to expand
//	 * @constructor
//	 */
//	initialize: function() {
//		this.callSuper('initialize');
//		this.fonts = {};
//	},
//	/**
//	 * Register a font to use
//	 * @method registerFont
//	 * 
//	 * @param {String} cssName  The name that will be used in the CSS files
//	 * @param {Object} info  Details on the font
//	 * @param {String} info.filename  The filename on Android
//	 * @param {String} info.family  The font name defined in the font file used for iOS
//	 * @return {CSS.ExpanderManager}
//	 * @chainable
//	 */
//	registerFont: function(cssName, info) {
//		this.fonts[cssName] = Ti.Platform.osname == 'android' ? info.filename : info.family;
//		return this;
//	},
//	/**
//	 * Apply all the registered handlers to the given object
//	 * @method apply
//	 * 
//	 * @param {Object} obj  The object that will be altered by all the registered handlers
//	 * @return {Object}  The input object
//	 */
//	apply: function(obj) {
//		var attr;
//		var i;
//		var len = this.handlers.length;
//		for (attr in obj) {
//			if (!obj.hasOwnProperty(attr)) {
//				continue;
//			}
//			for (i = 0; i < len; i++) {
//				if (this.handlers[i].handler.call(this, obj, attr, obj[attr]) === true) {
//					// attribute was handled; don't let other handlers fire
//					break;
//				}
//			}
//		}
//		return obj;
//	}
//};
//
//// Initialize our property expander manager
//CSS.expanders = new CSS.ExpanderManager();
//CSS.expanders
////
//// Property Expander:
//// Map textAlign values "left", "center", "right" to TI.UI.TEXT_ALIGNMENT_* constants of the same names
//// 
//// Examples:
//// text-align: left;
////
//.register('textAlign', function(obj, name, value) {
//	if (name != 'textAlign' || !value.match(/^(left|center|right)$/i)) {
//		return false;
//	}
//	obj[name] = Ti.UI['TEXT_ALIGNMENT_' + value.toUpperCase()];		
//	return true;
//})
////
//// Property Expander:
//// Map verticalAlign values "top", "center", "bottom" to TI.UI.TEXT_VERTICAL_ALIGNMENT_* constants
//// of the same names; alias "middle" to "center""
//// 
//// Examples:
//// vertical-align: center;
//// vertical-align: middle;
////
//.register('verticalAlign', function(obj, name, value) {
//	if (name != 'verticalAlign' || !value.match(/^(top|center|middle|bottom)$/i)) {
//		return false;
//	}
//	var upper = value.toUpperCase();
//	if (upper == 'MIDDLE') {
//		// Titanium uses CENTER instead of MIDDLE for some reason
//		upper = 'CENTER';
//	}
//	obj[name] = Ti.UI['TEXT_VERTICAL_ALIGNMENT_' + upper];		
//	return true;
//})
////
//// Property Expander:
//// Convert "center: 50, 50" to "center: {x:50, y:50}"
//// 
//// Examples:
//// center: 50, 50;
//// center: 25%, 25%;
////
//.register('center', function(obj, name, value) {
//	if (name != 'center' || value.indexOf(',') == -1) {
//		return false;
//	}
//	var parts = value.split(',');
//	obj[name] = {
//		x: parts[0].trim(),
//		y: parts[1].trim()
//	};
//	return true;
//})
////
//// Property Expander:
//// Like CSS text-transform that recognizes uppercase, lowercase, and capitalize
//// 
//// Examples:
//// text-transform: uppercase;
//// text-transform: lowercase;
//// text-transform: capitalize; /* Title Case Text */
////
//.register('textTransform', function(obj, name, value) {
//	if (name != 'textTransform' || !value.match(/^(uppercase|lowercase|capitalize)$/i) || !obj.text) {
//		return false;
//	}
//	value = value.toLowerCase();
//	if (value == 'uppercase') {
//		obj.text = obj.text.toUpperCase();
//	}
//	else if (value == 'lowercase') {
//		obj.text = obj.text.toLowerCase();
//	}
//	else if (value == 'capitalize') {
//		obj.text = obj.text.replace(/(^|\s)(\S)/g, function($0, $1, $2) {
//			return $1 + $2.toUpperCase();
//		});
//	}
//	delete obj.textTransform;
//	return true;
//})
////
//// Property Expander:
//// Convert "font: bold italic 10 Helvetica" to fontWeight, fontStyle, fontSize, fontFamily
//// 
//// Examples:
//// font: 10 MyFont;
//// font: bold 10 Helvetica;
//// font: italic 15px Helvetica;
//// font: bold italic 18 Helvetica;
////
//.register('font', function(obj, name, value) {
//	if (name !== 'font') {
//		return false;
//	}
//	var fontRegEx = /^(normal|bold)? ?(normal|italic)? ?(\d+\w*)? ?(.+)?$/;
//	var match = fontRegEx.exec(value);
//	if (!match) {
//		return false;
//	}
//	var parsedFont = {};
//	if (match[1]) {
//		parsedFont.fontWeight = match[1];
//	}
//	if (match[2]) {
//		parsedFont.fontStyle = match[2];
//	}
//	if (match[3]) {
//		parsedFont.fontSize = match[3];
//	}
//	if (match[4]) {
//		parsedFont.fontFamily = this.fonts[match[4]] || match[4];
//	}
//	obj.font = parsedFont;
//	return true;
//})
////
//// Property Expander:
//// Convert "border: 2 black" into borderWidth and borderColor values
//// 
//// Examples:
//// border: 2 #000000;
//// background-color: #22000000;
////
//.register('border', function(obj, name, value) {
//	if (name !== 'border') {
//		return false;
//	}
//	var match = value.match(/^(\d+\w*)? ?(\#[a-fA-f0-9]*)?$/);
//	if (match[1]) {
//		obj.borderWidth = match[1];
//	}
//	if (match[2]) {
//		obj.borderColor = match[2];
//	}
//	// we don't need {border: '1 #444444'} anymore
//	delete obj.border;
//
//	return true;
//})
////
//// Property Expander:
//// Convert "Ti.UI.*" strings into constants in the same form
//// 
//// Examples:
//// width: Ti.UI.FILL;
//// keyboard-type: Ti.UI.KEYBOARD_EMAIL
////
//.register('constants', function(obj, name, value) {
//	var constRegEx = /^(Ti|Titanium)\.UI\.(.+)$/;
//	var match = constRegEx.exec(value);
//
//	if (!match) {
//		return false;
//	}
//	value = Ti.UI;
//	try {
//		match[2].split('.').forEach(function(part) {
//			value = value[part];
//		});
//		obj[name] = value;
//		return true;
//	}
//	catch (e) {
//		return false;
//	}
//})
////
//// Property Expander:
//// Convert boolean strings to true or false
//// 
//// Examples:
//// touch-enabled: false;
//// woord-wrap: true;
////
//.register('boolean', function(obj, name, value) {
//	if (value == 'true') {
//		obj[name] = true;
//		return true;
//	}
//	else if (value == 'false') {
//		obj[name] = false;
//		return true;
//	}
//	return false;
//})
////
//// Property Expander:
//// Allow text strings to be wrapped in single or double quotes
//// 
//// Examples:
//// text: "Label Text";
//// hintText: "Field Hint";
////
//.register('textQuotes', function(obj, name, value) {
//	if (name != 'text' && name != 'hintText') {
//		return false;
//	}
//	obj[name] = value.replace(/^("|')(.+)\1$/, '$2');
//	return false;
//})
////
//// Property Expander:
//// expand "padding" into paddingTop, paddingRight, paddingBottom, paddingLeft
//// (only available to Ti.UI.TextArea)
//// 
//// Examples:
//// padding: 5
////
//.register('padding', function(obj, name, value) {
//	if (name != 'padding') {
//		return false;
//	}
//	var paddings = value.split(/\s+/);
//	if (paddings.length == 1) {
//		paddings[1] = paddings[2] = paddings[3] = value;
//	}
//	else if (paddings.length == 2) {
//		paddings[2] = paddings[0];
//		paddings[3] = paddings[1];
//	}
//	else if (paddings.length == 3) {
//		paddings[3] = paddings[1];
//	}
//	
//	delete obj.padding;
//	obj.paddingTop = paddings[0];
//	obj.paddingRight = paddings[1];
//	obj.paddingBottom = paddings[2];
//	obj.paddingLeft = paddings[3];
//	return false;
//})
////
//// Property Expander:
//// allow dimensions and positions to be calculated
//// 
//// Examples:
//// top: 25% + 20;
//// width: 50% - 30;
////
//.register('calc', function(obj, name, value) {
//	if (!name.match(/^(top|right|bottom|left|height|width)$/)) {
//		// not one of our target properties
//		return false;
//	}
//	var match = value.match(/^calc\((.+)\)$/);
//	if (!match) {
//		// not a calc experssion
//		return false;
//	}
//	var calced = 0;
//	var operator = '+';
//	match[1].split(/([*\/+-])/).forEach(function(val, i) {
//		val = val.trim();
//		if (i%2) {
//			operator = val;
//			return;
//		}
//		if (name.match(/^(right|left|width)$/) && val.match(/%$/)) {
//			val = Math.round(Device.width * parseFloat(val) / 100);
//		}
//		else if (name.match(/^(top|bottom|height)$/) && val.match(/%$/)) {
//			val = Math.round(Device.height * parseFloat(val) / 100);
//		}
//		else {
//			val = parseFloat(val);
//		}
//		if (operator == '+') {
//			calced += val;
//		}
//		else if (operator == '-') {
//			calced -= val;
//		}
//		else if (operator == '*') {
//			calced *= val;
//		}
//		else if (operator == '/') {
//			calced /= val;
//		}
//	});
//	obj[name] = calced;
//	return true;
//});
///**
// * The plugin manager class for processing attributes
// * @class CSS.AttributeSelectorManager
// */
//CSS.AttributeSelectorManager = PluginManager.subclass({
//	/**
//	 * Determine if the given attribute string applies to this device
//	 * @method passes
//	 * 
//	 * @param {String} attributeString  Such as [platform=ios][formFactor=tablet]
//	 * @return {Boolean}  True if this device and OS possesses those attributes
//	 */
//	passes: function(attributeString) {
//		var pairs = attributeString.match(/(\[.+?\])/g);
//		if (!pairs) {
//			// CSS is doing something unexpected
//			return true;
//		}
//		var i;
//		var ilen = pairs.length;
//		var j;
//		var jlen = this.handlers.length;
//		var parts, attribute, operator, value;
//		for (i = 0; i < ilen; i++) {
//			// remove brackets and split on operator
//			parts = pairs[i].replace(/^\[(.+?)\]$/, '$1').split(/(~=|\|=|\^=|\$=|\*=|>=|<=|!=|>|<|=)/);
//			attribute = parts[0].trim();
//			// the operator like CSS:  =  ~=  |=  $=  *=
//			// OR equality like: >  <  >=  <=  !=
//			operator = parts[1];
//			// trim and remove quotes from value
//			value = parts[2].trim().replace(/^("|')?(.+?)\1$/, '$2');
//			for (j = 0; j < jlen; j++) {
//				if (this.handlers[j].handler.call(this, attribute, operator, value) === false) {
//					return false;
//				}
//			}
//		}
//		return true;
//	}
//});
////
//// Initialize the attribute processor
////
//CSS.attributeSelectors = new CSS.AttributeSelectorManager();
//CSS.attributeSelectors
////
//// Attribute processor:
//// Handle platform attribute. Known values are ios, android, blackberry
//// 
//// Examples:
//// .class[platform=ios] {}
//// #id[platform=android] {}
////
//.register('platform', function(attribute, operator, value) {
//	if (attribute != 'platform') {
//		return true;
//	}
//	return (value.toLowerCase() == Device.platform);
//})
////
//// Attribute processor:
//// Handle formFactor attribute. Known values are handheld, tablet
//// 
//// Examples:
//// .class[formFactor=handheld]
//// #id[formFactor=tablet]
////
//.register('formFactor', function(attribute, operator, value) {
//	if (attribute != 'formFactor') {
//		return true;
//	}
//	return (value.toLowerCase() == Device.formFactor);
//})
////
//// Attribute processor:
//// Handle size attributes: density, height, width, hardwareHeight, hardwareWidth
//// 
//// Examples:
//// .class[density >= 2]
//// #id[width < 960]
////
//.register('screenSizing', function(attribute, operator, value) {
//	var match = attribute.match(/^(density|hardwareHeight|height|hardwareWidth|width)$/);
//	if (!match) {
//		return true;
//	}
//	var size = parseFloat(value);
//	if (operator == '=' ) { return Device[attribute] === size; }
//	if (operator == '>' ) { return Device[attribute] > size; }
//	if (operator == '<' ) { return Device[attribute] < size; }
//	if (operator == '>=') { return Device[attribute] >= size; }
//	if (operator == '<=') { return Device[attribute] <= size; }
//	if (operator == '!=') { return Device[attribute] !== size; }	
//})
////
//// Attribute processor:
//// Handle version attribute
//// 
//// Examples:
//// .class[platform=ios][version >= 7]
//// #id[platform=android][version < 4.2]
////
//.register('version', function(attribute, operator, value) {
//	if (attribute != 'version') {
//		return true;
//	}
//	var comp = Device.versionCompare(value);
//	if (operator == '=' ) { return comp === 0; }
//	if (operator == '>' ) { return comp == -1; }
//	if (operator == '<' ) { return comp == 1; }
//	if (operator == '>=') { return comp >= 0; }
//	if (operator == '<=') { return comp <= 0; }
//	if (operator == '!=') { return comp !== 0; }
//	// invalid input
//	return false;
//});
////
//// Load any user-defined extensions stored in ingot/app/extensions/CSSExtension.js
////
//CSS.loadExtensions('CSS');

module.exports = StyleSheetCompiler;

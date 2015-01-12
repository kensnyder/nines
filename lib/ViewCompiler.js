"use strict";

var fs = require('fs');
var extend = require('extend');
var beautifier = require('js-beautify');

function beautify(code) {
	return beautifier.js_beautify(code, {
		indent_with_tabs: true,
		brace_style: 'end-expand',
		wrap_line_length: 160
	});
}

/**
 * Compile xml view templates and stylesheets into JavaScript
 * @class ViewCompiler
 */
function ViewCompiler() {
	this.initialize.apply(this, [].slice.call(arguments));
}

ViewCompiler.prototype = {
	
	initialize: function() {
		this.styleSheetCompiler = {
			apply: function(stylesheets, attributes) {
				var js = 'options = ';
				js += this._attributesToJs(attributes) + ';';
				// add conditionals based on media queries
				return js;
			},
			_attributesToJs: function(attributes) {
				var js = '{';
				var plainObject = [];
				for (var p in attributes) {
					plainObject.push('"' + p + '":' + attributes[p]);
				}
				js += plainObject.join(',\n');
				js += '}';
				return js;
			}
		};
	},
	
	compile: function(viewFile) {
		var self = this;
		var js = '';
		var uid = 1;
		var dependencies = [];
		var viewIds = [];
		var tagNames = [];
		var stylesheets = [];
		var currentTagName;
//		if (viewFile.indexOf('11') > -1) { console.log(JSON.stringify(this._tokenize(this._getFileContents(viewFile)))); }
		this._tokenize(this._getFileContents(viewFile)).forEach(function(token) {
			if (token.type == 'link' && token.rel == 'require') {
				dependencies.push('var ' + token.name + ' = require("' + token.href + '");');
			}
			else if (token.type == 'link' && token.rel == 'stylesheet') {
				stylesheets.push(token);
			}
			else if (token.type == 'openTag') {
				js += self.styleSheetCompiler.apply(stylesheets, token.attributes);
				js += 'var view' + uid + ' = Ti.UI.create' + token.tagName + '(options);';
				viewIds.push(uid);
				tagNames.push(token.tagName);
				if (uid > 1) {
					js += 'view' + viewIds[viewIds.length-2] + '.add(view' + viewIds[viewIds.length-1] + ');';					
				}
				uid++;
			}
			else if (token.type == 'text') {
				js += 'view' + viewIds[viewIds.length-1] + '.text = (view' + viewIds[viewIds.length-1] + '.text || "") + "' + token.value.replace(/^[\n\r\t]*(.+)[\n\r\t]*$/g, '$1') + '";';
			}
			else if (token.type == 'script') {
				if (token.value.match(/^[=-]/)) {
					js += 'view' + viewIds[viewIds.length-1] + '.text = (view' + viewIds[viewIds.length-1] + '.text || "") + (' + token.value.substring(1) + ');';					
				}
				else {
					js += token.value;
				}
			}
			else if (token.type == 'comment') {
				js += '\n/*' + token.value + '*/';
			}
			else if (token.type == 'closeTag') {
				currentTagName = tagNames.pop();
				if (currentTagName != token.tagName) {
					throw new Error('View Compiler: mismatched closing tag; saw `' + token.tagName + '` but expected `' + currentTagName + '`');
				}
				viewIds.pop();
			}
		});
		js = '/* Compiled from ' + viewFile + ' */\n' +
			dependencies.join("\n") +
			'module.exports = function ' + (viewFile.match(/([\w_]+)\.[^\/]+/) || ['',''])[1] + 'View() {' + 
			'var options;' +
			js +
			'return view1;};';
		js = beautify(js);
//		if (viewFile.indexOf('8') > -1) { console.log('***js***\n\n' + js); }
		return js;
	},
	
	_loadStylesheet: function(file) {
		this.stylesheetCompiler.add(file);
	},
	
	_getFileContents: function(viewFile) {
		try {
			return fs.readFileSync(viewFile, 'utf8');
		}
		catch (e) {
			throw new Error('XML template not found at `' + viewFile + '`');
		}
	},
	
	_splitOnTags: function(xml) {
		// remove xml declaration
		xml = xml.replace(/<\?.+?\?>/, '').trim(); 
		// split on comments, xml tags, or <% %> script tags
		return xml.split(/(<!\[CDATA\[[\s\S]+\]\]>|<!--[\s\S]+-->|<\/?\w[\s\S]+?(?:\w|\n|\t|\/|")>|<%[^>]+?%>)/).
			filter(function(s) {
				// filter out empty strings
				return s.trim() !== '';
			})
		;
	},
	
	_interpolateString: function(s) {
		var result;
		if (s.indexOf('<') === -1) {
			result = '"' + s + '"';
		}
		else {
			result = '(function(){var out="';
			s.split(/(<%.+?%>)/).forEach(function(v) {
				var match;
				if ((match = v.match(/<%[=-](.+)%>/))) {
					result += '"+(' + match[1].trim() + ')+"';
				}
				else if ((match = v.match(/<%(.+)%>/))) {
					result += '";' + match[1].trim() + 'out+="';
				}
				else {
					result += v;
				}
			});
			result += '";return out;}).call(this)';
//			console.log('_interpolate s=' + s);
//			console.log('interpolated = ' + result);
		}
		return result;
	},
	
	_extractAttributes: function(s) {
		var self = this;
		var attributes = {};
		s.replace(/\s([\w_-]+)\s*=\s*"([^"]+)"/g, function($0, $1, $2) {
			attributes[$1] = self._xmlEntityDecode(self._interpolateString($2));
		});
		return attributes;
	},
	
	_tokenize: function(xml) {
		var self = this;
		var tokens = [];
		this._splitOnTags(xml).forEach(function(token) {
			var match;
			if (
				(match = token.match(/^<!\[CDATA\[([\s\S]+)\]\]>$/)) ||
				(match = token.match(/^<!--([\s\S]+)-->$/))
			) {
				tokens.push({
					type: 'comment',
					value: match[1]
				});
			}
			else if ((match = token.match(/^<%([\s\S]+)%>$/))) {
				tokens.push({
					type: 'script',
					value: match[1].trim()
				});
			}
			else if ((match = token.match(/^<\/([\s\S]+)>/))) {
				tokens.push({
					type: 'closeTag',
					tagName: match[1].trim()
				});
			}
			else if ((match = token.match(/^<([\w_-]+)(?: ([\s\S]*?)|)(\/\s*)?>$/))) {
				var attributes = self._extractAttributes(' ' + match[2]);
				if (match[1] == 'link') {
					var attrObject = JSON.parse(self.styleSheetCompiler._attributesToJs(attributes));
					attrObject.type = 'link';
					tokens.push(attrObject);
				}
				else {
					tokens.push({
						type: 'openTag',
						tagName: match[1],
						attributes: attributes
					});
					if (match[3]) {
						tokens.push({
							type: 'closeTag',
							tagName: match[1]
						});
					}
				}
			}
			else {
				tokens.push({
					type: 'text',
					value: self._xmlEntityDecode(token)
				});
			}
		});
		return tokens;
	},
	
	_xmlEntityDecode: function(v) {
		return v.
			replace(/&amp;/g, '&').
			replace(/&quot;/g, '"').
			replace(/&apos;/g, "'").
			replace(/&lt;/g, '<').
			replace(/&gt;/g, '>')
		;
	}
	
};

module.exports = ViewCompiler;

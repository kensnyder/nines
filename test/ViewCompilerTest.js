"use strict";

var ViewCompiler = require('../lib/ViewCompiler');
var _ = require('lodash');
var vc = new ViewCompiler();
var basedir = __dirname + '/fixtures/views/';

function evalCompilation(code, data) {
	// from http://docs.appcelerator.com/titanium/latest/#!/api/Titanium.UI
	var viewTypes = ["View", "2DMatrix", "3DMatrix", "ActivityIndicator", "AlertDialog", "Animation", "Button", "ButtonBar", "DashboardItem", "DashboardView", "EmailDialog", "ImageView", "Label", "ListSection", "ListView", "MaskedImage", "Notification", "OptionDialog", "Picker", "PickerColumn", "PickerRow", "ProgressBar", "ScrollView", "ScrollableView", "SearchBar", "Slider", "Switch", "Tab", "TabGroup", "TableView", "TableViewRow", "TableViewSection", "TextArea", "TextField", "WebView", "Window"];
	var Ti = { UI: {} };
	viewTypes.forEach(function(type) {
		Ti.UI["create" + type] = function(options) {
			return {
				type: type,
				options: options,
				children: [],
				add: function(view) {
					this.children.push(view);
				}
			};
		};
	});
	function handleOptions(options) {
		return options;
	}
	function require() {}
	var module = {};
	eval(code);
	var root = module.exports.call(data);
	// stringify then parse to remove the "add" function
	return JSON.parse(JSON.stringify(root));
}

exports["Sanity test"] = function(test) {
	test.strictEqual(typeof ViewCompiler, 'function', 'class exists');
	test.done();
};

exports["_getFileContents"] = function(test) {
	test.strictEqual(
		vc._getFileContents(basedir + 'vc-test1.xml').replace(/\r/g, ''), 
		'<?xml version="1.0" encoding="UTF-8"?>\n<View />',
		'get contents'
	);
	test.done();
};

exports["_splitOnTags"] = function(test) {
	test.deepEqual(
		vc._splitOnTags(vc._getFileContents(basedir + 'vc-test1.xml')),
		['<View />'],
		'Split on tags'
	);
	test.deepEqual(
		vc._splitOnTags(vc._getFileContents(basedir + 'vc-test4.xml')),
		['<View foo="<%- this.bar %>">','<%- this.baz %>','</View>'],
		'Split on tags (with dynamic vals)'
	);
	test.deepEqual(
		vc._splitOnTags(vc._getFileContents(basedir + 'vc-test6.xml')),
		['<View a="1">','<TextArea b="2" />','</View>'],
		'Split on tags (nested)'
	);
	test.done();
};

exports["_interpolateString"] = function(test) {
	test.strictEqual(
		vc._interpolateString('foo'),
		'"foo"',
		'basic attribute'
	);
	test.strictEqual(
		new Function(
			'return ' + vc._interpolateString('<%- this.foo %>')
		).call({foo:'abc'}),
		'abc',
		'basic echo'
	);
	test.strictEqual(
		new Function(
			'return ' + vc._interpolateString('<%- this.foo.toUpperCase() %>')
		).call({foo:'abc'}),
		'ABC',
		'echo plus method'
	);
	test.strictEqual(
		new Function(
			'return ' + vc._interpolateString('<% if (this.foo) { %>bar<% } else { %>baz<% } %> qux')
		).call({foo:true}),
		'bar qux',
		'if statement in attribute'
	);
	test.done();
};

exports["_extractAttributes"] = function(test) {
	test.deepEqual(
		vc._extractAttributes(''),
		{},
		'empty attributes'
	);
	test.deepEqual(
		vc._extractAttributes(' a="b" c="d"'),
		{a:'"b"', c:'"d"'},
		'string attributes'
	);
	test.deepEqual(
		new Function(
			'bar',
			'return ' + vc.styleSheetCompiler._attributesToJs(vc._extractAttributes(' foo="<%- bar %>" x="5"'))
		)('abc'),
		{foo:"abc",x:"5"},
		'interpolated attributes'
	);
	test.done();
};

exports["_tokenize"] = function(test) {
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test1.xml')),
		[
			{type: 'openTag', tagName: 'View', attributes: {}},
			{type: 'closeTag', tagName: 'View'}
		],
		'tokenize a single tag'
	);
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test2.xml')),
		[
			{type: 'openTag', tagName: 'View', attributes: {a:'"b"'}},
			{type: 'closeTag', tagName: 'View'}
		],
		'tokenize a single tag'
	);
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test3.xml')),
		[
			{type: 'openTag', tagName: 'View', attributes: {a:'"b"'}},
			{type: 'text', value: 'foo '},
			{type: 'script', value: '- this.bar'},
			{type: 'closeTag', tagName: 'View'}
		],
		'tokenize open, text, script, close'
	);
	var t4 = vc._tokenize(vc._getFileContents(basedir + 'vc-test4.xml'));
	test.strictEqual(t4.length, 3, 'test 4.1');
	test.strictEqual(t4[0].type, 'openTag', 'test 4.2');
	test.strictEqual(t4[0].tagName, 'View', 'test 4.3');
	var attributes = [];
	for (var p in t4[0].attributes) {
		attributes.push('"'+p+'":'+t4[0].attributes[p]);
	}
	var dynamic = eval('(function() { var attr = {' + attributes.join(',') + '}; return attr; }).call({bar:"a"})');
	test.deepEqual(dynamic, {foo:'a'}, 'dynamic attribute');
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test5.xml')),
		[
			{type: 'openTag', tagName: 'Label', attributes: {a:'"b"'}},
			{type: 'text', value: 'Foo!'},
			{type: 'closeTag', tagName: 'Label'}
		],
		'tokenize open, text, script, close'
	);
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test6.xml')),
		[
			{type: 'openTag', tagName: 'View', attributes: {a:'"1"'}},
			{type: 'openTag', tagName: 'TextArea', attributes: {b:'"2"'}},
			{type: 'closeTag', tagName: 'TextArea'},
			{type: 'closeTag', tagName: 'View'}
		],
		'tokenize open, text, script, close'
	);
	test.deepEqual(
		vc._tokenize(vc._getFileContents(basedir + 'vc-test12.xml')),
		[
			{type: 'link', rel: 'stylesheet', href: 'main.iss'},
			{type: 'openTag', tagName: 'View', attributes: {}},
			{type: 'closeTag', tagName: 'View'}
		],
		'tokenize open, text, script, close'
	);
	test.done();
};

exports["Compile Single Tag"] = function(test) {
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test1.xml'), {}),
		{type:'View', options:{}, children:[]},
		'no attributes'
	);
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test2.xml'), {}),
		{type:'View', options:{a:"b"}, children:[]},
		'one attribute'
	);
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test5.xml'), {}),
		{type:'Label', options:{a:"b"}, children:[], text:"Foo!"},
		'one attribute, one text node'
	);
	test.done();
};	

exports["More Compiling"] = function(test) {
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test6.xml'), {}),
		{type:'View', options:{a:"1"}, children:[
			{type:'TextArea', options:{b:"2"}, children: []}
		]},
		'view within view'
	);
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test4.xml'), {bar:"a",baz:"b"}),
		{type:'View', options:{foo:"a"}, children:[], text:"b"},
		'one attribute, one text node, with variables'
	);
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test7.xml'), {alive:true}),
		{type:'View', options:{a:"1"}, children:[
			{type:'TextArea', options:{b:"2"}, children: [], text:'Alive'}
		]},
		'conditional text'
	);	
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test8.xml'), {editable:false}),
		{type:'View', options:{a:"1"}, children:[
			{type:'Label', options:{c:"3"}, children: []}
		]},
		'conditional views'
	);	
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test9.xml'), {
			"_": _,
			letters: ["A","B","C"]
		}),
		{type:'View', options:{}, children:[
			{type:'Label', options:{}, children: [], text:'Alphabet'},
			{type:'Label', options:{id:'1'}, children: [], text:'Letter A'},
			{type:'Label', options:{id:'2'}, children: [], text:'Letter B'},
			{type:'Label', options:{id:'3'}, children: [], text:'Letter C'},
			{type:'Label', options:{}, children: [], text:'The End'},
		]},
		'complex forEach'
	);	
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test10.xml'), {}),
		{type:'View', options:{}, children:[
			{type:'View', options:{}, children:[
				{type:'View', options:{}, children:[]}
			]},
			{type:'View', options:{}, children:[]}
		]},
		'three deep'
	);	
	test.done();
};

exports["Handling Comments"] = function(test) {
	test.deepEqual(
		evalCompilation(vc.compile(basedir + 'vc-test11.xml'), {}),
		{type:'View', options:{}, children:[
			{type:'View', options:{}, children:[
				{type:'View', options:{}, children:[]}
			]},
			{type:'View', options:{}, children:[]}
		]},
		'comments in there'
	);
	test.ok(
		vc.compile(basedir + 'vc-test11.xml').indexOf('/* This <View> is cool */') > -1,
		'<!-- --> style comments'
	);
	test.ok(
		vc.compile(basedir + 'vc-test11.xml').indexOf('/* This <View> is cooler */') > -1,
		'<![CDATA[ ]]> style comments'
	);
	test.done();
};

exports["Require links"] = function(test) {
	test.ok(
		vc.compile(basedir + 'vc-test13.xml').indexOf('var test = require("test.js");') > -1,
		'dependency injection'
	);
	test.done();
};

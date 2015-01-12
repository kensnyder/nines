"use strict";

var StyleSheetCompiler = require('../lib/StyleSheetCompiler');
var ss = new StyleSheetCompiler();

exports["initial test"] = function(test) {
	test.strictEqual(typeof StyleSheetCompiler, 'function', 'sanity check');
	test.done();
};

exports["split on symbols"] = function(test) {
	test.deepEqual(
		ss._splitOnSymbols('.a { }'),
		['.a','{','}'],
		'single selector'
	);
	test.deepEqual(
		ss._splitOnSymbols('.a { b:2; c: 3; }'),
		['.a','{','b:2',';','c: 3',';','}'],
		'single selector with properties'
	);
	test.deepEqual(
		ss._splitOnSymbols('.a, .b, #c {}'),
		['.a',',','.b',',','#c','{','}'],
		'single selector with properties'
	);
	test.done();
};

exports["tokenize"] = function(test) {
	test.deepEqual(
		ss._tokenize('.a { }'),
		[
			{type:'class', value:'a'},
			{type:'beginDeclarationBlock'},
			{type:'endDeclarationBlock'}
		],
		'single class'
	);
	test.deepEqual(
		ss._tokenize('#a { }'),
		[
			{type:'id', value:'a'},
			{type:'beginDeclarationBlock'},
			{type:'endDeclarationBlock'}
		],
		'single id'
	);
	test.deepEqual(
		ss._tokenize('#a { b:c }'),
		[
			{type:'id', value:'a'},
			{type:'beginDeclarationBlock'},
			{type:'property', name:'b', value:'c'},
			{type:'endDeclarationBlock'}
		],
		'single declaration block'
	);
	test.deepEqual(
		ss._tokenize('#a,.b{}'),
		[
			{type:'id', value:'a'},
			{type:'class', value:'b'},
			{type:'beginDeclarationBlock'},
			{type:'endDeclarationBlock'}
		],
		'single comma'
	);
	test.throws(
		ss._tokenize('#a,.b{'),
		Error,
		'syntax error'
	);
	test.deepEqual(
		ss._tokenize('@media (Device.platform == "ios") {}'),
		[
			{type:'mediaQuery', conditions:[
				'(Device.platform == "ios")'
			]},
			{type:'beginMediaQueryBlock'},
			{type:'endMediaQueryBlock'}
		],
		'one-condition media query'
	);	
	test.deepEqual(
		ss._tokenize('@media (Device.platform == "ios") and (Device.formFactor == "tablet") {}'),
		[
			{type:'mediaQuery', conditions:[
				'(Device.platform == "ios")',
				'(Device.formFactor == "tablet")'
			]},
			{type:'beginMediaQueryBlock'},
			{type:'endMediaQueryBlock'}
		],
		'two-condition media query'
	);	
	test.deepEqual(
		ss._tokenize('@media (Device.isPortrait()) {}'),
		[
			{type:'mediaQuery', conditions:[
				'(Device.isPortrait())'
			]},
			{type:'beginMediaQueryBlock'},
			{type:'endMediaQueryBlock'}
		],
		'media query condition containing parens'
	);	
	test.deepEqual(
		ss._tokenize('@media (Device.isPortrait()) { @media (Device.platform == "ios") { .a { b:c } } }'),
		[
			{type:'mediaQuery', conditions:[
				'(Device.isPortrait())'
			]},
			{type:'beginMediaQueryBlock'},
			{type:'mediaQuery', conditions:[
				'(Device.platform == "ios")'
			]},
			{type:'beginMediaQueryBlock'},
			{type:'class', value:'a'},
			{type:'beginDeclarationBlock'},
			{type:'property', name:'b', value:'c'},
			{type:'endDeclarationBlock'},
			{type:'endMediaQueryBlock'},
			{type:'endMediaQueryBlock'}
		],
		'nested media queries'
	);	
	test.done();
};

exports["compile"] = function(test) {
	test.deepEqual(
		ss.compile(__dirname + '/fixtures/stylesheets/ssc-test1.css').classes.a,
		{b: {name: 'b', value: 'c', conditions: []}},
		'single file'
	);
	test.deepEqual(
		ss.compile(__dirname + '/fixtures/stylesheets/ssc-test2.css').classes.a,
		{b: {name: 'b', value: 'c', conditions: ['(Device.getOrientation() == "portrait")']}},
		'single file'
	);
	test.done();
};



//
//exports["property expanding"] = function(test) {
//	var css = new CSS();
//	
//	test.strictEqual(typeof CSS.expanders.get('font'), 'function', 'ability to get property expanders by name');
//
//	// fonts
//	var expandFont = function(obj, name, val) {
//		var handler = CSS.expanders.get('font');
//		handler.call({fonts:{}}, obj, name, val);
//	};
//	
//	var item = {font:'18px', margin: '10px', 'float': 'left'};
//	expandFont(item, 'font', '18px');
//	test.deepEqual(item, {font:{fontSize:'18px'}, margin: '10px', 'float': 'left'});
//	
//	var item2 = {margin: '18px'};
//	expandFont(item2, 'margin', '18px');
//	test.deepEqual(item2, {margin: '18px'}, 'Expander for font properly handling non fonts');
//	
//	var parsedFont = {font: 'normal italic 16px Helvetica'};
//	expandFont(parsedFont, 'font', 'normal italic 16px Helvetica');
//	test.deepEqual(parsedFont, {font: {fontWeight: "normal", fontStyle: "italic", fontSize: "16px", fontFamily: 'Helvetica'}});
//	
//	var parsedFont2 = {font: '16px Helvetica'};
//	expandFont(parsedFont2, 'font', '16px Helvetica');
//	test.deepEqual(parsedFont2, {font: {fontSize: "16px", fontFamily: 'Helvetica'}}, 'Expander for font parsed font2 (just font-size and font-family) correctly');
//	
//	var parsedFont3 = {font: 'Helvetica, Arial, sans-serif'};
//	expandFont(parsedFont3, 'font', 'Helvetica, Arial, sans-serif');
//	test.deepEqual(parsedFont3, {font: {fontFamily: 'Helvetica, Arial, sans-serif'}}, 'Expander for font parsed font3 (just font-family) correctly');
//
//	// constants
//	var expandConst = CSS.expanders.get('constants');
//	
//	var nonTiConst = {margin: '16px', 'float': 'left'};
//	expandConst(nonTiConst, 'margin', '16px');
//	test.deepEqual(nonTiConst, {margin: '16px', 'float': 'left'}, 'the regex is not picking up non constants');
//	
//	var tiConst = {width: 'Ti.UI.FILL', margin: '20px'};
//	expandConst(tiConst, 'width', 'Ti.UI.FILL');
//	test.deepEqual(tiConst, {width: Ti.UI.FILL, margin: '20px'}, 'the regex is picking up Ti constants and converting');
//	
//	var tiAlignConst = {textAlign: 'Ti.UI.TEXT_ALIGNMENT_LEFT', margin: '20px'};
//	expandConst(tiAlignConst, 'textAlign', 'Ti.UI.TEXT_ALIGNMENT_LEFT');
//	test.deepEqual(tiAlignConst, {textAlign: Ti.UI.TEXT_ALIGNMENT_LEFT, margin: '20px'}, 'trying out text align constant');
//
//	// borders
//	var expandBorder = CSS.expanders.get('border');
//	
//	var nonBorder = {padding: '20px'};
//	expandBorder(nonBorder, 'font', 'italic');
//	test.deepEqual(nonBorder, {padding: '20px'}, '.border is not trying to expand non borders');
//	
//	var borderJustWidth = {border: '1'};
//	expandBorder(borderJustWidth, 'border', '1');
//	test.deepEqual(borderJustWidth, {borderWidth: "1"}, '.border is correctly expanding a border width');
//	
//	var borderWidthAndColor = {border: '2px #444444', margin: '12px'};
//	expandBorder(borderWidthAndColor, 'border', '2px #444444');
//	test.deepEqual(borderWidthAndColor, {borderWidth: "2px", borderColor: "#444444", margin: '12px'}, '.border is correctly expanding a border width and color');
//	
//	// text-transform
//	var expandTextTransform = CSS.expanders.get('textTransform');
//	
//	var uppercase = {text:'stuff that rocks', textTransform: 'uppercase'};
//	expandTextTransform(uppercase, 'textTransform', 'uppercase');
//	test.deepEqual(uppercase, {text:'STUFF THAT ROCKS'}, 'text-transform: uppercase');
//	
//	var lowercase = {text:'Stuff that rocks', textTransform: 'lowercase'};
//	expandTextTransform(lowercase, 'textTransform', 'lowercase');
//	test.deepEqual(lowercase, {text:'stuff that rocks'}, 'text-transform: lowercase');
//	
//	var capitalize = {text:'stuff that rocks', textTransform: 'capitalize'};
//	expandTextTransform(capitalize, 'textTransform', 'capitalize');
//	test.deepEqual(capitalize, {text:'Stuff That Rocks'}, 'text-transform: capitalize');
//
//	// using CSS.expanders.apply
//	var nonFontNonConstant = {margin: '16px 16px 5px 10px'};
//	CSS.expanders.apply(nonFontNonConstant);
//	test.deepEqual(nonFontNonConstant, {margin: '16px 16px 5px 10px'}, '_handleValue left non font and non constant alone');
//	var fontNonConstant = {font: 'bold italic 99px'};
//	CSS.expanders.apply(fontNonConstant);
//	test.deepEqual(fontNonConstant, {font: {fontWeight: 'bold', fontStyle: "italic", fontSize: "99px"}}, '_handleValue expanded font and .constant() didn\'t affect it');
//	var constantNonFont = {width: 'Ti.UI.SIZE'};
//	CSS.expanders.apply(constantNonFont);
//	test.deepEqual(constantNonFont, {width: Ti.UI.SIZE}, '_handleValue expanded constant and .font() didn\'t affect it');
//	
//	test.done();
//};
//
//exports["calc() property expander"] = function(test) {
//	var css = new CSS();
//	var oldDeviceWidth = Device.width;
//	var oldDeviceHeight = Device.height;
//	Device.width = 320;
//	Device.height = 480;	
//	var expander = CSS.expanders.get('calc');
//	var pct;
//	
//	pct = {width:'calc(50% - 20)'};
//	expander(pct, 'width', pct.width);
//	test.strictEqual(pct.width, Math.round(Device.width * 0.50) - 20, 'percent - px');
//	
//	pct = {left:'calc(20 + 50%)'};
//	expander(pct, 'left', pct.left);
//	test.strictEqual(pct.left, 20 + Math.round(Device.width * 0.50), 'px + percent');
//	
//	pct = {top:'calc(300 - 10%)'};
//	expander(pct, 'top', pct.top);
//	test.strictEqual(pct.top, 300 - Math.round(Device.height * 0.10), 'px - percent');
//	
//	pct = {top:'calc(300 - 10% / 2)'};
//	expander(pct, 'top', pct.top);
//	test.strictEqual(pct.top, Math.round((300 - Math.round(Device.height * 0.10)) / 2), 'px + percent / 2');
//	
//	Device.width = oldDeviceWidth;
//	Device.height = oldDeviceHeight;
//	
//	test.done();
//};
//
//exports["parsing css file"] = function(test) {
//
//	var css = new CSS();
//	test.strictEqual(typeof css._getFile, 'function', '_getFile is a method of css');
//
//	var testCSS1 = css._getFile('app/themes/test/styles/testCSS1.iss');
//	test.strictEqual(typeof testCSS1, 'string', 'file is a string');
//	test.strictEqual(testCSS1, 'abc', 'file contents correct');
//
//	var testCSS2 = css._getFile('app/themes/test/styles/testCSS2.iss');
//
//	test.strictEqual(typeof css._splitRight, 'function', '_splitRight is a method of css');
//
//	var splitRight = css._splitRight(testCSS2);
//	test.deepEqual(splitRight, [ '#Container {\n\tmargin: 12px;\n\theight: 50px;\n', '' ], 'splitting on right brace');
//
//	test.strictEqual(typeof css._splitMiddle, 'function', '_splitMiddle is a method of css');
//
//	var splitMiddle = css._splitMiddle(splitRight);
//	test.deepEqual(splitMiddle, [ [ '#Container ', '\n\tmargin: 12px;\n\theight: 50px;\n' ] ], 'split css selector and style declarations');
//
//	test.strictEqual(typeof css._getSelector, 'function', '_getSelector is a method of css');
//
//	var splitMiddleLength = splitMiddle.length;
//	for (var sMIdx = 0; sMIdx < splitMiddleLength; sMIdx++) {
//		var selector = css._getSelector(splitMiddle[sMIdx]);
//		test.strictEqual(selector, '#Container', 'got the CSS selector');
//	}
//
//	test.strictEqual(typeof css._camelize, 'function', '_camelize is a method of css');
//	var camelized = css._camelize('background-color');
//	test.strictEqual(camelized, 'backgroundColor', 'correctly camelizing dashed css properties');
//
//	test.strictEqual(typeof css._createObject, 'function', '_createObject is a method of css');
//
//	var cssObject = css._createObject(splitMiddle);
//	test.deepEqual(cssObject, {"#Container":{ "margin": "12px", "height": "50px"}}, 'CSS object created');
//
//	// more complex CSS files parsed using all-in-one method css._parseFile()
//	var cssTest3 = css._parseFile('app/themes/test/styles/testCSS3.iss');
//	test.deepEqual(cssTest3, {"#Gorilla": {"display": "inline-block", "height": "44px"}, ".selection": {"paddingTop": "10px", "paddingRight": "10px", "paddingBottom": "10px", "paddingLeft": "10px", "float": "left"}}, 'file three parsed with css.parse()');
//
//	var cssTest4 = css._parseFile('app/themes/test/styles/testCSS4.iss');
//	test.deepEqual(cssTest4, {"#desk": {color: "#FFFFFF", width: "350px", height: "200px"}, ".chair": {font: {fontWeight: "bold", fontSize: "16px"}, color: "#222222"}, ".book": {width: "12px", height: "33px", paddingTop: "10px", paddingRight: "10px", paddingBottom: "10px", paddingLeft: "10px", margin: "2px 8px 10px 8px"}}, 'file four parsed with css.parse()');
//
//	// removing comments
//	var cssWithComments = css._getFile('app/themes/test/styles/testWithComments.iss');
//	test.strictEqual(cssWithComments, '\n.and {\n\twidth: 10;\n\theight: 40;\n}\n\n', 'comments stripped');
//
//	test.done();
//};
//
//exports["load file"] = function(test) {
//	var css = new CSS();
//
//	test.strictEqual(typeof css.loadFile, 'function', 'loadFile is a method of CSS');
//	test.strictEqual(typeof css.styles, 'object', 'CSS.styles is initialized');
//
//	css.loadFile('app/themes/test/styles/testCSS5.iss');
//	test.deepEqual(css.styles, {"#Window": {"opacity": "0", "display": "inline"}, ".door": {"opacity": ".1", "paddingTop": "25px", "paddingRight": "25px", "paddingBottom": "25px", "paddingLeft": "25px", "backgroundColor": "#FFFFFF"}});
//
//	css.loadFile('app/themes/test/styles/testCSS6.iss');
//	test.deepEqual(css.styles, {"#Window": {"opacity": "1", "display": "inline", "color": "#555555"}, ".door": {"opacity": ".1", "paddingTop": "30px", "paddingRight": "30px", "paddingBottom": "30px", "paddingLeft": "30px", "backgroundColor": "#FFFFFF", "height": "20px"}, ".floor": {"width": "100%", "height": "0", "backgroundColor": "#DDDDDD", "font": {"fontWeight": "normal", "fontStyle": "italic", "fontSize": "16px", "fontFamily": "Helvetica"}}});
//
//	test.done();
//};
//
//exports["2 same classes in one file"] = function(test) {
//
//	var css = new CSS();
//
//	css.loadFile('app/themes/test/styles/testCSS5-double.iss');
//	test.deepEqual(css.styles, {".door": {"opacity": ".1", "paddingTop": "25px", "paddingRight": "25px", "paddingBottom": "25px", "paddingLeft": "25px", "backgroundColor": "#FFFFFF"}});
//
//	test.done();
//};
//
//exports["applying styles"] = function(test) {
//	var css = new CSS();
//
//	test.strictEqual(typeof css._getValuesForId, 'function', '_getValuesId is a method of CSS');
//	css.loadFile('app/themes/test/styles/testCSS6.iss');
//	var idStyles = css._getValuesForId('Window');
//	test.deepEqual(idStyles, {"opacity": "1", "color": "#555555"});
//	css.styles = {};	
//
//	css.loadFile('app/themes/test/styles/testCSS6.iss');
//	test.strictEqual(typeof css._getValuesForClassNames, 'function', '_getValuesForClassNames is a method of CSS');
//	var classStyles = css._getValuesForClassNames(['door', 'floor']);
//	test.deepEqual(classStyles, {"paddingTop": "30px", "paddingRight": "30px", "paddingBottom": "30px", "paddingLeft": "30px", "width": "100%", "height": "0", "backgroundColor": "#DDDDDD", "font": {"fontWeight": "normal", "fontStyle": "italic", "fontSize": "16px", "fontFamily": "Helvetica"}});
//	css.styles = {};
//
//	css.loadFile('app/themes/test/styles/testCSS6b.iss');
//	test.strictEqual(typeof css.applyStyles, 'function', 'applyStyles is a method of CSS');
//	var attrValues = {"opacity": ".5", "paddingTop": "0", "paddingRight": "0", "paddingBottom": "0", "paddingLeft": "0", "backgroundColor": "#FFFF00"};
//	var id = "Window";
//	var classNames = ['door', 'floor'];
//	var attributeValues = css.applyStyles(attrValues, id, classNames);
//	test.deepEqual(attributeValues, {"opacity": ".5", "paddingTop": "0", "paddingRight": "0", "paddingBottom": "0", "paddingLeft": "0", "backgroundColor": "#FFFF00", "height": "0", "width": "100%", "font": {"fontSize": "16px", "fontFamily": "TradeGothic LT"}, "color": "#555555"}, 'styles applied with correct cascading rules - Gothic expanded to TradeGothic LT');
//	css.styles = {};
//	
//	test.done();
//	
//};
//
// exports["applying styles with quotation values"] = function(test) {
//	var css = new CSS();
//	
//	css.loadFile('app/themes/test/styles/testCSS7.iss');
//	test.deepEqual(css.styles, {
//		'.enter_intel': {"hintText": "double quoted"},
//		'.label': {'text':'single quoted'}
//	}, 'testing hintText attribute');
//
//	test.done();
//};
//
//exports["Attribute selectors"] = function(test) {
//	
//	Device.platform = 'ios';
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=android]'), false);
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=ios]'), true);
//	
//	Device.platform = 'android';
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=android]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=ios]'), false);
//		
//	Device.formFactor = 'handheld';
//	test.strictEqual(CSS.attributeSelectors.passes('[formFactor=handheld]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[formFactor=mini]'), false);
//	test.strictEqual(CSS.attributeSelectors.passes('[formFactor=tablet]'), false);
//	
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=android][formFactor=handheld]'), true);	
//	test.strictEqual(CSS.attributeSelectors.passes('[platform=android][formFactor=tablet]'), false);	
//	
//	test.done();
//};
//
//exports["Android only declarations"] = function(test) {
//	var css = new CSS();
//	Device.platform = 'ios';
//	css.loadFile('app/themes/test/styles/testCSS8-android.iss');
//	test.deepEqual(css.styles, {});
//	
//	Device.platform = 'android';
//	css.loadFile('app/themes/test/styles/testCSS8-android.iss');
//	test.deepEqual(css.styles, {'.foo':{'android':'only'}});
//		
//	Device.platform = 'ios';
//	test.done();
//};
//
//exports["iOS only declarations"] = function(test) {
//	var css = new CSS();
//	Device.platform = 'android';
//	css.loadFile('app/themes/test/styles/testCSS8-ios.iss');
//	test.deepEqual(css.styles, {});
//	
//	Device.platform = 'ios';
//	css.loadFile('app/themes/test/styles/testCSS8-ios.iss');
//	test.deepEqual(css.styles, {'.foo':{'ios':'only'}});
//		
//	test.done();
//};
//
//exports["handheld only declarations"] = function(test) {
//	var css = new CSS();
//	Device.formFactor = 'tablet';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld.iss');
//	test.deepEqual(css.styles, {});
//	
//	Device.formFactor = 'handheld';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld.iss');
//	test.deepEqual(css.styles, {'.foo':{'handheld':'only'}});
//		
//	test.done();
//};
//
//exports["handheld + ios only declarations"] = function(test) {
//	var css = new CSS();
//	Device.platform = 'android';
//	Device.formFactor = 'tablet';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld-plus-ios.iss');
//	test.deepEqual(css.styles, {}, 'tablet + android should not match');
//	
//	Device.platform = 'ios';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld-plus-ios.iss');
//	test.deepEqual(css.styles, {}, 'tablet + ios should not match');
//	
//	Device.formFactor = 'handheld';
//	Device.platform = 'android';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld-plus-ios.iss');
//	test.deepEqual(css.styles, {}, 'handheld + android should not match');
//
//	
//	Device.platform = 'ios';
//	css.loadFile('app/themes/test/styles/testCSS8-handheld-plus-ios.iss');
//	test.deepEqual(css.styles, {'.foo':{'handheldIos':'only'}}, 'handheld + ios should match');
//		
//	test.done();
//};
//exports["version declarations"] = function(test) {
//	var css = new CSS();
//	Device.version.full = '6.1';
//	css.loadFile('app/themes/test/styles/testCSS8-versions.iss');
//	test.deepEqual(css.styles, {});
//		
//	Device.version.full = '7.0';
//	css.loadFile('app/themes/test/styles/testCSS8-versions.iss');
//	test.deepEqual(css.styles, {'.foo':{ios7:'only'}});
//	
//	test.done();
//};
//
//exports["density attribute"] = function(test) {
//	Device.density = 1;
//	test.strictEqual(CSS.attributeSelectors.passes('[density=1]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[density=2]'), false);		
//
//	Device.density = 2;
//	test.strictEqual(CSS.attributeSelectors.passes('[density>1.5]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[density>=1.5]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[density>3]'), false);		
//	test.strictEqual(CSS.attributeSelectors.passes('[density>=3]'), false);		
//	test.done();
//};
//
//exports["width attribute"] = function(test) {
//	Device.width = 768;
//	test.strictEqual(CSS.attributeSelectors.passes('[width=768]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[width>560]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[width>=560]'), true);
//	test.strictEqual(CSS.attributeSelectors.passes('[width>1080]'), false);		
//	test.strictEqual(CSS.attributeSelectors.passes('[width>=1080]'), false);		
//	test.done();
//};
//
//exports["Comma-separated matchers - attribute selectors"] = function(test) {
//	var css = new CSS();
//	
//	Device.formFactor = 'tablet';
//	css.loadFile('app/themes/test/styles/testCSS9-commas1.iss');
//	test.deepEqual(css.styles, {'.foo':{'tab':'only'}});
//	
//	test.done();
//};
//
//exports["Comma-separated matchers - two separate classes"] = function(test) {
//	var css = new CSS();
//	
//	Device.formFactor = 'tablet';
//	css.loadFile('app/themes/test/styles/testCSS9-commas2.iss');
//	test.deepEqual(css.styles, {
//		'.foo':{'attr':'value'},
//		'.bar':{'attr':'value'}
//	});
//	
//	test.done();
//};
//
//exports["Comma-separated matchers - two separate classes"] = function(test) {
//	var css = new CSS();
//	
//	Device.formFactor = 'tablet';
//	css.loadFile('app/themes/test/styles/testCSS9-commas3.iss');
//	test.deepEqual(css.styles, {
//		'.foo':{'attr1':'value1', 'attr2':'value2'},
//		'.bar':{'attr2':'value2'}
//	});
//	
//	test.done();
//};
//
//// restor our old Device object
//for (var attr in oldDevice) {
//	if (typeof oldDevice[attr] != 'function') {
//		Device[attr] = oldDevice[attr];
//	}
//}

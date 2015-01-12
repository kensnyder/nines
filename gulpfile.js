var gulp = require('gulp');

var nodeunit = require('gulp-nodeunit-runner');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');

gulp.task('lint', function() {
    return gulp.src([
			'gruntfile.js',
			'lib/**/*.js',
			'test/**/*.js'
		])
        .pipe(jshint({
			curly: true,
			eqeqeq: false,
			immed: true,
			latedef: true,
			newcap: true,
			noarg: true,
			sub: true,
			undef: true,
			boss: true,
			eqnull: true,
			browser: true,
			devel: true,
			smarttabs: true,
			node: true, // allows "use strict"; at top level of files
			loopfunc: true, // allows defining functions in a forEach or for loop
			evil: true, // allows `new Function()` constructors and `eval` used by ViewCompiler
			withstmt: true, // allows `with` used by ViewCompiler
			globals: {
				Ti: true,
				module: true,
				Titanium: true,
				require: true
			}
		}))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('test', function taskTest() {
	return gulp.src("./test/**/*.js")
		.pipe(nodeunit({
			reporter: 'minimal'
		}));
});

gulp.task('watch', function() {
    gulp.watch(
		[
			'lib/**/*.js',
			'test/**/*.js',
			'test/fixtures/stylesheets/**/*.css',
			'test/fixtures/views/**/*.xml'
		],
		['test']
	);
    gulp.watch(
		[
			'gruntfile.js',
			'lib/**/*.js',
			'test/**/*.js'
		],
		['lint']
	);
});
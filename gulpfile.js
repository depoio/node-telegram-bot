var gulp = require('gulp')
  , mocha = require('gulp-mocha')
  , shell = require('gulp-shell')
  , ghpages = require('gh-pages')
  , path = require('path');

gulp.task('test', function () {
  return gulp.src('test/index.js', { read: false })
      .pipe(mocha({reporter: 'spec'}));
});

gulp.task('doc', shell.task([
  './node_modules/jsdoc/jsdoc.js lib/*.js -d doc -t ./node_modules/ink-docstrap/template -c jsdoc.conf.json'
]));

gulp.task('publish', ['doc'], function () {
  ghpages.publish(path.join(__dirname, 'doc'), console.error);
});

gulp.task('default');
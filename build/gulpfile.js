'use strict';

const gulp = require('gulp');
const zip = require('gulp-zip');
const del = require('del');
const install = require('gulp-install');
const runSequence = require('run-sequence');
const awsLambda = require('node-aws-lambda');
const jasmine = require('gulp-jasmine');

const BASE_DIR = '..';
const SRC_DIR = BASE_DIR + '/src';
const NO_COMMIT = '_no_commit';
const NO_COMMIT_DIR = BASE_DIR + '/' + NO_COMMIT;
const TEST = 'tests';
const TEST_DIR = BASE_DIR + '/' + TEST;
const DIST_DIR = 'dist';
const ZIPFILE_NAME = 'dist.zip';

// BUILDMODE can change depending on parmeters
let BUILDMODE = 'test';
let BUILD_DIR = DIST_DIR + '_' + BUILDMODE;

gulp.task('clean', () => {
  return del(['dist*/'], {force: true});
});

gulp.task('src', () => {
  return gulp.src([BASE_DIR + '/index.js',
      SRC_DIR + '/**/*.js',
      NO_COMMIT_DIR + '/**/*.js*',
      TEST_DIR + '/**/*.js',
      '!' + SRC_DIR + '/interaction-model/**'],
      { base : BASE_DIR} )
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('node_modules', () => {
  return gulp.src(BASE_DIR + '/package.json')
    .pipe(gulp.dest(BUILD_DIR))
    .pipe(install({production: true}));
});

gulp.task('jasmine', (callback) => {
  return gulp.src([BUILD_DIR + '/' + TEST + '/**/*.js'])
    .pipe(jasmine());
});

gulp.task('zip', function() {
  return gulp.src([
      BUILD_DIR + '/**/*',
      '!' + BUILD_DIR + '/package.json',
      '!' + BUILD_DIR + '/' + TEST + '/**/*'],
      { nodir : true } // a workaround for deploying to lambda from windows
      // https://github.com/sindresorhus/gulp-zip/issues/64
    )
    .pipe(zip(ZIPFILE_NAME))
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('upload-test', function(callback) {
  let LAMBDA_CONFIG = require(NO_COMMIT_DIR + '/lambda-config.json');
  LAMBDA_CONFIG.functionName = LAMBDA_CONFIG.functionName + 'Test';
  awsLambda.deploy(BUILD_DIR + '/' + ZIPFILE_NAME, LAMBDA_CONFIG , callback);
});

gulp.task('upload-production', function(callback) {
  let LAMBDA_CONFIG = require(NO_COMMIT_DIR + '/lambda-config.json');
  awsLambda.deploy(BUILD_DIR + '/' + ZIPFILE_NAME, LAMBDA_CONFIG, callback);
});

gulp.task('deploy-test', callback => {
  return runSequence(['clean'],
    ['src'],
    ['node_modules'],
    ['jasmine'],
    ['zip'],
    ['upload-test'],
    callback);
});

gulp.task('deploy-production', callback => {
  BUILDMODE = 'production';
  BUILD_DIR = DIST_DIR + '_' + BUILDMODE;
  return runSequence(['clean'],
    ['src'],
    ['node_modules'],
    ['jasmine'],
    ['zip'],
    ['upload-production'],
    callback);
});

gulp.task('default', ['deploy-test']);

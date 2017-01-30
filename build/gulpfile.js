'use strict';

const gulp = require('gulp');
const zip = require('gulp-zip');
const del = require('del');
const install = require('gulp-install');
const runSequence = require('run-sequence');
const awsLambda = require('node-aws-lambda');
const jasmine = require('gulp-jasmine');
const argv = require('yargs').argv;

const BASE_DIR = '..';
const SRC_DIR = BASE_DIR + '/src';
const CONFIG = 'config';
const BASE_CONFIG_DIR = BASE_DIR + '/' + CONFIG;
const TESTS = 'tests';
const TESTS_DIR = BASE_DIR + '/' + TESTS;
const DIST_DIR = 'dist';
const ZIPFILE_NAME = 'dist';
const ZIPFILE_EXTENSION = '.zip';

const BUILDMODE = argv.production ? 'production' : 'test';
const BUILD_DIR = DIST_DIR + '_' + BUILDMODE;
const CONFIG_DIR = BASE_CONFIG_DIR + '/' + BUILDMODE;
const BUILD_CONFIG_DIR = BUILD_DIR + '/config';
const ZIP_NAME = ZIPFILE_NAME + '_' + BUILDMODE + ZIPFILE_EXTENSION;


console.log('\n\n\n*********\nBuilding ' + BUILDMODE + '\n*********\n');

gulp.task('clean', () => {
  return del([BUILD_DIR], {force: true});
});

gulp.task('src', () => {
  return gulp.src([BASE_DIR + '/index.js',
      SRC_DIR + '/**/*.js',
      TESTS_DIR + '/**/*.js',
      '!' + SRC_DIR + '/interaction-model/**'],
      { base : BASE_DIR} )
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('config_src', () => {
  return gulp.src([CONFIG_DIR + '/*.json'])
    .pipe(gulp.dest(BUILD_CONFIG_DIR));
});

gulp.task('node_modules', () => {
  return gulp.src(BASE_DIR + '/package.json')
    .pipe(gulp.dest(BUILD_DIR))
    .pipe(install({production: true}));
});

gulp.task('jasmine', (callback) => {
  return gulp.src([BUILD_DIR + '/' + TESTS + '/**/*.js'])
    .pipe(jasmine());
});

gulp.task('zipfile', function() {
  return gulp.src([
      BUILD_DIR + '/**/*',
      '!' + BUILD_DIR + '/package.json',
      '!' + BUILD_DIR + '/' + TESTS + '/**/*'],
      { nodir : true } // a workaround for deploying to lambda from windows
      // https://github.com/sindresorhus/gulp-zip/issues/64
    )
    .pipe(zip(ZIP_NAME))
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('upload', function(callback) {
  let LAMBDA_CONFIG = require(CONFIG_DIR + '/lambda-config.json');
  awsLambda.deploy(BUILD_DIR + '/' + ZIP_NAME, LAMBDA_CONFIG , callback);
});

gulp.task('zip', callback => {
  return runSequence(['clean'],
    ['src'],
    ['config_src'],
    ['node_modules'],
    ['jasmine'],
    ['zipfile'],
    callback);
});

gulp.task('deploy', callback => {
  return runSequence(['zip'],
    ['upload'],
    callback);
});

gulp.task('default', ['zip']);
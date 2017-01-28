'use strict';

const gulp = require('gulp');
const del = require('del');
const runSequence = require('run-sequence');
const argv = require('yargs').argv;

const BASE_DIR = '..';
const PROJECT_DIR = '../../..';
const BUILD_FOLDER = 'dist';
const CONFIG = 'config';

const BUILDMODE = argv.production ? 'production' : 'test';
const BUILD_DIR = BUILD_FOLDER + '_' + BUILDMODE;
const BUILD_CONFIG_DIR = BUILD_DIR + '/' + CONFIG;
const CONFIG_DIR = PROJECT_DIR + '/' + CONFIG + '/' + BUILDMODE;

gulp.task('clean', () => {
  return del([BUILD_FOLDER + '*/'], {force: true});
});

gulp.task('src', () => {
  return gulp.src([BASE_DIR + '/index.js'])
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('config_src', () => {
  return gulp.src([CONFIG_DIR + '/firebase-config.json',
    CONFIG_DIR + '/music-player*.json'])
    .pipe(gulp.dest(BUILD_CONFIG_DIR));
});

gulp.task('default', callback => {
  return runSequence(['clean'],
    ['src'],
    ['config_src'],
    callback);
});

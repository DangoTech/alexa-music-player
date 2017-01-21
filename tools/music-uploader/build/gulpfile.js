'use strict';

const gulp = require('gulp');
const del = require('del');
const runSequence = require('run-sequence');

const BASE_DIR = '..';
const PROJECT_DIR = '../../..';
const BUILD_FOLDER = 'uploader';
const BUILD_DIR = BUILD_FOLDER;
const CONFIG = 'config';
const BUILD_CONFIG_DIR = BUILD_DIR + '/' + CONFIG;

let BUILDMODE = 'test';
let CONFIG_DIR = PROJECT_DIR + '/' + CONFIG + '/' + BUILDMODE;

gulp.task('clean', () => {
  return del([BUILD_DIR], {force: true});
});

gulp.task('src', () => {
  return gulp.src([BASE_DIR + '/index.js'])
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('config_src', () => {
  return gulp.src([CONFIG_DIR + '/firebase-config.json'])
    .pipe(gulp.dest(BUILD_CONFIG_DIR));
});

gulp.task('default', callback => {
  return runSequence(['clean'],
    ['src'],
    ['config_src'],
    callback);
});

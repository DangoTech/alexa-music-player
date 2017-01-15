"use strict";

let gulp = require('gulp');
let zip = require('gulp-zip');
let del = require('del');
let install = require('gulp-install');
let runSequence = require('run-sequence');
let awsLambda = require("node-aws-lambda");

let config = require("./lambda-config.js");

let BASE_DIR = "..";
let SRC_DIR = BASE_DIR + "/src";
let DIST_DIR = "dist";
let ZIPFILE_NAME = "dist.zip";
let BUILDMODE = "test";
let BUILD_DIR = DIST_DIR + '_' + BUILDMODE;

gulp.task('clean', () => {
    return del(['dist', 'dist_test', 'dist_production'], {force: true});
});

gulp.task('src', () => {
    return gulp.src([SRC_DIR + '/**/*.js', SRC_DIR + '/AppInfo.json'])
        .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('node_modules', () => {
    return gulp.src(BASE_DIR + '/package.json')
        .pipe(gulp.dest(BUILD_DIR))
        .pipe(install({production: true}));
});

gulp.task('zip', function() {
    return gulp.src([
            BUILD_DIR + '/**/*',
            '!' + BUILD_DIR + '/package.json'],
            { nodir : true } // a workaround for deploying to lambda from windows
            // https://github.com/sindresorhus/gulp-zip/issues/64
        )
        .pipe(zip(ZIPFILE_NAME))
        .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('upload-test', function(callback) {
    config.functionName = config.functionName + "Test";
    awsLambda.deploy(BUILD_DIR + '/' + ZIPFILE_NAME, config , callback);
});

gulp.task('upload-production', function(callback) {
    awsLambda.deploy(BUILD_DIR + '/' + ZIPFILE_NAME, config, callback);
});

gulp.task('deploy-test', callback => {
    return runSequence(['clean'],
        ['src'],
        ['node_modules'],
        ['zip'],
        ['upload-test'],
        callback);
});

gulp.task('deploy-production', callback => {
    BUILDMODE = "production";
    BUILD_DIR = DIST_DIR + '_' + BUILDMODE;
    return runSequence(['clean'],
        ['src'],
        ['node_modules'],
        ['zip'],
        ['upload-production'],
        callback);
});

gulp.task('default', ['deploy-test']);

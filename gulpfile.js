let gulp = require('gulp');
let ts = require('gulp-typescript');
let tsProject = ts.createProject('tsconfig.json');

gulp.task('watch', () => {
    gulp.watch('src/**/*.ts', ['compile']);
});

gulp.task('compile', () => {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest('built'));
});

gulp.task('default', ['compile']);
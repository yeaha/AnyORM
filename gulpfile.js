const gulp = require("gulp");
const ts = require("gulp-typescript");
const ava = require("gulp-ava");
const _ = require("lodash");

gulp.task("watch", () => {
    gulp.watch(["src/**/*.ts", "tests/**/*.ts"], ["compile"]);
});

gulp.task("watch:test", () => {
    gulp.watch("./built/tests/**/*.js", _.debounce(() => {
        gulp.start("test");
    }), 3000);
});

gulp.task("test", () => {
    gulp.src("./built/tests").pipe(ava({ verbose: true }));
});

gulp.task("compile", () => {
    let tsProject = ts.createProject("tsconfig.json");

    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest("built"));
});

gulp.task("default", ["compile"]);

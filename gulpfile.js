const gulp = require("gulp");
const ts = require("gulp-typescript");
const _ = require("lodash");

gulp.task("compile:watch", () => {
    gulp.watch(["src/**/*.ts", "tests/**/*.ts"], ["compile"]);
});

gulp.task("compile", () => {
    let tsProject = ts.createProject("tsconfig.json");

    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest("built"));
});

gulp.task("default", ["compile"]);

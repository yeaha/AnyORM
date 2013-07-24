exports.Expr = Expr;

function Expr(expr) {
    if (expr instanceof Expr)
        expr = Expr.toString();

    this.expr = expr;
}

Expr.prototype.toString = function() {
    return this.expr;
};

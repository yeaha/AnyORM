import test from "ava";
import { UnexpectPropertyValueError } from "../src/error";
import * as Type from "../src/type";

test("normalize attribute", (t) => {
    let attribute: Type.AttributeOptions = { type: "foobar" };
    attribute = Type.normalizeAttribute(attribute);

    t.is(attribute.nullable, false);
    t.is(attribute.primary, false);
    t.is(attribute.default, null);
    t.is(attribute.protected, false);
    t.is(attribute.strict, false);
    t.is(attribute.refuseUpdate, false);
});

test("normalize primary attribute", (t) => {
    let attribute: Type.AttributeOptions = { primary: true };
    attribute = Type.normalizeAttribute(attribute);

    t.is(attribute.protected, true);
    t.is(attribute.strict, true);
    t.is(attribute.refuseUpdate, true);
});

test("Type.get()", (t) => {
    t.true(Type.get("foobar") instanceof Type.Any);
    t.true(Type.get("numeric") instanceof Type.Numeric);
    t.true(Type.get("integer") instanceof Type.Integer);
    t.true(Type.get("text") instanceof Type.Text);
});

// Numeric type
(() => {
    let attribute: Type.Attribute = Type.normalizeAttribute({ type: "numeric" });
    let type = Type.get("numeric");

    test("Numeric.normalize()", (t) => {
        t.is(type.normalize(1.23, attribute), 1.23);
        t.is(type.normalize("1.10", attribute), 1.1);
    });

    test("Numeric.store()", (t) => {
        t.is(type.store(1, attribute), 1);
        t.is(type.store(null, attribute), null);
        t.is(type.store("", attribute), null);
    });

    test("Numeric.retrieve()", (t) => {
        t.is(type.retrieve(1, attribute), 1);
        t.is(type.retrieve("0", attribute), 0);
        t.is(type.retrieve(null, attribute), null);
        t.is(type.retrieve("", attribute), null);
    });

    test("Numeric.normalize() unexpect value", (t) => {
        t.throws(() => {
            type.normalize(Infinity, attribute);
        }, UnexpectPropertyValueError);

        t.throws(() => {
            type.normalize("a", attribute);
        }, UnexpectPropertyValueError);
    });
})();

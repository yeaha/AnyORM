import * as Type from "../src/type";
import { UnexpectPropertyValueError } from "../src/error";
import * as assert from "assert";

describe("Normalize Attribute", () => {
    it("default", () => {
        let attribute: Type.AttributeOption = { type: 'foobar' };
        attribute = Type.normalizeAttribute(attribute);

        assert.strictEqual(attribute.allowNull, false);
        assert.strictEqual(attribute.primaryKey, false);
        assert.strictEqual(attribute.default, null);
        assert.strictEqual(attribute.protected, false);
        assert.strictEqual(attribute.strict, false);
        assert.strictEqual(attribute.refuseUpdate, false);
    });

    it('primary key', () => {
        let attribute: Type.AttributeOption = { type: 'any', primaryKey: true };
        attribute = Type.normalizeAttribute(attribute);

        assert.strictEqual(attribute.protected, true);
        assert.strictEqual(attribute.strict, true);
        assert.strictEqual(attribute.refuseUpdate, true);
    });
});

describe("Get Type", () => {
    it("default", () => {
        assert.ok(Type.get('foobar') instanceof Type.Any);
        assert.ok(Type.get('numeric') instanceof Type.Numeric);
        assert.ok(Type.get('integer') instanceof Type.Integer);
        assert.ok(Type.get('text') instanceof Type.Text);
    });
});

describe("Numeric Type", () => {
    let attribute: Type.Attribute = Type.normalizeAttribute({ type: 'numeric' });
    let type = Type.get('numeric');

    it("normalize", () => {
        assert.strictEqual(type.normalize(1.23, attribute), 1.23);
        assert.strictEqual(type.normalize('1.10', attribute), 1.10);
    });

    it("store", () => {
        assert.strictEqual(type.store(1, attribute), 1);
        assert.strictEqual(type.store(null, attribute), null);
        assert.strictEqual(type.store('', attribute), null);
    });

    it("retrieve", () => {
        assert.strictEqual(type.retrieve(1, attribute), 1);
        assert.strictEqual(type.retrieve('0', attribute), 0);
        assert.strictEqual(type.retrieve(null, attribute), null);
        assert.strictEqual(type.retrieve("", attribute), null);
    });

    it("normalize unexpect value", () => {
        try {
            type.normalize(Infinity, attribute);
        } catch (e) {
            assert.ok(e instanceof UnexpectPropertyValueError);
        }

        try {
            type.normalize('a', attribute);
        } catch (e) {
            assert.ok(e instanceof UnexpectPropertyValueError);
        }
    });
});
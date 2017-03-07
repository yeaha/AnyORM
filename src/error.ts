export class UnexpectPropertyValueError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, UnexpectPropertyValueError.prototype);
    }
}

export class UndefinedPropertyError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, UndefinedPropertyError.prototype);
    }
}

export class PropertyError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, PropertyError.prototype);
    }
}
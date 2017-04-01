export class DataNotFoundError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, DataNotFoundError.prototype);
    }
}

export class UnexpectColumnValueError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, UnexpectColumnValueError.prototype);
    }
}

export class UndefinedColumnError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, UndefinedColumnError.prototype);
    }
}

export class RefuseUpdateColumnError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, RefuseUpdateColumnError.prototype);
    }
}

export class PropertyError extends Error {
    constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, PropertyError.prototype);
    }
}

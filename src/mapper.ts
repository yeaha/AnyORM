// import * as _ from "lodash";
import { ColumnInterface } from "./column";
import { Data } from "./data";
import { UndefinedColumnError, UnexpectColumnValueError } from "./error";

export type Columns = Map<string, ColumnInterface>;

export interface MapperOptions {
    service: string;
    collection: string;
    readonly: boolean;
    strict: boolean;
    [key: string]: any;
}

export abstract class Mapper {
    protected dataConstructor: typeof Data;
    protected columns: Columns;
    protected primaryKeys: Columns = new Map();
    protected options: MapperOptions;

    constructor(dataConstructor: typeof Data, columns: Columns, options?: object | MapperOptions) {
        this.dataConstructor = dataConstructor;
        this.setColumns(columns);

        let defaults = {
            service: "",
            collection: "",
            readonly: false,
            strict: false,
        };

        if (options === undefined) {
            this.options = defaults;
        } else {
            this.options = { ...defaults, ...options } as MapperOptions;
        }
    }

    public isReadonly(): boolean {
        return this.getOption("readonly");
    }

    public hasOption(key: string): boolean {
        return this.options.hasOwnProperty(key);
    }

    public getOptions(): object {
        return this.options;
    }

    public getOption(key: string) {
        if (!this.hasOption(key)) {
            throw new Error(`Undefined Mapper option: ${key}`);
        }

        return this.options[key];
    }

    public getCollection(id?: object): string {
        const collection = this.options.collection;

        return collection;
    }

    public getPrimaryKeys(): Columns {
        return this.primaryKeys;
    }

    public setColumns(columns: Columns): this {
        this.columns = columns;
        this.primaryKeys.clear();

        columns.forEach((column, key) => {
            const options = column.getOptions();

            if (options.primary) {
                this.primaryKeys.set(key, column);
            }
        });

        if (!this.primaryKeys.size) {
            throw new Error();
        }

        return this;
    }

    public hasColumn(key: string): boolean {
        return this.columns.has(key);
    }

    public getColumns(): Columns {
        return this.columns;
    }

    public getColumn(key: string): ColumnInterface {
        const column = this.columns.get(key);

        if (column === undefined) {
            throw new UndefinedColumnError(`Undefined column: ${key}`);
        }

        return column;
    }

    public pack(record: object, data?: Data): Data {
        const columns = this.columns;
        let values = new Map<string, any>();

        columns.forEach((column, key) => {
            if (record.hasOwnProperty(key)) {
                values.set(key, column.retrieve(record[key]));
            }
        });

        if (data === undefined) {
            data = Reflect.construct(this.dataConstructor, []) as Data;
        }
        data.__import(values);

        return data;
    }

    public unpack(data: Data): Map<string, any> {
        let record = new Map();

        data.getValues().forEach((value, key) => {
            if (value !== null) {
                value = this.getColumn(key).store(value);
            }

            record.set(key, value);
        });

        return record;
    }

    public async find(id): Promise<Data | null> {
        id = this.normalizeID(id);

        const record = await this.doFind(id);
        if (record === null) {
            return null;
        }

        return this.pack(record);
    }

    public async refresh(data: Data): Promise<Data> {
        if (data.isFresh()) {
            return data;
        }

        const record = await this.doFind(data.getIDValues());
        if (record === null) {
            throw new Error();
        }

        return this.pack(record, data);
    }

    public async save(data: Data): Promise<Data> {
        if (this.isReadonly()) {
            throw new Error();
        }

        if (!data.isFresh() && !data.isDirty()) {
            return data;
        }

        data.emit(`before:save`);

        if (data.isFresh()) {
            await this.insert(data);
        } else {
            await this.update(data);
        }

        data.emit(`after:save`);

        return data;
    }

    public async destroy(data: Data): Promise<boolean> {
        if (this.isReadonly()) {
            throw new Error();
        }

        if (data.isFresh()) {
            return true;
        }

        data.emit(`before:delete`);

        const result = await this.doDelete(data);
        if (result === false) {
            throw new Error();
        }

        data.emit(`after:delete`);

        return result;
    }

    protected async insert(data: Data): Promise<Data> {
        data.emit(`before:insert`);
        data.validate();

        const record = await this.doInsert(data);

        data = this.pack(record, data);
        data.emit(`after:insert`);

        return data;
    }

    protected async update(data: Data): Promise<Data> {
        data.emit(`before:update`);
        data.validate();

        const record = await this.doUpdate(data);

        data = this.pack(record, data);
        data.emit(`after:update`);

        return data;
    }

    protected abstract getService(id?: object);
    protected abstract async doFind(id: object, service?: object, collection?: string): Promise<object | null>;
    protected abstract async doInsert(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doUpdate(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doDelete(data: Data, service?: object, collection?: string): Promise<boolean>;

    private normalizeID(id): object {
        const columns = this.primaryKeys;
        let result = {};

        if (typeof id !== "object") {
            const key = columns.keys().next().value;
            result[key] = id;

            return result;
        }

        columns.forEach((column, key) => {
            if (!id.hasOwnProperty(key)) {
                throw new UnexpectColumnValueError(`Illegal id value`);
            }

            result[key] = id[key];
        });

        return result;
    }
}

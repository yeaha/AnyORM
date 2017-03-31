import * as EventEmitter from "events";
import { Map } from "immutable";
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

export abstract class Mapper extends EventEmitter {
    protected dataConstructor: typeof Data;
    protected columns: Columns;
    protected primaryKeys: Columns;
    protected options: MapperOptions;

    constructor(dataConstructor: typeof Data, columns: Columns, options?: object | MapperOptions) {
        super();

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
        let values = Map<string, any>();

        columns.forEach((column, key) => {
            if (record.hasOwnProperty(key)) {
                values.set(key, column.retrieve(record[key]));
            }
        });

        if (data === undefined) {
            data = Reflect.construct(this.dataConstructor, []) as Data;
        }
        data.__retrieve(values);

        return data;
    }

    public unpack(data: Data): Map<string, any> {
        let record = Map<string, any>();

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
        this.emit(`before:save`, data);

        if (data.isFresh()) {
            await this.insert(data);
        } else {
            await this.update(data);
        }

        data.emit(`after:save`);
        this.emit(`after:save`, data);

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
        this.emit(`before:delete`, data);

        const result = await this.doDelete(data);
        if (result === false) {
            throw new Error();
        }

        data.emit(`after:delete`);
        this.emit(`after:delete`, data);

        return result;
    }

    protected setColumns(columns: Columns): this {
        let primaryKeys = Map() as Columns;
        this.columns = columns;

        columns.forEach((column, key) => {
            const options = column.getOptions();

            if (options.primary) {
                primaryKeys = primaryKeys.set(key, column);
            }
        });

        if (!primaryKeys.size) {
            throw new Error();
        }
        this.primaryKeys = primaryKeys;

        return this;
    }

    protected async insert(data: Data): Promise<Data> {
        data.emit(`before:insert`);
        data.validate();
        this.emit(`before:insert`, data);

        const record = await this.doInsert(data);
        data = this.pack(record, data);

        data.emit(`after:insert`);
        this.emit(`after:insert`, data);

        return data;
    }

    protected async update(data: Data): Promise<Data> {
        data.emit(`before:update`);
        data.validate();
        this.emit(`before:update`, data);

        const record = await this.doUpdate(data);
        data = this.pack(record, data);

        data.emit(`after:update`);
        this.emit(`after:update`, data);

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

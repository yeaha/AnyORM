import * as EventEmitter from "events";
import { Map } from "immutable";
import { ColumnInterface } from "./column";
import { Data, DataConstructor, Values } from "./data";
import { DataNotFoundError, UndefinedColumnError, UnexpectColumnValueError } from "./error";

export type Columns = Map<string, ColumnInterface>;

export interface MapperOptions {
    service: string;
    collection: string;
    readonly: boolean;
    strict: boolean;
    [key: string]: any;
}

export enum CRUDType { Find, Insert, Update, Delete };

interface CRUDCommand {
    type: CRUDType;
    service: string;
    collection: string;
}

export interface FindCommand extends CRUDCommand {
    id: Values;
}

export interface InsertCommand extends CRUDCommand {
    record: Values;
}

export interface UpdateCommand extends CRUDCommand {
    id: Values;
    record: Values;
}

export interface DeleteCommand extends CRUDCommand {
    id: Values;
}

let mappers = Map() as Map<typeof Data, Mapper<Data>>;

export function getMapperOf<T extends Data>(target: T | DataConstructor<T>): Mapper<T> {
    if (target instanceof Data) {
        target = Object.getPrototypeOf(target).constructor as DataConstructor<T>;
    }

    if (mappers.has(target)) {
        return mappers.get(target) as Mapper<T>;
    }

    const mapperConstructor = target.mapper;
    const columns = target.columns;
    const options = target.mapperOptions || {};
    options[`service`] = target.mapperService;
    options[`collection`] = target.mapperCollection;

    const mapper = Reflect.construct(mapperConstructor, [target, columns, options]);

    mappers = mappers.set(target, mapper);

    return mapper;
}

export abstract class Mapper<T extends Data> extends EventEmitter {
    protected dataConstructor: DataConstructor<T>;
    protected columns: Columns;
    protected primaryKeys: Columns;
    protected options: MapperOptions;

    constructor(dataConstructor: DataConstructor<T>, columns: Columns, options?: object | MapperOptions) {
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

    isReadonly(): boolean {
        return this.getOption("readonly");
    }

    hasOption(key: string): boolean {
        return this.options.hasOwnProperty(key);
    }

    getOptions(): MapperOptions {
        return this.options;
    }

    getOption(key: string) {
        if (!this.hasOption(key)) {
            throw new Error(`Undefined Mapper option: ${key}`);
        }

        return this.options[key];
    }

    getService(id?: Values): string {
        const service = this.options.service;

        return service;
    }

    getCollection(id?: Values): string {
        const collection = this.options.collection;

        return collection;
    }

    getPrimaryKeys(): Columns {
        return this.primaryKeys;
    }

    hasColumn(key: string): boolean {
        return this.columns.has(key);
    }

    getColumns(): Columns {
        return this.columns;
    }

    getColumn(key: string): ColumnInterface {
        const column = this.columns.get(key);

        if (column === undefined) {
            throw new UndefinedColumnError(`Undefined column: ${key}`);
        }

        return column;
    }

    pack(record: object, data?: T): T {
        const columns = this.columns;
        let values = Map() as Values;

        columns.forEach((column, key) => {
            if (record.hasOwnProperty(key)) {
                values = values.set(key, column.retrieve(record[key]));
            }
        });

        if (data === undefined) {
            data = Reflect.construct(this.dataConstructor, []) as T;
        }
        data.__retrieve(values);

        return data;
    }

    unpack(data: T): Values {
        let record = Map() as Values;

        data.getValues().forEach((value, key) => {
            if (value !== null) {
                value = this.getColumn(key).store(value);
            }

            record = record.set(key, value);
        });

        return record;
    }

    buildFindCommand(id: Values): FindCommand {
        const cmd: FindCommand = {
            type: CRUDType.Find,
            service: this.getService(id),
            collection: this.getCollection(id),
            id: id,
        };

        return cmd;
    }

    buildInsertCommand(data: T): InsertCommand {
        const id = data.getIDValues();

        const cmd: InsertCommand = {
            type: CRUDType.Insert,
            service: this.getService(id),
            collection: this.getCollection(id),
            record: this.unpack(data),
        };

        return cmd;
    };

    buildUpdateCommand(data: T): UpdateCommand {
        const id = data.getIDValues();

        const cmd: UpdateCommand = {
            type: CRUDType.Update,
            service: this.getService(id),
            collection: this.getCollection(id),
            record: this.unpack(data),
            id: id,
        };

        return cmd;
    }

    buildDeleteCommand(data: T): DeleteCommand {
        const id = data.getIDValues();

        const cmd: DeleteCommand = {
            type: CRUDType.Delete,
            service: this.getService(id),
            collection: this.getCollection(id),
            id: id,
        };

        return cmd;
    }

    async find(id): Promise<T | null> {
        const cmd = this.buildFindCommand(this.normalizeID(id));
        const record = await this.doFind(cmd);

        if (record === null) {
            return null;
        }

        return this.pack(record);
    }

    async findOrFail(id): Promise<T> {
        const data = await this.find(id);

        if (data === null) {
            throw new DataNotFoundError(`Data not found`);
        }

        return data;
    }

    async refresh(data: T): Promise<T> {
        if (data.isFresh()) {
            return data;
        }

        const cmd = this.buildFindCommand(data.getIDValues());
        const record = await this.doFind(cmd);

        if (record === null) {
            throw new Error();
        }

        return this.pack(record, data);
    }

    async save(data: T): Promise<T> {
        if (this.isReadonly()) {
            throw new Error();
        }

        if (!data.isFresh() && !data.isDirty()) {
            return data;
        }

        await data.__beforeSave();

        this.emit(`before:save`, data);

        if (data.isFresh()) {
            await this.insert(data);
        } else {
            await this.update(data);
        }

        await data.__afterSave();

        this.emit(`after:save`, data);

        return data;
    }

    async destroy(data: T): Promise<boolean> {
        if (this.isReadonly()) {
            throw new Error();
        }

        if (data.isFresh()) {
            return true;
        }

        await data.__beforeDelete();

        this.emit(`before:delete`, data);

        const cmd = this.buildDeleteCommand(data);
        const result = await this.doDelete(cmd);

        if (result === false) {
            throw new Error();
        }

        await data.__afterDelete();

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

    protected async insert(data: T): Promise<T> {
        await data.__beforeInsert();

        data.validate();
        this.emit(`before:insert`, data);

        const cmd = this.buildInsertCommand(data);
        const record = await this.doInsert(cmd);

        data = this.pack(record, data);

        await data.__afterInsert();

        this.emit(`after:insert`, data);

        return data;
    }

    protected async update(data: T): Promise<T> {
        await data.__beforeUpdate();

        data.validate();
        this.emit(`before:update`, data);

        const cmd = this.buildUpdateCommand(data);
        const record = await this.doUpdate(cmd);

        data = this.pack(record, data);

        await data.__afterUpdate();

        this.emit(`after:update`, data);

        return data;
    }

    protected abstract async doFind(cmd: FindCommand): Promise<object | null>;
    protected abstract async doInsert(cmd: InsertCommand): Promise<object>;
    protected abstract async doUpdate(cmd: UpdateCommand): Promise<object>;
    protected abstract async doDelete(cmd: DeleteCommand): Promise<boolean>;

    private normalizeID(id: string | number | object): Values {
        const columns = this.primaryKeys;
        let result = Map() as Values;

        if (typeof id !== "object") {
            const key = columns.keySeq().first() as string;
            result = result.set(key, id);

            return result;
        }

        columns.forEach((column, key) => {
            if (!id.hasOwnProperty(key)) {
                throw new UnexpectColumnValueError(`Illegal id value`);
            }

            result = result.set(key, id[key]);
        });

        return result;
    }
}

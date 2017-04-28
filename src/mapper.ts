import * as EventEmitter from "events";
import { Map } from "immutable";
import { isNil } from "lodash";
import { ColumnInterface } from "./column";
import { Data, DataConstructor, Values } from "./data";
import { DataNotFoundError, UndefinedColumnError, UnexpectedColumnValueError } from "./error";

export type Columns = Map<string, ColumnInterface>;

export enum CRUDType { Find, Insert, Update, Delete };

interface CRUDCommand {
    id: Values;
    type: CRUDType;
    service: string;
    collection: string;
}

export interface FindCommand extends CRUDCommand {
}

export interface InsertCommand extends CRUDCommand {
    record: Values;
}

export interface UpdateCommand extends CRUDCommand {
    record: Values;
}

export interface DeleteCommand extends CRUDCommand {
}

let mappers = Map() as Map<DataConstructor<Data, Mapper<Data>>, Mapper<Data>>;

export function getMapperOf<D extends Data, M extends Mapper<D>>(target: D | DataConstructor<D, M>): M {
    if (target instanceof Data) {
        target = Object.getPrototypeOf(target).constructor as DataConstructor<D, M>;
    }

    if (mappers.has(target)) {
        return mappers.get(target) as M;
    }

    const mapperConstructor = target.mapper;
    const columns = target.columns;
    const options = target.mapperOptions || {};
    options[`service`] = target.mapperService;
    options[`collection`] = target.mapperCollection;

    const mapper = Reflect.construct(mapperConstructor, [target, columns, options]);

    mappers = mappers.set(target, mapper);

    return mapper as M;
}

export interface MapperOptions {
    service: string;
    collection: string;
    readonly: boolean;
    strict: boolean;
    [key: string]: any;
}

export interface MapperConstructor<D extends Data, M extends Mapper<D>> {
    new (dataConstructor: DataConstructor<D, M>, columns: Columns, options?: object | MapperOptions): M;
}

export abstract class Mapper<T extends Data> extends EventEmitter {
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

        if (service === "") {
            throw new Error(`Mapper service undefined`);
        }

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

        data.toMap().forEach((value, key) => {
            if (value !== null) {
                value = this.getColumn(key).store(value);
            }

            record = record.set(key, value);
        });

        return record;
    }

    buildFindCommand(id: Values): FindCommand {
        this.ensureIDValue(id);

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
            id: id,
        };

        return cmd;
    };

    buildUpdateCommand(data: T): UpdateCommand {
        const id = data.getIDValues();
        this.ensureIDValue(id);

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
        this.ensureIDValue(id);

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

    async destroy(data: T): Promise<void> {
        if (this.isReadonly()) {
            throw new Error();
        }

        if (data.isFresh()) {
            return;
        }

        await data.__beforeDelete();

        this.emit(`before:delete`, data);

        const cmd = this.buildDeleteCommand(data);
        await this.doDelete(cmd);

        await data.__afterDelete();

        this.emit(`after:delete`, data);
    }

    protected setColumns(columns: Columns): this {
        let primaryKeys = Map() as Columns;
        this.columns = columns;

        columns.forEach((column, key) => {
            if (column.isPrimary()) {
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

    protected ensureIDValue(id: Values): void {
        const hasEmptyValue = id.some((value, key) => {
            return isNil(value);
        });

        if (hasEmptyValue) {
            throw new Error();
        }
    }

    protected abstract async doFind(cmd: FindCommand): Promise<object | null>;
    protected abstract async doInsert(cmd: InsertCommand): Promise<object>;
    protected abstract async doUpdate(cmd: UpdateCommand): Promise<object>;
    protected abstract async doDelete(cmd: DeleteCommand): Promise<void>;

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
                throw new UnexpectedColumnValueError(`Illegal id value`);
            }

            result = result.set(key, id[key]);
        });

        return result;
    }
}

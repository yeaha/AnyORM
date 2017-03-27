import { ColumnInterface } from "./column";
import { Data } from "./data";
import { UndefinedPropertyError } from "./error";

export type Columns = Map<string, ColumnInterface>;

export interface MapperOptions {
    readonly: boolean;
    strict: boolean;
    [key: string]: any;
}

export abstract class Mapper {
    protected columns: Columns;
    protected service: string;
    protected collection: string;
    protected primaryKeys: Columns = new Map();
    protected options: MapperOptions;

    constructor(service: string, collection: string, columns: Columns, options?: object | MapperOptions) {
        this.service = service;
        this.collection = collection;

        let defaults = {
            readonly: false,
            strict: false,
        };

        if (options === undefined) {
            this.options = defaults;
        } else {
            this.options = { ...defaults, ...options } as MapperOptions;
        }

        this.setColumns(columns);
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
        return this.collection;
    }

    public getPrimaryKeys(): Columns {
        return this.primaryKeys;
    }

    public setColumns(columns: Columns): this {
        this.columns = columns;

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
            throw new UndefinedPropertyError(`Undefined column: ${key}`);
        }

        return column;
    }

    public async find(id): Promise<Data | null> {
        return Promise.resolve(null);
    }

    public async save(data: Data): Promise<Data> {
        return Promise.resolve(data);
    }

    public async destroy(data: Data): Promise<boolean> {
        if (data.isFresh()) {
            return Promise.resolve(true);
        }

        return await this.doDelete(data);
    }

    protected async insert(data: Data): Promise<Data> {
        await this.doInsert(data);

        return Promise.resolve(data);
    }

    protected async update(data: Data): Promise<Data> {
        await this.doUpdate(data);

        return Promise.resolve(data);
    }

    protected abstract getService(id?: object);
    protected abstract async doFind(id: object, service?: object, collection?: string): Promise<object>;
    protected abstract async doInsert(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doUpdate(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doDelete(data: Data, service?: object, collection?: string): Promise<boolean>;
}

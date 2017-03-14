import { Attribute } from "./type";
import { Data } from "./data";
import { UndefinedPropertyError } from "./error";

export type Attributes = Map<string, Attribute>;

interface MapperOptions {
    readonly?: boolean;
    strict?: boolean;
    [key: string]: any;
}

export abstract class Mapper {
    protected abstract getService(id?: object);
    protected abstract async doFind(id: object, service?: object, collection?: string): Promise<object>;
    protected abstract async doInsert(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doUpdate(data: Data, service?: object, collection?: string): Promise<object>;
    protected abstract async doDelete(data: Data, service?: object, collection?: string): Promise<boolean>;

    protected attributes: Attributes;
    protected service: string;
    protected collection: string;
    protected primaryKeys: Set<string> = new Set<string>();
    protected options: MapperOptions;

    constructor(service: string, collection: string, attributes: Attributes, options: MapperOptions = { readonly: false, strict: false }) {
        this.service = service;
        this.collection = collection;
        this.attributes = attributes;
        this.options = options;

        attributes.forEach((attribute, key) => {
            attribute.primary && this.primaryKeys.add(key);
        });
    }

    isReadonly(): boolean {
        return this.getOption('readonly');
    }

    hasOption(key: string): boolean {
        return this.options.hasOwnProperty(key);
    }

    getOptions(): object {
        return this.options;
    }

    getOption(key: string) {
        if (!this.hasOption(key)) {
            throw new Error('Undefined Mapper option: ' + key);
        }

        return this.options[key];
    }

    getCollection(id?: object): string {
        return this.getOption('collection');
    }

    hasAttribute(key: string): boolean {
        return this.attributes.has(key);
    }

    getAttributes(): Attributes {
        return this.attributes;
    }

    getAttribute(key: string): Attribute {
        if (!this.hasAttribute(key)) {
            throw new UndefinedPropertyError('Undefined property: ' + key);
        }

        return <Attribute>this.attributes.get(key);
    }

    async find(id): Promise<Data | null> {
        return Promise.resolve(null);
    }

    async save(data: Data): Promise<Data> {
        return Promise.resolve(data);
    }

    async destroy(data: Data): Promise<boolean> {
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
}
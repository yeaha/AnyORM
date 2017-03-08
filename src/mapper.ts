import * as _ from "lodash";
import { Attribute, AttributeOption, normalizeAttribute, get as getType, TypeInterface } from "./type";
import { Data } from "./data";
import { UndefinedPropertyError } from "./error";

interface Attributes {
    [key: string]: Attribute;
}

export interface AttributesOption {
    [propName: string]: AttributeOption;
}

interface MapperOption {
    attributes: AttributesOption;
    service: string;
    collection: string;
    readonly?: boolean;
    [key: string]: any;
}

export type MapperConstructor = new (options: MapperOption) => Mapper;

interface Record {
    [key: string]: string | number | null;
}

export interface DataID {
    [index: string]: any;
}

export abstract class Mapper {
    protected abstract getService(id?: DataID);
    protected abstract async doFind(id: DataID, service?: object, collection?: string): Promise<Record>;
    protected abstract async doInsert(data: Data, service?: object, collection?: string): Promise<Record>;
    protected abstract async doUpdate(data: Data, service?: object, collection?: string): Promise<Record>;
    protected abstract async doDelete(data: Data, service?: object, collection?: string): Promise<boolean>;

    protected attributes: Attributes;
    protected service: string;
    protected collection: string;
    protected primaryKeys: Array<string>;
    protected options: object;

    constructor(options: MapperOption) {
        this.service = options.service;
        this.collection = options.service;

        _.forEach(options.attributes, (attribute, key: string) => {
            attribute = normalizeAttribute(attribute);

            this.attributes[key] = <Attribute>attribute;

            if (attribute.primary_key) {
                this.primaryKeys.push(key);
            }
        });

        delete options.service;
        delete options.collection;
        delete options.attributes;

        this.options = options;
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

    getCollection(id?: DataID): string {
        return this.getOption('collection');
    }

    hasAttribute(key: string): boolean {
        let attributes = this.attributes;

        return attributes.hasOwnProperty(key);
    }

    getAttributes(): Attributes {
        return this.attributes;
    }

    getAttribute(key: string): Attribute {
        if (!this.hasAttribute(key)) {
            throw new UndefinedPropertyError('Undefined property: ' + key);
        }

        return this.attributes[key];
    }

    getTypeOf(key: string): TypeInterface {
        return getType(key);
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
import * as AnyORM from "../../src/index";

export function TestMapper(MapperConstructor: typeof AnyORM.Mapper) {
    return class extends MapperConstructor {
        public getService(id?: object) {
            return this.service;
        }

        protected async doFind(id: object, service?: object, collection?: string): Promise<object> {
            return Promise.resolve({});
        }

        protected async doInsert(data: AnyORM.Data, service?: object, collection?: string): Promise<object> {
            return Promise.resolve({});
        }

        protected async doUpdate(data: AnyORM.Data, service?: object, collection?: string): Promise<object> {
            return Promise.resolve({});
        }

        protected async doDelete(data: AnyORM.Data, service?: object, collection?: string): Promise<boolean> {
            return Promise.resolve(true);
        }
    }
}

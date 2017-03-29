import * as _ from "lodash";
import * as AnyORM from "../../src/index";

let storage = new Map<any, object>();

export function TestMapper(MapperConstructor: typeof AnyORM.Mapper) {
    return class extends MapperConstructor {
        public getService(id?: object) {
            return this.options.service;
        }

        protected async doFind(id: object, service?: object, collection?: string): Promise<object | null> {
            const key = this.getIndexKey(id);
            let record = storage.get(key);

            if (record === undefined) {
                return null;
            }

            return record;
        }

        protected async doInsert(data: AnyORM.Data, service?: object, collection?: string): Promise<object> {
            // const key = this.getIndexKey(data.getIDValues());

            return {};
        }

        protected async doUpdate(data: AnyORM.Data, service?: object, collection?: string): Promise<object> {
            return Promise.resolve({});
        }

        protected async doDelete(data: AnyORM.Data, service?: object, collection?: string): Promise<boolean> {
            return Promise.resolve(true);
        }

        private getIndexKey(id: object): string {
            let result: String[] = [];

            _.sortBy(_.keys(id))
                .forEach((key) => {
                    result.push(`${key}:${id[key]}`);
                });

            return result.join("&");
        }
    }
}

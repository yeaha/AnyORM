import { Map } from "immutable";
import * as _ from "lodash";
import * as AnyORM from "../../src/index";
import { Serial } from "./columns";

export let testStorage = Map<any, Map<string, any>>();

export function TestMapper(MapperConstructor: typeof AnyORM.Mapper) {
    return class extends MapperConstructor {
        public getService(id?: object) {
            return this.options.service;
        }

        protected async doFind(id: object, service?: object, collection?: string): Promise<object | null> {
            const key = this.getIndexKey(id);
            let record = testStorage.get(key);

            if (record === undefined) {
                return null;
            }

            return record;
        }

        protected async doInsert(data: AnyORM.Data, service?: object, collection?: string): Promise<object> {
            this.primaryKeys.forEach((column, key: string) => {
                if (column instanceof Serial) {
                    data.set(key, column.getNext());
                }
            });

            const key = this.getIndexKey(data.getIDValues());
            let record = this.unpack(data);

            testStorage = testStorage.set(key, record);

            return record;
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
    };
}

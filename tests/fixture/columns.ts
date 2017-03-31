import * as AnyORM from "../../src/index";

export class Serial extends AnyORM.IntegerColumn {
    private val = 1;

    public getNext() {
        return this.val++;
    }
}

AnyORM.ColumnRegister("serial", Serial);

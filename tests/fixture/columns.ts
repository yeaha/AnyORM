import * as AnyORM from "../../src/index";

export class Serial extends AnyORM.IntegerColumn {
    private val = 1;

    getNext() {
        return this.val++;
    }
}

AnyORM.columnRegister("serial", Serial);

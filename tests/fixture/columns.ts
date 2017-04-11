import { columnRegister, IntegerColumn } from "../../src/index";

export class Serial extends IntegerColumn {
    private val = 1;

    getNext() {
        return this.val++;
    }
}

columnRegister("serial", Serial);

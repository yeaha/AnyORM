import * as Crypto from "crypto";
import { random } from "lodash";
import {
    Column,
    Data,
    DBMapper,
    Formatter,
    MapperConstructor,
    PrimaryColumn,
    ProtectedColumn,
    StrictColumn,
} from "../../src/index";

export class User extends Data {
    static mapper: MapperConstructor<User, DBMapper<User>> = DBMapper;
    static mapperService = "pgsql";
    // static mapperService = "mysql";
    static mapperCollection = "users";

    @PrimaryColumn("integer")
    user_id: number;

    @Formatter((value, column) => {
        return (value + "").toLocaleLowerCase();
    })
    @StrictColumn("string", { refuseUpdate: true })
    email: string;

    @Formatter(function(this: User, value) {
        return this.encryptPassword(value);
    })
    @ProtectedColumn("string")
    password: string;

    @ProtectedColumn("string")
    password_salt: string;

    @Column("datetime", {
        refuseUpdate: true,
        default: () => new Date(),
        format: "YYYY-MM-DD HH:mm:ss",
    })
    create_time;

    @Column("datetime", {
        format: "YYYY-MM-DD HH:mm:ss",
    })
    update_time;

    async __beforeSave() {
        this.update_time = new Date();
    }

    private encryptPassword(password: string): string {
        const salt = random(10000000, 99999999).toString();
        this.password_salt = salt;

        return Crypto.createHmac("md5", salt).update(password).digest("hex");
    }
}

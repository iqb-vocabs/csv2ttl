abstract class IdGenerator {
    abstract generateId():String;
    abstract addId(id: String):void;
}

export class StringIdGenerator extends IdGenerator {
    private static ids: string[] = [];
    generateId(): string {
        const RandExp = require("randexp");

        let newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{2}/).gen();

        while (StringIdGenerator.ids.includes(newId)){
            newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{2}/).gen();
        }
        StringIdGenerator.ids.push(newId);
        return newId;
    }

    addId(id: String){
        StringIdGenerator.ids.push()
    }

}

export class NumericIdGenerator extends IdGenerator {
    private static lastId = 0;
    generateId(): string{
        return String(NumericIdGenerator.lastId+1).padStart(3, '0');
    }
    addId(id:String){
    }
}


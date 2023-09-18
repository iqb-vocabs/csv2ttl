import RandExp from "randexp";

abstract class IdGenerator {
    ids: string[] = [];
    constructor(ids: string[]){
        this.ids = ids;
    }

    abstract generateId():String;

    orderIds(){
        this.ids = this.ids.sort()
    }

    addIds(newId: string){
        this.ids.push(newId);
    }

    elementAtPosition(pos:number){
        return this.ids[pos];
    }
}

export class StringIdGenerator extends IdGenerator {
    generateId(): string {
        const RandExp = require("randexp");

        let newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{3}/).gen();

        while (this.ids.includes(newId)){
            newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{3}/).gen();
        }
        this.addIds(newId);
        return newId;
    }

    generateIdBetween(lowString: string, upString: string): string {
        const RandExp = require("randexp");

        let newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{3}/).gen();

        while (this.ids.includes(newId) || newId > lowString || newId>upString ){
            newId = new RandExp(/^[2-9ABCDEFGHJKQRSTUVWXYZ]{3}/).gen();
        }
        this.addIds(newId);
        return newId;
    }

}

export class NumericIdGenerator extends IdGenerator {
    generateId(): string{
        const lastId = (this.ids.length===0)?0:Number(this.ids[(this.ids).length-1]);
        const newId = String(lastId+3).padStart(3, '0');
        this.addIds(newId);
        return newId;
    }

}


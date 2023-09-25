class Vocab {
    constructor( public notation: string,
                 public title: string,
                 public id?:string,
                 public description?: string,
                 public children: Vocab[] = []){}

    setId(id: string){
        this.id = id;
    }

    addChild(child: Vocab){
        this.children?.push(child);
    }

    notationDeep(): number {
        return (this.notation.split(".")).length;
    }

    toString(): string {
        let st = this.title + " has ";
        this.children.forEach(function(child: Vocab){
                st = st + "\t" + child.title;
        });
        return st;
    }
}

// todo: Ask for Framework for testingL Jest, Karma, or Mocha

let vocab1 = new Vocab("1", "1");
let vocabA = new Vocab("1.1", "A");
let vocabB = new Vocab("1.2", "B");
vocab1.addChild(vocabA);
vocab1.addChild(vocabB);
console.log(vocab1.toString());
console.log(vocab1.notationDeep());
console.log(vocabA.notationDeep());

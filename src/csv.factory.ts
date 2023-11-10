import { parse as csv2jsonParser} from 'csv-parse/sync';
import { Parser as json2csvParser } from '@json2csv/plainjs';

export interface CsvData {
    notation: string;
    title: string;
    description: string;
    id: string
    title_en: string;
    description_en: string;
}

function validHierarchy(notationCheckList: String[], newString:String):boolean{
    if (notationCheckList.length>0){
        let lastString = notationCheckList[notationCheckList.length-1];
        let stringList = lastString.split(".");
        let newStringList = newString.split(".");
        let lastLevels = (lastString.split(".")).length;
        let newLevels = (newString.split(".")).length;

        if (lastLevels == newLevels){  // Same level

            if (Number(stringList[lastLevels-1]) < Number(newStringList[lastLevels-1])){
                return true;
            }else{
                console.log(` case 1 first number ${Number(lastString[lastLevels-1])} - second number ${Number(newStringList[lastLevels-1])}`);
                return false;
            }
        }else if (lastLevels < newLevels){       // Deeper level
            if (newLevels > (lastLevels+1)) {
                console.log(` case 2 first number ${Number(lastString[newLevels-1])} - second number ${Number(newStringList[lastLevels-1])}`);
                return false;
            }else
                return true;
        }else{ // Superficial level
            if (Number(stringList[newLevels-1])<Number(newStringList[newLevels-1]))
                return true;
            else{
                console.log(` case 3 first number ${Number(lastString[newLevels-1])} - second number ${Number(newStringList[lastLevels-1])}`);
                return false;
            }
        }
    }
    return true;
}
export abstract class CsvFactory {
    public static load(dataFilename: string, csvDelimiter: string, allowEmptyId: boolean): CsvData[] | null {
        const fs = require('fs');
        let csvData: CsvData[] | null = null;
        if (fs.existsSync(dataFilename)) {
            try {
                const csvDataRaw = fs.readFileSync(dataFilename, 'utf8');
                csvData = csv2jsonParser(csvDataRaw, {
                    columns: true,
                    skip_empty_lines: true,
                    delimiter: csvDelimiter
                });
            } catch (err) {
                console.log(`\x1b[0;31mERROR\x1b[0m reading and parsing data file '${dataFilename}':`);
                console.error(err);
                csvData = null;
                process.exitCode = 1;
            }
            if (csvData) {
                const uniqueIdList: string[] = [];
                const uniqueTitleList: string[] = [];
                const uniqueNotationList: string[] = [];
                const uniqueIdErrors: string[] = [];
                const uniqueTitleErrors: string[] = [];
                const uniqueNotationErrors: string[] = [];
                const validHierarchyErrors: string[] = [];
                let fatalError = false;
                let recordNumber = 1;
                const notationPattern = /^(([1-9][0-9]*)(\.[1-9][0-9]*)*)$|^([a-zA-Z]*)$/;
                const numericPattern = /^(([1-9][0-9]*)(\.[1-9][0-9]*)*)$/;
                csvData.forEach(c => {
                    recordNumber += 1;
                    if (c.id) {
                        if (uniqueIdList.includes(c.id)) {
                            uniqueIdErrors.push(`#${recordNumber}`);
                        } else {
                            uniqueIdList.push(c.id);
                        }
                    } else if (!allowEmptyId) {
                        uniqueIdErrors.push(`#${recordNumber}`);
                    }
                    if (c.notation) {
                        const notationMatches = c.notation.match(notationPattern);
                        const numericMatches = c.notation.match(numericPattern);
                        if (numericMatches){
                            if (!validHierarchy(uniqueNotationList, c.notation)){
                                validHierarchyErrors.push(`#${recordNumber}`);
                            }
                        }
                        if (notationMatches) {
                            if (uniqueNotationList.includes(c.notation)) {
                                uniqueNotationErrors.push(`#${recordNumber}`);
                            } else {
                                uniqueNotationList.push(c.notation);
                            }
                        } else {
                            uniqueNotationErrors.push(`#${recordNumber}`);
                        }

                    }
                    if (c.title) {
                        const checkTitleExpression = `${c.notation || ''}-${c.title}`;
                        if (uniqueTitleList.includes(checkTitleExpression)) {
                            uniqueTitleErrors.push(`#${recordNumber}`);
                        } else {
                            uniqueTitleList.push(checkTitleExpression);
                        }
                    } else {
                        uniqueTitleErrors.push(`#${recordNumber}`);
                    }
                });
                const allNotations = csvData.map(c => c.notation).filter(n => n && n.length > 0);
                if (allNotations.length > 0) {
                    if (allNotations.length < csvData.length) {
                        console.log(`\x1b[0;31mERROR\x1b[0m Notations must be given all or none in data file '${dataFilename}'`);
                        fatalError = true;
                    }
                    if (uniqueNotationErrors.length > 0) {
                        console.log(`\x1b[0;31mERROR\x1b[0m Notations must be unique and valid in data file '${dataFilename}' (${uniqueNotationErrors.join(', ')})`);
                        fatalError = true;
                    }
                }
                if (uniqueTitleErrors.length > 0) {
                    console.log(`\x1b[0;31mERROR\x1b[0m Titles must be unique and not empty in data file '${dataFilename}' (${uniqueTitleErrors.join(', ')})`);
                    fatalError = true;
                }
                if (uniqueIdErrors.length > 0) {
                    if (allowEmptyId) {
                        console.log(`\x1b[0;31mERROR\x1b[0m IDs must be unique in data file '${dataFilename}' (${uniqueIdErrors.join(', ')})`);
                    } else {
                        console.log(`\x1b[0;31mERROR\x1b[0m IDs must be unique and not empty in data file '${dataFilename}' (${uniqueIdErrors.join(', ')})`);
                    }
                    fatalError = true;
                }
                if (validHierarchyErrors.length > 0) {
                    console.log(`\x1b[0;31mERROR\x1b[0m Notations must be bigger than the prior notation and also can not increase the number of levels from the prior record to next by more than one level.'${dataFilename}' (${validHierarchyErrors.join(', ')})`);
                    fatalError = true;
                }
                if (fatalError) {
                    csvData = null;
                    process.exitCode = 1;
                }

            }
        } else {
            console.log(`\x1b[0;31mERROR\x1b[0m data file '${dataFilename}' not found`);
            process.exitCode = 1;
        }
        return csvData;
    }

    public static write(dataFilename: string, data: CsvData[], csvDelimiter: string): boolean {
        const fs = require('fs');
        let returnValue = true;
        const parser = new json2csvParser({
            fields: ['notation','title','description','id','title_en','description_en'],
            quote: '',
            delimiter: csvDelimiter
        });
        try {
            const fileContent = parser.parse(data); // .replaceAll(/"/g, '')
            fs.writeFileSync(dataFilename, fileContent);
        } catch (err) {
            console.log(`\x1b[0;31mERROR\x1b[0m unable to write data file '${dataFilename}':`);
            console.error(err);
            returnValue = false
            process.exitCode = 1;
        }
        return returnValue;
    }
}

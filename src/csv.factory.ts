import { parse as csv2jsonParser} from 'csv-parse/sync';
import { Parser as json2csvParser } from '@json2csv/plainjs';

export interface CsvData {
    notation: string;
    title: string;
    description: string;
    id: string
}

export abstract class CsvFactory {
    public static load(dataFilename: string, csvDelimiter: string): CsvData[] | null {
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
                let fatalError = false;
                csvData.forEach(c => {
                    if (c.id) {
                        if (uniqueIdList.includes(c.id)) {
                            fatalError = true;
                        } else  {
                            uniqueIdList.push(c.id);
                        }
                    }
                });
                if (fatalError) {
                    console.log(`\x1b[0;31mERROR\x1b[0m IDs not unique in data file '${dataFilename}'`);
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
            fields: ['notation','title','description','id'],
            quote: '',
            delimiter: csvDelimiter
        });
        try {
            const fileContent = parser.parse(data).replaceAll(/"/g, '');
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

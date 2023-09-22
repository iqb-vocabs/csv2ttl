#!/usr/bin/env node
import { parse as csv_parse} from 'csv-parse/sync';
import { StringIdGenerator } from "./idGenerator";

const fs = require('fs');
const csv = require('csv-parser');
const json2csv = require('json2csv').parse;


let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;


if (fs.existsSync(config_filename)) {
    // Read the JSON configuration file
    const config_data_raw = fs.readFileSync(config_filename, 'utf8');
    const config_data = JSON.parse(config_data_raw);
    const fileList: { [name: string]: string } = {};
    const csvDelimiter = config_data.csv_delimiter || ';';
    const fields = ['notation','title','description','id'];
    const opts = {
        fieldNames: fields,
        quote: '',
        delimiter:';'
    };

    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });

    //add id if it does not exist
    config_data.vocabularies.forEach((voc: any) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];

        if (voc_filename) {
            console.log(`Adding ids to '${voc_filename}'`);
            const data_raw = fs.readFileSync(voc_filename, 'utf8');
            const data = csv_parse(data_raw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: csvDelimiter
            });
            let dataArray: any[];
            dataArray = [];

            //store all ids in an array
            //const old_ids: String[] = data[];
            let oldIds: string[] = [];
            let counter = 0;
            data.forEach((d: any) => {
                if (d.id != "") {
                    counter++;
                    oldIds.push(d.id);
                }
            });

            if (counter == 0) {
                const generator = new StringIdGenerator([]);
                while (data.length != counter) {
                    generator.generateId();
                    counter++;
                }
                //generator.orderIds();
                let position = 0;
                fs.createReadStream(voc_filename)
                    .pipe(csv({separator: csvDelimiter}))
                    .on('data', function (row: any) {
                        if (row.id === "") {
                            row.id = generator.elementAtPosition(position);
                            position++;
                        }
                        dataArray.push(row);
                    })
                    .on('end', () => {
                        let result = json2csv(dataArray, opts);
                        result = result.replaceAll(/"/g, '');
                        fs.writeFileSync(voc_filename, result);
                    });
            }

            if (counter < data.length) {
                const generator = new StringIdGenerator(oldIds);
                fs.createReadStream(voc_filename)
                    .pipe(csv({separator: csvDelimiter}))
                    .on('data', function (row: any) {
                        if (row.id === "") {
                            row.id = generator.generateId();
                        }
                        dataArray.push(row);
                    })
                    .on('end', () => {
                        let result = json2csv(dataArray, opts);
                        result = result.replaceAll(/"/g, '');
                        fs.writeFileSync(voc_filename, result);
                    });
            }
        }
    });
} else {
    console.log(`\x1b[0;31mERROR\x1b[0m File '${config_filename}' not found`);
    process.exitCode = 1;
}

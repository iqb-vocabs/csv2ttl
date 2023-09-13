import { parse as csv_parse} from 'csv-parse/sync';
import { StringIdGenerator } from "./idGenerator";

// the library we need
const fs = require('fs');
const RandExp = require('randexp');
const csv = require('csv-parser');
const json2csv = require('json2csv').parse;


// Check the data folder
let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;


// If the configuration is present
if (fs.existsSync(config_filename)) {
    // Read the JSON configuration file
    const config_data_raw = fs.readFileSync(config_filename, 'utf8');
    const config_data = JSON.parse(config_data_raw);
    const creator = config_data.creator;
    console.log(creator);
    let fileList: { [name: string]: string } = {};
    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });
    const csvDelimiter = config_data.csv_delimiter || ';';

    const fields = ['notation','title','description','id'];
    const opts = {
        fieldNames: fields,
        quote: '',
        delimiter:';'
    };

    //add id if it does not exist
    let old = 0;
    config_data.vocabularies.forEach((voc: any) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        const generator = new StringIdGenerator();
        console.log(`Processing '${voc_filename}'`);
        if (voc_filename) {
            console.log(`Processing '${voc_filename}'`);
            const data_raw = fs.readFileSync(voc_filename, 'utf8');
            const data = csv_parse(data_raw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: csvDelimiter
            });
        let dataArray: any[];
        dataArray = [];

        fs.createReadStream(voc_filename)
            .pipe(csv({separator:csvDelimiter}))
            .on('data', function (row:any) {
                if (row.id === "") {
                    row.id = generator.generateId();
                    old++ ;
                }else {
                    generator.addId(row.id);
                }
                dataArray.push(row);
            })
            .on('end', () => {
                var result = json2csv(dataArray,opts);
                result = result.replaceAll(/"/g,'');
                fs.writeFileSync(voc_filename, result);
            });
    }
    });
} else {
    console.log(`\x1b[0;31mERROR\x1b[0m File '${config_filename}' not found`);
    process.exitCode = 1;
}

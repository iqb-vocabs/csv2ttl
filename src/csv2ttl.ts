import { parse as csv_parse} from 'csv-parse/sync';
let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;
const fs = require('fs');
if (fs.existsSync(config_filename)) {
    const config_data_raw = fs.readFileSync(config_filename, 'utf8');
    // todo: validate config file
    const config_data = JSON.parse(config_data_raw);

    let fileList: { [name: string]: string } = {};
    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });

    const csvDelimiter = config_data.csv_delimiter || ';';
    config_data.vocabularies.forEach((voc: any) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        if (voc_filename && fs.existsSync(voc_filename)) {
            console.log(`Processing '${voc_filename}'`);
            const data_raw = fs.readFileSync(voc_filename, 'utf8');
            const records = csv_parse(data_raw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: csvDelimiter
            });
            console.log(records);
        } else {
            console.log(`\x1b[0;31mERROR\x1b[0m File '${data_folder}/${voc.id}.csv' not found`);
        }
    });

} else {
    console.log(`\x1b[0;31mERROR\x1b[0m File '${config_filename}' not found`);
    process.exitCode = 1;
}

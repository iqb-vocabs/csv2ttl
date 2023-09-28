#!/usr/bin/env node
import { ConfigFileFactory, VocabularyData } from "./config-file.factory";
import { CsvFactory } from "./csv.factory";
import * as RandExp from "randexp";

const fs = require('fs');

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_data = ConfigFileFactory.load(data_folder);
if (config_data) {
    // Read the JSON configuration file
    const fileList: { [name: string]: string } = {};
    const csvDelimiter = config_data.csv_delimiter || ';';

    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });

    //add id if it does not exist
    let fileOkCount = 0;
    let idsAddedCount = 0;
    config_data.vocabularies.forEach((voc: VocabularyData) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        if (voc_filename) {
            const csvData = CsvFactory.load(voc_filename, csvDelimiter);
            if (csvData) {
                const idList = csvData.map(c => c.id).filter(c => c && c.length > 0);
                if (idList.length !== csvData.length) {
                    csvData.forEach(c => {
                        while (!(c && c.id.length > 0)) {
                            const randexp = new RandExp(/^[2345679abcdefghprqstuvxyz]{3}/);
                            const newId = randexp.gen();
                            if (!idList.includes(newId)) {
                                c.id = newId;
                                idList.push(newId);
                                idsAddedCount += 1;
                            }
                        }
                    });
                    if (CsvFactory.write(voc_filename, csvData, csvDelimiter)) {
                        fileOkCount += 1;
                    }
                }
            }
        }
    });
    if (fileOkCount > 0) {
        console.log(`${idsAddedCount} ID(s) changed in ${fileOkCount} file(s)`);
    } else {
        console.log(`no missing IDs in ${config_data.vocabularies.length} data file(s) - no changes`);
    }
}

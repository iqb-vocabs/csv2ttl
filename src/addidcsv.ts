#!/usr/bin/env node
import * as RandExp from 'randexp';
import fs = require('fs');
import { ConfigFileFactory, VocabularyData } from './config-file.factory';
import { CsvFactory } from './csv.factory';

// const fs = require('fs');
require('fs');

let dataFolder = '.';
if (process.argv[2]) {
  dataFolder = `${dataFolder}/${process.argv[2]}`;
}
const configData = ConfigFileFactory.load(dataFolder);
if (configData) {
  // Read the JSON configuration file
  const fileList: { [name: string]: string } = {};
  const csvDelimiter = configData.csv_delimiter || ';';
  const idPattern = configData.idPattern || '^[abcdefghprqstuvxyz][2345679][abcdefghprqstuvxyz]$';

  fs.readdirSync(dataFolder).forEach((file: string) => {
    fileList[file.toUpperCase()] = `${dataFolder}/${file}`;
  });

  // add id if it does not exist
  let fileOkCount = 0;
  let fileAnalysedCount = 0;
  let idsAddedCount = 0;
  configData.vocabularies.forEach((voc: VocabularyData) => {
    const vocFilename = fileList[ConfigFileFactory.getFilenameSource(voc).toUpperCase()];
    if (vocFilename) {
      const csvData = CsvFactory.load(vocFilename, csvDelimiter, true);
      if (csvData) {
        fileAnalysedCount += 1;
        const idList = csvData.map(c => c.id).filter(c => c && c.length > 0);
        if (idList.length !== csvData.length) {
          csvData.forEach(c => {
            while (!(c && c.id.length > 0)) {
              const randexp = new RandExp(idPattern);
              const newId = randexp.gen();
              if (!idList.includes(newId)) {
                c.id = newId;
                idList.push(newId);
                idsAddedCount += 1;
              }
            }
          });
          if (CsvFactory.write(vocFilename, csvData, csvDelimiter)) {
            fileOkCount += 1;
          }
        }
      } else {
        console.log(`\x1b[0;33mWARNING\x1b[0m Errors in file '${vocFilename}' - ignore`);
      }
    } else {
      console.log(`\x1b[0;33mWARNING\x1b[0m File for '${voc.id}' not found - ignore`);
    }
  });
  if (fileOkCount > 0) {
    console.log(`${idsAddedCount} ID(s) changed in ${fileOkCount} of ${fileAnalysedCount} file(s)`);
  } else {
    console.log(`no missing IDs in ${fileAnalysedCount} data file(s) - no changes`);
  }
}

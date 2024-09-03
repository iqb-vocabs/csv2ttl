#!/usr/bin/env node
import fs = require('fs');
import { ConfigFileFactory, VocabularyData } from './config-file.factory';
import { CsvFactory } from './csv.factory';

require('fs');

let dataFolder = '.';
if (process.argv[2]) {
  dataFolder = `${dataFolder}/${process.argv[2]}`;
}

function getNotationDeep(notation: string): number {
  return notation.split(/[.\s]*/).length;
}

const configData = ConfigFileFactory.load(dataFolder);
if (configData) {
  let outputFolder = '.';
  if (configData.outDir) {
    outputFolder = configData.outDir;
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder);
    }
  }
  const fileList: { [name: string]: string } = {};
  fs.readdirSync(dataFolder).forEach((file: string) => {
    fileList[file.toUpperCase()] = `${dataFolder}/${file}`;
  });
  const csvDelimiter = configData.csv_delimiter || ';';

  const stoutBase:string = '@prefix dct: <http://purl.org/dc/terms/>.\n' +
        '@prefix skos: <http://www.w3.org/2004/02/skos/core#>. \n' +
        '@prefix dc: <http://purl.org/dc/elements/1.1/>.\n' +
        `@prefix n0: <${configData.base}`;

  configData.vocabularies.forEach((voc: VocabularyData) => {
    if (configData) {
      const vocFilename = fileList[ConfigFileFactory.getFilenameSource(voc).toUpperCase()];
      const outPath = `${outputFolder}/${ConfigFileFactory.getFilenameTarget(voc)}`;
      const header = `${stoutBase}/${voc.id}/>. \n` +
                `@prefix n1: <${configData.base}/${voc.id}/>. \n\n`;
      const baseUrl = 'n0:';
      let footer = '';
      // check if there is more than one lang

      const numLang = configData.title.length;
      let mainTitle = '';
      let creator = '';

      mainTitle = `${mainTitle}"${configData.title[0].value} - ${voc.title[0].value}"@${voc.title[0].lang}`;
      creator = `${creator}"${configData.creator}"@${voc.title[0].lang}`;
      if (numLang > 1) {
        mainTitle = `${mainTitle},\n\t"${configData.title[1].value} - ${voc.title[1].value}"@${voc.title[1].lang};\n`;
        creator = `${creator},\n\t"${configData.creator}"@${voc.title[1].lang};\n`;
      } else {
        creator = `${creator};\n`;
        mainTitle = `${mainTitle};\n`;
      }
      if (voc.description[0].value === '') {
        footer = `${baseUrl}\n` +
                    '\ta skos:ConceptScheme;\n' +
                    `\tdct:creator ${creator}` +
                    `\tdct:title ${mainTitle}` +
                    `\tdc:title ${mainTitle}` +
                    `\tdc:description ${mainTitle}` +
                    '\tskos:hasTopConcept';
      } else {
        let mainDescription = '';
        for (let i = 0; i < numLang - 1; i++) {
          mainDescription = `${mainDescription}"${voc.description[i].value}"@${voc.description[i].lang},\n\t`;
        }
        mainDescription = `${mainDescription}"${voc.description[numLang - 1].value}` +
                          `"@${voc.description[numLang - 1].lang};\n`;

        footer = `${baseUrl}\n` +
                    '\ta skos:ConceptScheme;\n' +
                    `\tdct:creator ${creator}` +
                    `\tdct:title ${mainTitle}` +
                    `\tdct:description ${mainDescription}` +
                    '\tskos:hasTopConcept';
      }
      let stout = header;

      if (vocFilename) {
        const data = CsvFactory.load(vocFilename, csvDelimiter, false);
        if (data && data.length > 0) {
          console.log(`Processing '${vocFilename}': ${data.length} records found`);
          // initiation of variables for loop:
          const urlStack: string[] = [];
          let nodesStack: string[] = [];
          const bodyStack: string[] = [];
          const nodeNodesStack: string[][] = [];
          let oldUrl = baseUrl;
          const num = data.length;

          urlStack.push(baseUrl);
          for (let i = 0; i < num; i++) {
            const d = data[i];
            const deep = getNotationDeep(d.notation);
            let deepNext = deep;
            // let titles = d.title.split('|');

            // check the deep of the next record
            if ((i + 1) < num) {
              const s = data[i + 1];
              deepNext = getNotationDeep(s.notation);
            } else {
              deepNext = 1;
            }
            oldUrl = urlStack[urlStack.length - 1];
            const newUrl = `n1:${d.id}`;
            if (deepNext === deep || deepNext < deep) {
              let body = `${newUrl}\n`;
              let prefLabel = '';
              prefLabel = `${prefLabel}"${d.title}"@${voc.title[0].lang}`;
              if (numLang > 1) {
                prefLabel = `${prefLabel},\n\t"${d.title_en}"@${voc.title[1].lang}`;
              }

              if (oldUrl === baseUrl) {
                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:topConceptOf ${oldUrl};\n` +
                                    `\tskos:prefLabel ${prefLabel}`;
              } else {
                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel ${prefLabel}`;
              }

              if (d.description !== '') {
                //   let descriptions = d.description.split('|');
                let desc = '';
                desc = `${desc}"${d.description}"@${voc.title[0].lang}`;
                if (d.description_en !== '' && numLang > 1) {
                  desc = `${desc},\n\t"${d.description_en}"@${voc.title[1].lang}`;
                }
                body = `${body}; \n\tskos:definition ${desc}.\n`;
              } else body = `${body}.\n`;
              nodesStack.push(newUrl);
              stout = `${stout}${body}`;

              // In this case I have to write out the father with the nodesStack
              if (deepNext < deep) {
                nodeNodesStack.push(nodesStack);
                let dif = deep - deepNext;
                while (dif > 0) {
                  urlStack.pop();
                  let oldBody = bodyStack.pop();
                  const tempNodesStack = nodeNodesStack.pop();
                  if (tempNodesStack !== undefined) {
                    oldBody = `${oldBody};\n` +
                                            '\tskos:narrower ';
                    tempNodesStack.forEach(node => {
                      oldBody = `${oldBody}\n\t\t${node},`;
                    });
                    oldBody = oldBody?.replace(/.$/, '.');
                    stout = `${stout}${oldBody}\n`;
                  }
                  dif -= 1;
                }
                nodesStack = (nodeNodesStack.pop() as string[]);
              }
            } else { /* If the deep of the next more than me. Actions:
                                    1. Store body of myself
                                    2. Store the actual nodesStack at nodeNodesStack
                                    3. Store the actual father
                                    4. Empty the nodesStack
                                    5. Store the actual deep
                                */
              let body = `${newUrl}\n`;
              let prefLabel = '';
              prefLabel = `${prefLabel}"${d.title}"@${voc.title[0].lang}`;
              if (numLang > 1) {
                prefLabel = `${prefLabel},\n\t"${d.title_en}"@${voc.title[1].lang}`;
              }

              if (oldUrl === baseUrl) {
                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${oldUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:topConceptOf ${oldUrl};\n` +
                                    `\tskos:prefLabel ${prefLabel}`;
              } else {
                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel ${prefLabel}`;
              }

              if (d.description !== '') {
                let desc = '';
                desc = `${desc}"${d.description}"@${voc.title[0].lang}`;
                if (d.description_en !== '' && numLang > 1) {
                  desc = `${desc},\n\t"${d.description_en}"@${voc.title[1].lang}`;
                }
                body = `${body}; \n\tskos:definition ${desc}`;
              }

              bodyStack.push(body);
              nodesStack.push(newUrl);
              nodeNodesStack.push(nodesStack);
              nodesStack = [];
              urlStack.push(newUrl);
            }
          }

          nodesStack.forEach(node => {
            footer = `${footer}\n\t\t${node},`;
          });

          footer = footer.replace(/.$/, '.');
          stout = `${stout}${footer}`;

          fs.writeFileSync(outPath, stout, { encoding: 'utf8' });
        } else {
          console.log(`\x1b[0;33mWARNING\x1b[0m Errors in file '${vocFilename}' - ignore`);
        }
      } else {
        console.log(`\x1b[0;33mWARNING\x1b[0m file '${dataFolder}/${voc.id}.csv' not found - ignore`);
      }
    }
  });
}

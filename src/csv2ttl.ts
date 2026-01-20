#!/usr/bin/env node
import fs = require('fs');
import { ConfigData, ConfigFileFactory, VocabularyData } from './config-file.factory';
import { CsvFactory } from './csv.factory';

let dataFolder = '.';
if (process.argv[2]) {
  dataFolder = `${dataFolder}/${process.argv[2]}`;
}

function getNotationDeep(notation: string): number {
  const firstLevel = notation.split(' ').length;
  if (firstLevel > 1) {
    return notation.split('.').length + 1;
  }
  return Math.max(1, notation.split('.').length);
}

function getPrefLabel(d: any, voc: VocabularyData, numLang: number): string {
  const labels = [`"${d.title}"@${voc.title[0].lang}`];
  if (numLang > 2) {
    labels.push(`"${d.title_fr}"@${voc.title[2].lang}`);
    labels.push(`"${d.title_it}"@${voc.title[3].lang}`);
    labels.push(`"${d.title_rm}"@${voc.title[4].lang}`);
  }
  if (numLang > 1) {
    labels.push(`"${d.title_en}"@${voc.title[1].lang}`);
  }
  return labels.join(',\n\t');
}

function getDefinition(d: any, voc: VocabularyData, numLang: number): string {
  const definitions = [`"${d.description}"@${voc.title[0].lang}`];
  if (numLang > 2) {
    if (d.description_fr) definitions.push(`"${d.description_fr}"@${voc.title[2].lang}`);
    if (d.description_it) definitions.push(`"${d.description_it}"@${voc.title[3].lang}`);
    if (d.description_rm) definitions.push(`"${d.description_rm}"@${voc.title[4].lang}`);
  }
  if (numLang > 1 && d.description_en) {
    definitions.push(`"${d.description_en}"@${voc.title[1].lang}`);
  }
  return definitions.join(',\n\t');
}

function getConceptSchemeStrings(configData: ConfigData, voc: VocabularyData) {
  const numLang = configData.title.length;
  let langIdx;
  if (numLang === 2) langIdx = [0, 1].slice(0, numLang);
  else langIdx = [0, 2, 3, 4, 1].slice(0, numLang);

  const mainTitles = langIdx.map(i => `"${configData.title[i].value} - ${voc.title[i].value}"@${voc.title[i].lang}`
  ).join(',\n\t');

  const creators = langIdx.map(i => `"${configData.creator}"@${voc.title[i].lang}`
  ).join(',\n\t');

  let mainDescription = '';
  if (voc.description[0].value !== '') {
    mainDescription = voc.description.slice(0, numLang).map(d => `"${d.value}"@${d.lang}`
    ).join(',\n\t');
  }
  return { mainTitles, creators, mainDescription };
}

const configData = ConfigFileFactory.load(dataFolder);
if (configData) {
  const outputFolder = configData.outDir || '.';
  if (configData.outDir && !fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }

  const fileList: { [name: string]: string } = {};
  fs.readdirSync(dataFolder).forEach((file: string) => {
    fileList[file.toUpperCase()] = `${dataFolder}/${file}`;
  });

  const csvDelimiter = configData.csv_delimiter || ';';
  const stoutBase = '@prefix dct: <http://purl.org/dc/terms/>.\n' +
      '@prefix skos: <http://www.w3.org/2004/02/skos/core#>. \n' +
      '@prefix dc: <http://purl.org/dc/elements/1.1/>.\n' +
      `@prefix n0: <${configData.base}`;

  configData.vocabularies.forEach((voc: VocabularyData) => {
    const vocFilename = fileList[ConfigFileFactory.getFilenameSource(voc).toUpperCase()];
    if (!vocFilename) {
      console.log(`\x1b[0;33mWARNING\x1b[0m file '${dataFolder}/${voc.id}.csv' not found - ignore`);
      return;
    }

    const outPath = `${outputFolder}/${ConfigFileFactory.getFilenameTarget(voc)}`;
    const baseUrl = 'n0:';
    const { mainTitles, creators, mainDescription } = getConceptSchemeStrings(configData, voc);
    // eslint-disable-next-line max-len
    const license = `${configData.license ? `${configData.license};\n` : '<https://creativecommons.org/publicdomain/zero/1.0/deed.de>;\n'}`;

    let footer = `${baseUrl}\n` +
        '\ta skos:ConceptScheme;\n' +
        `\tdct:creator ${creators};\n` +
        `\tdct:title ${mainTitles};\n${
          // eslint-disable-next-line max-len
          mainDescription ? `\tdct:description ${mainDescription};\n` : `\tdc:title ${mainTitles};\n\tdc:description ${mainTitles};\n`
        }\tdct:license ${license}` +
        '\tskos:hasTopConcept';

    const data = CsvFactory.load(vocFilename, csvDelimiter, false);
    if (data && data.length > 0) {
      console.log(`Processing '${vocFilename}': ${data.length} records found`);
      let stout = `${stoutBase}/${voc.id}/>. \n\n`;

      const urlStack: string[] = [baseUrl];
      let nodesStack: string[] = [];
      const bodyStack: string[] = [];
      const nodeNodesStack: string[][] = [];
      const numLang = configData.title.length;

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const deep = getNotationDeep(d.notation.toString().trim());
        const deepNext = (i + 1 < data.length) ? getNotationDeep(data[i + 1].notation.toString().trim()) : 1;

        const oldUrl = urlStack[urlStack.length - 1];
        const newUrl = `n0:${d.id}`;
        const prefLabel = getPrefLabel(d, voc, numLang);
        const desc = getDefinition(d, voc, numLang);

        let body = `${newUrl}\n\ta skos:Concept;\n` +
            `\tskos:inScheme ${baseUrl};\n` +
            `\tskos:notation "${d.notation}";\n${
              oldUrl === baseUrl ? `\tskos:topConceptOf ${oldUrl};\n` : `\tskos:broader ${oldUrl};\n`
            }\tskos:prefLabel ${prefLabel}`;

        if (deepNext <= deep) {
          if (d.description !== '') {
            body += `; \n\tskos:definition ${desc}.\n`;
          } else body += '.\n';
          nodesStack.push(newUrl);
          stout += body;

          if (deepNext < deep) {
            nodeNodesStack.push(nodesStack);
            let dif = deep - deepNext;
            while (dif > 0) {
              urlStack.pop();
              let oldBody = bodyStack.pop();
              const tempNodesStack = nodeNodesStack.pop();
              if (tempNodesStack) {
                oldBody += `;\n\tskos:narrower ${tempNodesStack.join(',\n\t\t')}.`;
                stout += `${oldBody}\n`;
              }
              dif -= 1;
            }
            nodesStack = nodeNodesStack.pop() as string[];
          }
        } else {
          if (d.description !== '') body += `; \n\tskos:definition ${desc}`;
          bodyStack.push(body);
          nodesStack.push(newUrl);
          nodeNodesStack.push(nodesStack);
          nodesStack = [];
          urlStack.push(newUrl);
        }
      }

      footer += `\n\t\t${nodesStack.join(',\n\t\t')}.`;
      stout += footer;
      fs.writeFileSync(outPath, stout, { encoding: 'utf8' });
    } else {
      console.log(`\x1b[0;33mWARNING\x1b[0m Errors in file '${vocFilename}' - ignore`);
    }
  });
}

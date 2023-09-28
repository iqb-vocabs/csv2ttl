#!/usr/bin/env node
import { parse as csv_parse} from 'csv-parse/sync';

const fs = require('fs');
const schema_filename = `${__dirname}/csv2ttl_config.schema.json`;

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;
let output_folder = './dist';
if (process.argv[3]) {
    output_folder = process.argv[3];
}

function getNotationDeep(notation: string): number{
    return (notation.split(".")).length;
}



if (config_data) {
    // todo: use config_data.creator ??;

    let fileList: { [name: string]: string } = {};
    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });
    const csvDelimiter = config_data.csv_delimiter || ';';

    let stout_base:string = "@prefix dct: <http://purl.org/dc/terms/>.\n" +
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#>. \n"+
        `@prefix n0: <${config_data.base}`;

    config_data.vocabularies.forEach((voc: any) => {
        if (config_data) {
            const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
            const header = `${stout_base}/${voc.id}/#>. \n` +
                `@prefix n1: <${config_data.base}/${voc.id}/>. \n\n`;
            const out_path = `${output_folder}/${voc.title[0].value.replace(/ /g, "_")}.ttl`;
            const baseUrl = "n0:";
            let footer = "";
            if (voc.description[0].value === "")
                footer = `${baseUrl}\n` +
                    `\ta skos:ConceptScheme;\n` +
                    `\tdct:creator "${config_data.creator}"@${voc.title[0].lang};\n` +
                    `\tdct:title "${config_data.title[0].value.replace('^',';')} - ${voc.title[0].value.replace('^',';')}"@${voc.title[0].lang};\n` +
                    `\tskos:hasTopConcept`;
            else
                footer = `${baseUrl}\n` +
                    `\ta skos:ConceptScheme;\n` +
                    `\tdct:creator "${config_data.creator}"@${voc.title[0].lang};\n` +
                    `\tdct:title "${config_data.title[0].value.replace('^',';')} - ${voc.title[0].value.replace('^',';')}"@${voc.title[0].lang};\n` +
                    `\tdct:description "${voc.description[0].value.replace('^',';')}"@${voc.description[0].lang.replace('^',';')};\n` +
                    `\tskos:hasTopConcept`;

            let stout = header;

            if (voc_filename) {
                let data;
                try {
                    const data_raw = fs.readFileSync(voc_filename, 'utf8');
                    data = csv_parse(data_raw, {
                        columns: true,
                        skip_empty_lines: true,
                        delimiter: csvDelimiter
                    });
                } catch (err) {
                    console.log(`\x1b[0;33mWARNING\x1b[0m reading and parsing csv file '${voc_filename}' failed - ignore:`);
                    console.error(err);
                    data = null;
                }

                if (data && data.length > 0) {
                    console.log(`Processing '${voc_filename}': ${data.length} records found`);
                    // initiation of variables for loop:
                    let actualDeep = 1;
                    let urlStack: string[] = [];
                    let nodesStack: string[] = [];
                    let bodyStack: string[] = [];
                    let nodeNodesStack: string[][] = [];
                    let oldUrl = baseUrl;
                    const num = data.length;

                    urlStack.push(baseUrl);
                    for (let i = 0; i < num; i++) {
                        let d = data[i];
                        let deep = getNotationDeep(d.notation);
                        let deepNext = deep;

                        // check the deep of the next record
                        if ((i + 1) < num) {
                            let s = data[i + 1];
                            deepNext = getNotationDeep(s.notation);
                        } else {
                            deepNext = 1;
                        }
                        if (deepNext === deep || deepNext < deep) {
                            oldUrl = urlStack[urlStack.length - 1];
                            const newUrl = `n1:${d.id}`;
                            let body = `${newUrl}\n`;
                            if (oldUrl === baseUrl)
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:topConceptOf ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title.replace('^',';')}"@${voc.title[0].lang}`;
                            else
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title.replace('^',';')}"@${voc.title[0].lang}`;
                            if (d.description != "")
                                body = body + `; \n\tskos:description "${d.description.replace('^',';')}"@${voc.title[0].lang}. \n`;
                            else
                                body = body + `.\n`;
                            nodesStack.push(newUrl);
                            stout = `${stout}${body}`;

                            //In this case I have to write out the father with the nodesStack
                            if (deepNext < deep) {
                                nodeNodesStack.push(nodesStack);
                                let dif = deep - deepNext;
                                while (dif > 0) {
                                    urlStack.pop();
                                    let oldBody = bodyStack.pop();
                                    let nodesStack = nodeNodesStack.pop();
                                    if (nodesStack != undefined) {
                                        oldBody = `${oldBody};\n` +
                                            `\tskos:narrower `;
                                        nodesStack.forEach(function (node) {
                                            oldBody = oldBody + `\n\t\t${node},`
                                        });
                                        oldBody = oldBody?.replace(/.$/, ".");
                                        stout = `${stout}${oldBody}\n`;
                                    }
                                    dif--;
                                }
                                // @ts-ignore
                                nodesStack = nodeNodesStack.pop();
                                actualDeep = deep;
                            }
                        } else {/*If the deep of the next more than me. Actions:
                                    1. Store body of myself
                                    2. Store the actual nodesStack at nodeNodesStack
                                    3. Store the actual father
                                    4. Empty the nodesStack
                                    5. Store the actual deep
                                */

                            let oldUrl = urlStack[urlStack.length - 1];
                            const newUrl = `n1:${d.id}`;
                            let body = `${newUrl}\n`;
                            if (oldUrl === baseUrl)
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${oldUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:topConceptOf ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title.replace('^',';')}"@${voc.title[0].lang}`;
                            else
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title.replace('^',';')}"@${voc.title[0].lang}`;
                            if (d.description != "")
                                body = body + `; \n\tskos:description "${d.description.replace('^',';')}"@${voc.title[0].lang} `;

                            bodyStack.push(body);
                            nodesStack.push(newUrl);
                            nodeNodesStack.push(nodesStack);
                            nodesStack = [];
                            urlStack.push(newUrl);
                            actualDeep = deep;
                        }
                    }

                    nodesStack.forEach(function (node) {
                        footer = footer + `\n\t\t${node},`
                    })

                    footer = footer.replace(/.$/, ".");
                    stout = `${stout}${footer}`;

                    fs.writeFileSync(out_path, stout, {encoding: 'utf8'});
                } else {
                    console.log(`\x1b[0;33mWARNING\x1b[0m File '${voc_filename}' empty - ignore`);
                }
            } else {
                console.log(`\x1b[0;33mWARNING\x1b[0m File '${data_folder}/${voc.id}.csv' not found - ignore`);
            }
        }
    });
}

#!/usr/bin/env node
import {ConfigFileFactory} from "./config-file.factory";
import {CsvFactory} from "./csv.factory";

const fs = require('fs');

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}

function getNotationDeep(notation: string): number{
    return (notation.split(".")).length;
}

const config_data = ConfigFileFactory.load(data_folder);
if (config_data) {
    let output_folder = '.';
    if (config_data.outDir) {
        output_folder = config_data.outDir;
        if (!fs.existsSync(output_folder)){
            fs.mkdirSync(output_folder);
        }
    }
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
            console.log(`${voc.id}: ${voc.filenameSource}, ${voc.filenameTarget}`)
            let voc_filename = (voc.filenameSource || voc.id).toUpperCase();
            if (!voc_filename.endsWith('.CSV')) voc_filename += '.CSV';
            voc_filename = fileList[voc_filename];
            let out_path = voc.filenameTarget;
            if (!out_path && voc.filenameSource) {
                out_path = voc.filenameSource;
                if (out_path.toUpperCase().endsWith('.CSV')) out_path = out_path.substring(-4) + '.ttl';
            }
            if (!out_path) out_path = voc.id;
            if (!out_path.toUpperCase().endsWith('.TTL')) out_path += '.ttl';
            out_path = `${output_folder}/${out_path}`;
            const header = `${stout_base}/${voc.id}/#>. \n` +
                `@prefix n1: <${config_data.base}/${voc.id}/>. \n\n`;
            const baseUrl = "n0:";
            let footer = "";
            if (voc.description[0].value === "")
                footer = `${baseUrl}\n` +
                    `\ta skos:ConceptScheme;\n` +
                    `\tdct:creator "${config_data.creator}"@${voc.title[0].lang};\n` +
                    `\tdct:title "${config_data.title[0].value} - ${voc.title[0].value}"@${voc.title[0].lang};\n` +
                    `\tskos:hasTopConcept`;
            else
                footer = `${baseUrl}\n` +
                    `\ta skos:ConceptScheme;\n` +
                    `\tdct:creator "${config_data.creator}"@${voc.title[0].lang};\n` +
                    `\tdct:title "${config_data.title[0].value} - ${voc.title[0].value}"@${voc.title[0].lang};\n` +
                    `\tdct:description "${voc.description[0].value}"@${voc.description[0].lang};\n` +
                    `\tskos:hasTopConcept`;

            let stout = header;

            if (voc_filename) {
                const data = CsvFactory.load(voc_filename, csvDelimiter, false);
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
                                    `\tskos:prefLabel "${d.title}"@${voc.title[0].lang}`;
                            else
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title}"@${voc.title[0].lang}`;
                            if (d.description != "")
                                body = body + `; \n\tskos:description "${d.description}"@${voc.title[0].lang}. \n`;
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
                                    `\tskos:prefLabel "${d.title}"@${voc.title[0].lang}`;
                            else
                                body = `${body}\t a skos:Concept;\n` +
                                    `\tskos:inScheme ${baseUrl};\n` +
                                    `\tskos:notation "${d.notation}";\n` +
                                    `\tskos:broader ${oldUrl};\n` +
                                    `\tskos:prefLabel "${d.title}"@${voc.title[0].lang}`;
                            if (d.description != "")
                                body = body + `; \n\tskos:description "${d.description}"@${voc.title[0].lang} `;

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
                    console.log(`\x1b[0;33mWARNING\x1b[0m Errors in file '${voc_filename}' - ignore`);
                }
            } else {
                console.log(`\x1b[0;33mWARNING\x1b[0m file '${data_folder}/${voc.id}.csv' not found - ignore`);
            }
        }
    });
}

import { parse as csv_parse} from 'csv-parse/sync';

const fs = require('fs');
const Ajv = require("ajv")
const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const schema_filename ='csv2ttl_config.schema.json';
const config_filename = `${data_folder}/csv2ttl_config.json`;

function getNotationDeep(notation: string): number{
    return (notation.split(".")).length;
}

let schema;
let config_data: unknown = null;
try {
    schema = fs.readFileSync(schema_filename, 'utf8');
} catch (err) {
    console.log(`\x1b[0;31mERROR\x1b[0m reading schema '${schema_filename}':`);
    console.error(err);
    process.exitCode = 1;
    schema = null;
}
if (schema) {
    try {
        compiledSchema = ajv.compile(JSON.parse(schema))
    } catch (err) {
        console.log(`\x1b[0;31mERROR\x1b[0m parsing schema '${schema_filename}':`);
        console.error(err);
        process.exitCode = 1;
        compiledSchema = null;
    }
    if (compiledSchema) {
        if (fs.existsSync(config_filename)) {
            try {
                const config_data_raw = fs.readFileSync(config_filename, 'utf8');
                config_data = JSON.parse(config_data_raw);
            } catch (err) {
                console.log(`\x1b[0;31mERROR\x1b[0m reading and parsing config file '${config_filename}':`);
                console.error(err);
                process.exitCode = 1;
            }
            if (config_data) {
                try {
                    const valid = compiledSchema ? compiledSchema(config_data) : null;
                    if (valid) {
                        console.log(`use config file '${config_filename}'`);
                    } else {
                        console.log(`\x1b[0;31mERROR\x1b[0m invalid config file '${config_filename}':`);
                        console.error(compiledSchema ? compiledSchema.errors : 'error unknown')
                        process.exitCode = 1;
                    }
                } catch (err) {
                    console.log(`\x1b[0;31mERROR\x1b[0m invalid config file '${config_filename}':`);
                    console.error(err);
                    process.exitCode = 1;
                }
            }
        } else {
            console.log(`\x1b[0;31mERROR\x1b[0m config file '${config_filename}' not found`);
            process.exitCode = 1;
        }
    }
}
if (config_data) {
    const creator = config_data.creator;

    let fileList: { [name: string]: string } = {};
    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });
    const csvDelimiter = config_data.csv_delimiter || ';';

    let stout_base:string = "@prefix dct: <http://purl.org/dc/terms/>.\n" +
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#>. \n"+
        `@prefix n0: <${config_data.base}`;

    config_data.vocabularies.forEach((voc: any) => {

        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        const header = `${stout_base}${config_data.group}/${voc.id}/#>. \n`+
            `@prefix n1: <${config_data.base}${config_data.group}/${voc.id}/>. \n\n`;
        const out_path  = `./dist/${voc.title[0].value.replace(/ /g,"_")}.ttl`;
        const baseUrl="n0:";
        let footer = `${baseUrl}\n`+
            `\ta skos:ConceptScheme;\n`+
            `\tdct:creator "${config_data.creator}"@${voc.title[0].lang};\n`+
            `\tdct:title "${config_data.title[0].value} - ${voc.title[0].value}"@${config_data.title[0].lang};\n`+
            `\tskos:hasTopConcept`
        let stout = header;

        if (voc_filename) {
            console.log(`Processing '${voc_filename}'`);
            const data_raw = fs.readFileSync(voc_filename, 'utf8');
            const data = csv_parse(data_raw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: csvDelimiter
            });

            if (data && data.length > 0) {
                console.log(`${data.length} records found`);
                // initiation of variables for loop:
                let actualDeep = 1;
                let urlStack: string[]=[];
                let nodesStack: string[]=[];
                let bodyStack: string[]=[];
                let nodeNodesStack :string[][]=[];
                let oldUrl= baseUrl;
                const num = data.length;

                urlStack.push(baseUrl);
                for (let i=0; i< num; i++){
                    let d = data[i];
                    let deep = getNotationDeep(d.notation);
                    let deepNext = deep;

                    // check the deep of the next record
                    if ((i+1) < num) {
                        let s = data[i + 1];
                        deepNext = getNotationDeep(s.notation);
                    }else {
                        deepNext = 1;
                    }
                    if (deepNext===deep || deepNext < deep) {
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
                        if (deepNext < deep){
                            nodeNodesStack.push(nodesStack);
                            let dif = deep - deepNext;
                            while(dif > 0) {
                                urlStack.pop();
                                let oldBody = bodyStack.pop();
                                let nodesStack = nodeNodesStack.pop();
                                if (nodesStack != undefined) {
                                    oldBody = `${oldBody};\n`+
                                            `\tskos:narrower `;
                                    nodesStack.forEach(function (node) {
                                        oldBody = oldBody + `\n\t\t${node},`
                                    });
                                    oldBody = oldBody?.replace(/.$/,".");
                                    stout = `${stout}${oldBody}\n`;
                                }
                                dif --;
                            }
                            // @ts-ignore
                            nodesStack = nodeNodesStack.pop();
                            actualDeep = deep;
                        }
                    }else{/*If the deep of the next more than me. Actions:
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

                nodesStack.forEach(function(node){
                    footer = footer + `\n\t\t${node},`
                })

                footer = footer.replace(/.$/,".");
                stout = `${stout}${footer}`;

                fs.writeFile(out_path, stout, {encoding:'utf8'}, () => console.error(""));

            } else {
                console.log(`\x1b[0;31mERROR\x1b[0m File '${voc_filename}' empty`);
            }
        } else {
            console.log(`\x1b[0;31mERROR\x1b[0m File '${data_folder}/${voc.id}.csv' not found`);
        }
    });

} else {
    console.log(`\x1b[0;31mERROR\x1b[0m File '${config_filename}' not found`);
    process.exitCode = 1;
}

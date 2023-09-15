import { parse as csv_parse} from 'csv-parse/sync';
import {Namespace, graph, literal, NamedNode} from "rdflib";

// the library we need
const fs = require('fs');
const rdflib = require('rdflib');

const DCTERMS = Namespace("http://purl.org/dc/terms/")
const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS = Namespace("http://www.w3.org/2004/02/skos/core#");

// Check the data folder
let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;

// functions
function getNotationDeep(notation: string): number{
    return (notation.split(".")).length;
}

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

    let stout_base:string = "@prefix dct: <http://purl.org/dc/terms/>.\n" +
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#>. \n"+
        `@prefix n0: <${config_data.base}`;
    console.log(stout_base);

    // for each vocabular csv file: read the data and add the data to the graph
    config_data.vocabularies.forEach((voc: any) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        const filename = voc_filename.split(".")[1].split("/")[2];
        let header = `${stout_base}${filename}/#>. \n`+
            `@prefix n1: <${config_data.base}${filename}/>. \n\n`;
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
                const out_path  = "./dist/"+filename+".ttl";
                console.log(`${data.length} records found`);
                const baseUrl="n0:";
                let footer = `${baseUrl}\n`+
                    `\ta skos:ConceptScheme;\n`+
                    `\tdct:creator "${config_data.creator}"@de;\n`+
                    `\tdct:title "${filename}"@de;\n`+
                    `\tskos:hasTopConcept`

                // initiation of variables for loop:
                let actualDeep = 1;
                let urlStack: string[]=[];
                let nodesStack: string[]=[];
                let actualUrl = baseUrl;
                let oldUrl= baseUrl;
                urlStack.push(baseUrl);

                //We do need to take into account also the next register before,
                //data.forEach((d: any) => {
                for (let i=0; i< data.length; i++){
                    let d = data[i];
                    let deep = getNotationDeep(d.notation);
                    if (actualDeep == deep) {
                        // Case: same level
                    } else if (actualDeep < deep) {
                        // Case: deeper level, the new elements are subelements of the previous element
                        urlStack.push(actualUrl);
                        actualDeep = deep;

                    } else {
                        // Case: higher level: the new element belong to a higher hierarchy.
                        let dif = actualDeep - deep;
                        while(dif > 0){
                            urlStack.pop();
                            // And write out the narrower
                            dif --;
                        }
                        actualDeep = deep;
                    }

                    let oldUrl = urlStack[urlStack.length-1];      //get the last element and do not pop()
                    const newUrl = `n1:${d.id}`;
                    let pbody = `${newUrl}\n`;
                    const notation = d.notation;
                    const title = d.title;
                    const description = d.description;
                    pbody = `${pbody}\t a skos:Concept;\n`+
                            `\tskos:inScheme ${oldUrl};\n`+
                            `\tskos:notation "${notation}";\n`+
                            `\tskos:topConceptOf ${oldUrl};\n`+
                            `\tskos:prefLabel "${title}"@de`;
                    if (description != "")
                        pbody = pbody + `; \n\tskos:description "${description}"@de. \n`;
                    else
                        pbody = pbody + `.\n`;
                    nodesStack.push(newUrl);
                    stout = `${stout}${pbody}`;

                  //  const newUrl = g.sym(base_url1+`/`+`${d.id}`);
                  //   g.add(newUrl, RDF('type'), SKOS('Concept') );
                  //   g.add(newUrl, SKOS('inScheme'), baseUrl);
                  //   g.add(newUrl, SKOS('notation'), literal(`${d.notation}`));
                  //   g.add(newUrl, SKOS('prefLabel'), literal(`${d.title}`, 'de'));
                  //   if (d.description != "")
                  //       g.add(newUrl, SKOS('description'), literal(`${d.description}`, 'de'));
                  //   if (baseUrl === oldUrl) {
                  //       g.add(oldUrl, SKOS('hasTopConcept'), newUrl);
                  //       g.add(newUrl, SKOS('topConceptOf'), oldUrl);
                  //   }else {
                  //       g.add(newUrl, SKOS('broader'), oldUrl);
                  //       g.add(oldUrl, SKOS('narrower'), newUrl);
                  //   }
                  //   actualUrl = newUrl;
                };
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

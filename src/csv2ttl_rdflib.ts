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

    // for each vocabular csv file: read the data and add the data to the graph
    config_data.vocabularies.forEach((voc: any) => {
        const voc_filename = fileList[`${voc.id.toUpperCase()}.CSV`];
        if (voc_filename) {
            console.log(`Processing '${voc_filename}'`);
            const data_raw = fs.readFileSync(voc_filename, 'utf8');
            const data = csv_parse(data_raw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: csvDelimiter
            });

            if (data && data.length > 0) {
                const filename = voc_filename.split(".")[1].split("/")[2];
                const out_path  = `./dist/${voc.title[0].value.replace(/ /g,"_")}.ttl`;
                console.log(`${data.length} records found`);
                const g = graph();
                //const base_url1 ="https://w3id.org/iqb/"+filename
                const base_url1 =`${config_data.base}${config_data.group}/${voc.id}`;
                //const baseUrl = g.sym("https://w3id.org/iqb/"+filename+`/#`);
                const baseUrl = g.sym(`${base_url1}/#`);
                g.add(baseUrl, RDF('type'), SKOS('ConceptScheme'));
                g.add(baseUrl, DCTERMS('title'), literal(`${config_data.title[0].value} - ${voc.title[0].value}`,'de'));
                g.add(baseUrl, DCTERMS('creator'), literal(creator,'de'));

                // initiation of variables for loop:
                let actualDeep = 1;
                let urlStack: NamedNode[]=[];
                let actualUrl = baseUrl;
                urlStack.push(baseUrl);

                data.forEach((d: any) => {
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
                            urlStack.pop()
                            dif --;
                        }
                        actualDeep = deep;
                    }
                    let oldUrl = urlStack[urlStack.length-1];      //get the last element and do not pop()
                    const newUrl = g.sym(base_url1+`/`+`${d.id}`);
                    g.add(newUrl, RDF('type'), SKOS('Concept') );
                    g.add(newUrl, SKOS('inScheme'), baseUrl);
                    g.add(newUrl, SKOS('notation'), literal(`${d.notation}`));
                    g.add(newUrl, SKOS('prefLabel'), literal(`${d.title}`, 'de'));
                    if (d.description != "")
                        g.add(newUrl, SKOS('description'), literal(`${d.description}`, 'de'));
                    if (baseUrl === oldUrl) {
                        g.add(oldUrl, SKOS('hasTopConcept'), newUrl);
                        g.add(newUrl, SKOS('topConceptOf'), oldUrl);
                    }else {
                        g.add(newUrl, SKOS('broader'), oldUrl);
                        g.add(oldUrl, SKOS('narrower'), newUrl);
                    }
                    actualUrl = newUrl;
                });

                const output = rdflib.serialize(null, g,undefined,'text/turtle');
                fs.writeFile(out_path, output, {encoding:'utf8'}, () => console.error(""));

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

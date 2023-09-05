import { parse as csv_parse} from 'csv-parse/sync';
import {Namespace, graph, literal} from "rdflib";

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;

const fs = require('fs');
const rdflib = require('rdflib');

const DCTERMS = Namespace("http://purl.org/dc/terms/")
const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS = Namespace("http://www.w3.org/2004/02/skos/core#");

if (fs.existsSync(config_filename)) {
    const config_data_raw = fs.readFileSync(config_filename, 'utf8');
    // todo: validate config file
    const config_data = JSON.parse(config_data_raw);
    const creator = config_data.creator;
    console.log(creator);
    let fileList: { [name: string]: string } = {};
    fs.readdirSync(data_folder).forEach((file: string) => {
        fileList[file.toUpperCase()] = `${data_folder}/${file}`;
    });

    const csvDelimiter = config_data.csv_delimiter || ';';
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
                const out_path  = "./dist/"+filename+".ttl";
                console.log(`${data.length} records found`);

                const g = graph();
                const base_url1 ="https://w3id.org/iqb/"+filename
                const base_url = g.sym("https://w3id.org/iqb/"+filename+`/#`);
                g.add(base_url, RDF('type'), SKOS('ConceptScheme'));
                g.add(base_url, DCTERMS('title'), literal(filename,'de'));
                g.add(base_url, DCTERMS('creator'), literal(creator,'de'));

                data.forEach((d: any) => {
                    const c_url = g.sym(base_url1+`/`+`${d.id}`);
                    g.add(c_url, RDF('type'), SKOS('Concept') );
                    g.add(c_url, SKOS('inScheme'), base_url);
                    g.add(c_url, SKOS('prefLabel'), literal(`${d.title}`,'de'));
                    if (d.description !="")
                        g.add(c_url, SKOS('description'), literal(`${d.description}`,'de'));
                    g.add(base_url, SKOS('hasTopConcept'), c_url);
                    g.add(c_url, SKOS('notation'), literal(`${d.notation}`));
                });

                const output = rdflib.serialize(null, g,undefined,'text/turtle');
                console.log(output);
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

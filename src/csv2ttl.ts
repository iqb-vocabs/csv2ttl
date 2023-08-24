import { parse as csv_parse} from 'csv-parse/sync';
import {Namespace} from "rdflib";
// import { graph, Literal, Namespace } from 'rdflib';

let data_folder = '.';
if (process.argv[2]) {
    data_folder = `${data_folder}/${process.argv[2]}`;
}
const config_filename = `${data_folder}/csv2ttl_config.json`;
const fs = require('fs');
const rdflib = require('rdflib');
const DCTERMS = Namespace("http://purl.org/dc/terms/#");
const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const SKOS = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const XSD = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");

if (fs.existsSync(config_filename)) {
    const config_data_raw = fs.readFileSync(config_filename, 'utf8');
    // todo: validate config file
    const config_data = JSON.parse(config_data_raw);

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
                console.log(`${data.length} records found`);
                /***
                console.log(`Processing '${voc_filename}'`);
                const g = rdflib.graph();
                data.forEach((d: any) => {
                    const cc_url = rdflib.uri(d.id);
                    g.add(cc_url, rdflib.type, `yo yo ${d.title}`);
                    g.add(rdflib.uri(d.id), RDF.type, SKOS.ConceptScheme);
                    // g.add((base_url, DCTERMS.title, Literal(title, lang="de")))

                    // g.add((cc_url, SKOS.prefLabel, Literal(cc['notation'] +". "+ cc['title'], lang="de")))

                    // f.add(new );
                });
                console.log(g.serialize(rdflib.uri('yoyo.htm'), 'turtle', ''));
                 ***/
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

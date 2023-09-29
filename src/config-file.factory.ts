import Ajv from "ajv";

export interface VocabularyData {
    id: string;
    title: {
        lang: string;
        value: string
    }[];
    description: {
        lang: string;
        value: string
    }[];
}
export interface ConfigData {
    id: string;
    title: {
        lang: string;
        value: string
    }[];
    csv_delimiter: string;
    base: string;
    outDir: string;
    idPattern: string;
    creator: any;
    vocabularies: VocabularyData[];
}

export abstract class ConfigFileFactory {
    public static load(data_folder: string): ConfigData | null {
        const fs = require('fs');
        const schemaFilename = `${__dirname}/csv2ttl_config.schema.json`;
        const configFilename = `${data_folder}/csv2ttl_config.json`;
        let schema;
        let configData: ConfigData | null = null;
        try {
            schema = fs.readFileSync(schemaFilename, 'utf8');
        } catch (err) {
            console.log(`\x1b[0;31mERROR\x1b[0m reading schema '${schemaFilename}':`);
            console.error(err);
            process.exitCode = 1;
            schema = null;
        }
        if (schema) {
            let compiledSchema;
            const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}
            try {
                compiledSchema = ajv.compile(JSON.parse(schema))
            } catch (err) {
                console.log(`\x1b[0;31mERROR\x1b[0m parsing schema '${schemaFilename}':`);
                console.error(err);
                process.exitCode = 1;
                compiledSchema = null;
            }
            if (compiledSchema) {
                if (fs.existsSync(configFilename)) {
                    try {
                        const config_data_raw = fs.readFileSync(configFilename, 'utf8');
                        configData = JSON.parse(config_data_raw);
                    } catch (err) {
                        console.log(`\x1b[0;31mERROR\x1b[0m reading and parsing config file '${configFilename}':`);
                        console.error(err);
                        configData = null;
                        process.exitCode = 1;
                    }
                    if (configData) {
                        try {
                            const valid = compiledSchema ? compiledSchema(configData) : null;
                            if (valid) {
                                console.log(`use config file '${configFilename}'`);
                            } else {
                                console.log(`\x1b[0;31mERROR\x1b[0m invalid config file '${configFilename}':`);
                                console.error(compiledSchema ? compiledSchema.errors : 'error unknown')
                                configData = null;
                                process.exitCode = 1;
                            }
                        } catch (err) {
                            console.log(`\x1b[0;31mERROR\x1b[0m invalid config file '${configFilename}':`);
                            console.error(err);
                            configData = null;
                            process.exitCode = 1;
                        }
                    }
                } else {
                    console.log(`\x1b[0;31mERROR\x1b[0m config file '${configFilename}' not found`);
                    process.exitCode = 1;
                }
            }
        }
        return configData;
    }
}



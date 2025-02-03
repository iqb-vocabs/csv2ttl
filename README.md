[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![npm](https://img.shields.io/npm/v/%40iqb%2Fcsv2ttl)

Use this package to transform vocabularies from csv files of specific format to ttl files.


It's a pain to write ttl-files manually. But it's also a great idea to provide metadata vocabularies via ttl-files, especially if one uses [skos](https://www.w3.org/2004/02/skos/) or even [skohub](https://skohub.io/) to generate shiny html or handy json.

So we support only a special use case of ttf/rdf: Hierarchical vocabularies. Here we use these attributes of rtf:
* `prefLabel` (required): Multilingual name of the entry,
* `definition`: Multilingual description to give more information about the entry, and
* `notation`: Semver-like enumeration mainly to describe the hierarchy, like `2.4.3`.  

## Workflow

### 1. First write the csv-File(s)

Look at the simplest example:
```csv
notation,title,description,id
,geschlossen,,
,halboffen,,
,offen,,
```
The first line and therefor the description of data structure is required. You see, that only the title is given. 
See below the [notation](#notation) paragraph. 

### 2. Write csv2ttl_config.json
There is one json-file to provide with some parameters for the generation process. The idea is, that one (git)-repository contains of multiple vocabularies describing one common issue. We call this repo a 'vocabulary-group'. The config file lists all vocabularies with id and name. 

### 3. Add IDs
Adding IDs is a precondition for the generation of ttl-files. This csv2ttl-package contains of two commands: `addidcsv` and `csv2ttl`. Use the first one to add IDs to the csv-files. Every entry gets an id randomly. Existing ids will not be overwritten.

### 4. Generate
Use the `csv2ttl`-command to get the ttl-files.

## Create repo and install
First create a node repo. Precondition for that is of course a working node installation. Just create a new folder, go into this folder and type:
```
npm init
```
You will be prompted for some parameters. After that, type:
```
npm install @iqb/csv2ttl
```
Put all csv-files in that folder and write the `csv2ttl_config.json`.

After that, edit the `package.json` to have short access to the commands: 
```json
{
  "scripts": {
    "add": "addidcsv",
    "csv": "csv2ttl"
  }
}
```

To run these scripts, use your IDE or type
```
npm run add
npm run csv
```
If you like to store the source files in a separate folder, add a parameter when calling a script:
```
npm run add csv-src
```

## Customise: csv2ttl_config.json
This json-file lists all vocabularies (i.e. csv-files) to convert and provides additional parameters for the generation process.

| parameter     | description                                                                                                                                                                                                                                                       |                         default                          |
|:--------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------:|
| id            | this entry will be used to make up the uri                                                                                                                                                                                                                        |                        *required*                        |
| creator       | use this to include the owner/developer                                                                                                                                                                                                                           |                        *required*                        |
| title         | multilingual: use `lang` to set the language and `value` to set the content                                                                                                                                                                                       |                        *required*                        |
| csv_delimiter | possible values: ',' or ';'; the write process of the IDs will add quotes                                                                                                                                                                                         |                           ','                            |
| base          | base-url to form the uri of the voc                                                                                                                                                                                                                               |                        *required*                        |
| outDir        | target folder for the ttl-files                                                                                                                                                                                                                                   |                           '.'                            |
| idPattern     | when the IDs are generated, an external lib `randex` is used. This parameter value is directly given to this lib and must be an regular expression. It's kind of tricky and the lib is not free of problems, so play around with it before setting the parameter. | '^\[abcdefghprqstuvxyz]\[2345679]\[abcdefghprqstuvxyz]$' |
| vocabularies  | Here you let the generator know what files should be included. Each voc must have an id and a title. Additionally, you can provide a description, a filename for the source and a filename for the target.                                                        |                           '.'                            |

Before processing the config file it is validated. You'll get errors if it's malformed.

## Multi-language support
From the 0.7.6 csv2ttl supports multilanguage. 
The csv files should have the following format:

```csv
notation,title,description,id,title_en,description_en
,geschlossen,,,closed,
,halboffen,,,half open,
,offen,,,open,
```

The configuration example for multi-language support is available sample_data/csv2ttl_configEN.json. 

## [Notation](#notation)
The initial notation supported are:
* Character: allows empty notation and characters, as 'I', 'II', ''. See examples sample_data/3i.csv and sample_data/5e.csv
* Hierarchy: Semver-like enumeration mainly to describe the hierarchy, like `2.4.3`. See example sample_data/7e.csv 

From the version 0.8.2 csv2ttl support the special notation 
* Special (Character plus hierarchy): allows notation with a character plus Semver-like notation. like `S 2.4.3`.
See example sample_data/notation_charakter.csv and its corresponding csv2ttl_configCA.json


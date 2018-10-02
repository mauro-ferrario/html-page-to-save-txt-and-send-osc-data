const fs = require('fs');

module.exports = class Settings{
    constructor(){
        this.settings = {};
    }

    loadFromFile(filename){
        const contents = fs.readFileSync(filename);
        const tempSettings = JSON.parse(contents);
        this.settings = Object.assign(this.settings, tempSettings);
    }

    getAll(){
        return this.settings;
    }

    get(value){
        return this.settings[value];
    }

    add(name, value){
        this.settings[name] = value;
    }
}
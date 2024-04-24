require('dotenv').config();
const { mongo, default: mongoose, Schema, model, isObjectIdOrHexString } = require('mongoose');
const Logger = require('../logguer/logguer');



class Connect {
    constructor(mongooseInstance){
        this.mongoose = mongooseInstance
    };
    async connect(){
        try {
            await this.mongoose.connect(process.env.DB_URI,{});
            Logger.info('DB Connected')
        } catch (error) {
            Logger.error(error);
        }
    }
}

const db = new Connect(mongoose);
db.connect();
module.exports = {db,default: mongoose, Schema, model, isObjectIdOrHexString}
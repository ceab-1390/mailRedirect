//require('dotenv').config();
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const { mongo, Schema, model, isObjectIdOrHexString } = mongoose
//const Logger = require('../logguer/logguer');
import Logguer from '../logguer/logguer.js';



class Connect {
    constructor(mongooseInstance){
        this.mongoose = mongooseInstance
    };
    async connect(){
        try {
            await this.mongoose.connect(process.env.DB_URI,{});
            Logguer.info('DB Connected')
        } catch (error) {
            Logguer.error(error);
        }
    }
}

const db = new Connect(mongoose);
db.connect();
//module.exports = {db,default: mongoose, Schema, model, isObjectIdOrHexString}
const defaultExport = {
    db,
    mongoose,
    Schema,
    model,
    isObjectIdOrHexString
   };
   
   export default defaultExport;
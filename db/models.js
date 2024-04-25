const logguer = require('../logguer/logguer');
const {db, default: mongoose, Schema, model, isObjectIdOrHexString} = require('./db');


const uidSchema = new mongoose.Schema({
    uid:{
      type: String,
      unique: true,
      required: true,
    },
    send:{
        type: Boolean,
        required: true,
        default: false,
    }  
  },{timestamps: true});

  const uidModel = mongoose.model('Uids',uidSchema);


class Uid{
    static async registerUidSend(obj){
        try {
            const send = await uidModel(obj);
            await send.save();
            return send;
        } catch (error) {
            logguer.error(error);
            return false;  
        }
    }

    static async findOne(obj){
        try {
            const uid = await uidModel.findOne({uid:obj});
            return uid
        } catch (error) {
            logguer.error(error); 
            return false;
        }
    }
    static async getAll(){
        try {
           const all = await uidModel.find();
           return all
        } catch (error) {
            logguer.error(error)
        }
    }
}


module.exports = {Uid}
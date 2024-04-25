//require('dotenv').config();
import dotenv from 'dotenv';
dotenv.config();
//const {Telegraf, Markup, session, Scenes, WizardScene} = require('telegraf');
import {Telegraf, Markup, session, Scenes} from 'telegraf'
import question from './IA/ia.js';
import logguer from './logguer/logguer.js';
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.on('message', (ctx)=>{
    try {
        question(ctx.message.text)
        .then(response => {
            ctx.reply(response);
        })
    } catch (error) {
      logguer.error(error)  
    }
  
})

bot.launch();

//module.exports = {bot};

export default {bot}
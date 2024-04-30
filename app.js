//require('dotenv').config();
//const Logguer = require('./logguer/logguer');
import Logguer  from './logguer/logguer.js';
//const Imap = require('imap');
import Imap from 'imap'
//const { simpleParser } = require('mailparser');
import {simpleParser} from 'mailparser'
//const moment = require('moment');
import moment from 'moment';
//const {bot} = require('./bot');
import botModule from './bot.js'
const {bot} = botModule
//const {Uid} = require('./db/models');
import uidModule from './db/models.js';
import createOne from './pdfMake.js';
const {Uid} = uidModule


const USER = process.env.TELEGRAM_USER_ID;
const TLS = process.env.IMAP_TLS
const TLS_VAL = TLS === 'true';
const regex = /(Error)|(Falla)|(Incidencia)|(VPTI)|(Invitacion)|(Reunion)|(CDC)/i;

let mails = [];
const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    tls: false
}

const imap = new Imap(imapConfig);
imap.once('ready', function() {
    Logguer.log('Conexión al correo establecida');
    imap.openBox('INBOX', true, function(err, box) {
        if (err) throw err;
        Logguer.log('Buzón abierto: ' + box.name);
            imap.on('mail', (cant)=>{
                const today = moment().format('MMM DD, YYYY');
                Logguer.log(today);
                let nuevos = cant;
                const searchCriteria = ['UNSEEN',['SINCE', today]];
                const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''], struct: true };
                imap.search(searchCriteria, function(err, results) {
                    if (err) throw err;
                    results = results.sort((a,b) => b - a );
                    for ( let i = 0; i < nuevos; i++ ){
                        Logguer.debug('#0):Correo obtenido ID: '+results[i])
                        const f = imap.fetch(results[i], fetchOptions);
                        f.on('message',async function(msg, seqno) {
                            msg.on('body',async  function(stream, info) {
                                simpleParser(stream, {},async (err, mail) => {
                                    if (err) throw err;
                                    mails[seqno] = {}
                                    mails[seqno].from = mail.from.text;
                                    mails[seqno].subject = mail.subject;
                                    mails[seqno].date = mail.date;
                                    mails[seqno].id = results[i];
                                    if (mail.text) {
                                        mails[seqno].text = mail.text;
                                        Logguer.debug('#1):===========TEXT==================')
                                        Logguer.debug(mail.text);
                                        Logguer.debug('#2):=========TEXT END================')
                                    }else if (mail.html){
                                        mails[seqno].text = mail.html;
                                        Logguer.debug('#3):===========HTML==================')
                                        Logguer.debug(mail.html);
                                        Logguer.debug('#4):=========END HTML================')
                                        
                                    }
                                });
                            });
                        });
                        f.once('error', function(err) {
                            Logguer.log('Error al fetch: ' + err);
                        });
                        f.once('end', function() {
                            Logguer.log('Fin de fetch');
                            let Filter = mails.filter(mail_f => {
                                const match = mail_f.subject.match(regex);
                                return match !== null;
                            });
    
                            Filter.forEach(async mail =>{
                                    Logguer.debug(mail)
                                    const match = mail.subject.match(regex);
                                    const tipo = match[1] ? 'Error' : match[2] ? 'Falla' : match[3] ? 'Incidencia' : match[4] ? 'VPTI' : match[5] ? 'Invitacion' : match[6] ? 'Reunion' : match[7] ? 'CDC' : Logguer.debug('No se encontro coincidencias con los parametros de busqueda...')
                                    Logguer.debug('#5):Coincidencia: '+mail.id+' '+mail.date+' tipo: '+ tipo);
                                    try {
                                        let findUid = await Uid.validUid(mail.uid);
                                        Logguer.debug('#8):=========================Validar UID==================================')
                                        Logguer.debug(findUid);
                                        if (findUid){
                                            throw new Error('Este correo ya fue enviado');
                                        }else{
                                            Logguer.debug('#6): Contenido de la variable text: ======================================================= ')
                                            Logguer.debug('#7): '+mail.text);
                                            await bot.telegram.sendMessage(USER, 'Grupo: '+tipo+'\n\nDe: '+mail.from+' \n\nAsunto: '+mail.subject+' \n\nContenido:\n\n'+mail.text);
                                            let data = {};
                                            data.uid = mail.id;
                                            data.send = true;
                                            let saving = await Uid.registerUidSend(data);
                                            if (!saving){
                                                Logguer.error('No se guardo el registro del UID');
                                            }else{
                                                Logguer.info('Se registro el uid como enviado')
                                            }
                                        }
                                    } catch (error) {
                                        if (error.message.includes('400: Bad Request: message is too long')){

                                            let data = {};
                                            let texto = mail.text
                                            texto = texto.trim().split('\n');
                                            texto = texto.map(texto => texto);
                                            data.texto = texto
                                            createOne(data).then(async results => {
                                                try {
                                                    await bot.telegram.sendDocument(USER,{source:results},{caption: 'Su correo es muy largo para ser enviado via texto, aqui tiene un pdf con el contenido:'})
                                                } catch (error) {
                                                    Logguer.error(error)
                                                }
                                            }).catch(error => {
                                                Logguer.error(error)
                                            })

                                            Logguer.debug('Se detecto un mensaje largo');
                                        }
                                        Logguer.error(error)
                                    }
                            })
                        });

                    };
                });
            });
    });
});

imap.once('error', (error) =>{
    Logguer.log(error)
});

imap.connect();




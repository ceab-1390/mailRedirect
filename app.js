require('dotenv').config();
const Logguer = require('./logguer/logguer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const moment = require('moment');
const {bot} = require('./bot');
const {Uid} = require('./db/models');



const TLS = process.env.IMAP_TLS
const TLS_VAL = TLS === 'true';
const regex = /(Error)|(Falla)|(Incidencia)|(VPTI-\d+)|(Invitacion)|(Reunion)|(CDC)/i;

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
    Logguer.log('Conexión establecida');
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
                        f.on('message', function(msg, seqno) {
                            msg.on('body',  function(stream, info) {
                                simpleParser(stream, {}, (err, mail) => {
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
                                    const match = mail.subject.match(regex);
                                    const tipo = match[1] ? 'Error' : match[2] ? 'Falla' : match[3] ? 'Incidencia' : match[4] ? 'VPTI' : match[5] ? 'Invitacion' : match[6] ? 'Reunion' : match[7] ? 'CDC' : Logguer.debug('No se encontro coincidencias con los parametros de busqueda...')
                                    Logguer.debug('#5):Coincidencia: '+mail.id+' '+mail.date+' tipo: '+ tipo);
                                    try {
                                        let findUid = await Uid.findOne(mail.uid);
                                        if (findUid){
                                            throw new Error('Este correo ya fue enviado');
                                        }else{
                                            Logguer.debug('#6): Contenido de la variable text: ======================================================= ')
                                            Logguer.debug('#7): '+mail.text);
                                            await bot.telegram.sendMessage('854982095', 'Grupo: '+tipo+'\n\nDe: '+mail.from+' \n\nAsunto: '+mail.subject+' \n\nContenido:\n\n'+mail.text);
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
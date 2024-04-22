require('dotenv').config();
const Logguer = require('./logguer/logguer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const moment = require('moment');
const {bot} = require('./bot');



const TLS = process.env.IMAP_TLS
const TLS_VAL = TLS === 'true';
//|(VPTI-\d+)
const regex = /(Error)|(Falla)|(Incidencia)/i;

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
        const today = moment().format('MMM DD, YYYY');
        Logguer.log(today);
            imap.on('mail', function(){
                // Buscar correos no leídos de hoy
                const searchCriteria = ['UNSEEN',['SINCE', today]];
                const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''], struct: true };

                imap.search(searchCriteria, function(err, results) {
                    if (err) throw err;

                    // Fetch los correos encontrados
                    const f = imap.fetch(results, fetchOptions);
                    f.on('message', function(msg, seqno) {
                        msg.on('body',  function(stream, info) {
                            simpleParser(stream, {}, (err, mail) => {
                                //Logguer.log(mail.headerLines)
                                if (err) throw err;
                                mails[seqno] = {}
                                mails[seqno].from = mail.from.text;
                                mails[seqno].subject = mail.subject;
                                mails[seqno].date = mail.date;
                                if (mail.text) {
                                    mails[seqno].text = mail.text;
                                }else if (mail.html){
                                    mails[seqno].text = mail.html
                                }
                            });
                        });
                    });
                    f.once('error', function(err) {
                        Logguer.log('Error al fetch: ' + err);
                    });
                    f.once('end', function() {
                        Logguer.log('Fin de fetch');
                        //let filterMail = mails.filter(mailfilter => regex.test(mailfilter.subject));
                        let Filter = mails.filter(mail_f => {
                            const match = mail_f.subject.match(regex);
                            return match !== null;
                        });

                        Filter.forEach(async mail =>{
                            const match = mail.subject.match(regex);
                            //Logguer.log(match)//match[3] ? 'VPTI' :
                                const tipo = match[1] ? 'Error' : match[2] ? 'Falla' : match[3] ? 'Incidencia' : Logguer.log('...')
                                // Logguer.log('================================================================================')
                                // Logguer.log('Grupo: '+tipo);
                                // Logguer.log(mail.subject);
                                // Logguer.log(mail.text)
                                Logguer.log('Send')
                                try {
                                    await bot.telegram.sendMessage('854982095', 'Grupo: '+tipo+' \n\nAsunto: '+mail.subject+' \n\nContenido:\n\n'+mail.text);
                                } catch (error) {
                                    Logguer.error(error)
                                }
                        })
                    });
                });
            });
    });
});

imap.once('error', (error) =>{
    Logguer.log(error)
});

imap.connect();
import Logguer  from './logguer/logguer.js';
import Imap from 'imap'
import {simpleParser} from 'mailparser'
import moment from 'moment';
import botModule from './bot.js'
const {bot} = botModule
import uidModule from './db/models.js';
import createOne from './pdfMake.js';
const {Uid} = uidModule


const USER = process.env.TELEGRAM_USER_ID;
const TLS = process.env.IMAP_TLS
const TLS_VAL = TLS === 'true';
const regex = /(Error)|(Falla)|(Incidencia)|(VPTI)|(Invitacion)|(Reunion)|(CDC)/i;

let mails = [];
let save = false;
let connect = false;
let aux = true;
const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    tls: false
};

const imap = new Imap(imapConfig);
imap.once('ready',async function() {
    connect = true;
    Logguer.log('Conexión al correo establecida');
    imap.openBox('INBOX', false,async function(err, box) {
        if (err) throw err;
        Logguer.log('Buzón abierto: ' + box.name);
        Logguer.debug("Total de mensajes: "+box.messages.total);
        await findMails()
    });
});

async function findMails(){
    Logguer.debug("#0): esperando nuevos correos ")
    imap.on('mail',async (cant)=>{
       //const cant = 1
        Logguer.debug("#1): Nuevo correo " + cant);
        const today = moment().format('MMM DD, YYYY');
        Logguer.log(today);
        let nuevos = cant;
        const searchCriteria = ['UNSEEN',['SINCE', today]];
        imap.search(searchCriteria,async function(err, results) {
            Logguer.debug(results);
            results = results.sort((a,b) => b - a );
            //const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''], struct: true, markSeen : false };
            const fetchOptions = { bodies: '', struct: true, markSeen : false };
            for (const result of results) {
                Logguer.debug("correos para procesar: "+result);
                const f = imap.fetch(result, fetchOptions);
                let consumed = false;
                f.once('message', function(msg, seqno) {
                    if (aux){
                        Logguer.debug('***********************************************I**********************************************')
                        Logguer.debug(seqno);
                        Logguer.debug('***********************************************N**********************************************')
                        Logguer.debug(msg);
                        Logguer.debug('***********************************************E**********************************************')
                    }
                    Logguer.debug("mensaje numero: "+seqno)
                    Logguer.debug("Procesando mensajes: "+seqno +" UID: "+result);
                    msg.on('body', function(stream, info) {
                        //codigo temporal pra evaluar los archivos adjuntos
                        if (aux){
                            Logguer.debug('***********************************************I**********************************************')
                            Logguer.debug(info);
                            Logguer.debug('***********************************************N**********************************************')
                            Logguer.debug(stream);
                            Logguer.debug('***********************************************E**********************************************')
                        }
                        if (!consumed){
                            simpleParser(stream, {},async (err, mail) =>{
                                if (aux){
                                    Logguer.debug('***********************************************I**********************************************')
                                    Logguer.debug(mail);
                                    Logguer.debug('***********************************************N**********************************************')
                                    Logguer.debug(err);
                                    Logguer.debug('***********************************************E**********************************************')
                                    aux = false;
                                }
                                if ( mail.text || mail.html ){
                                    //Logguer.debug("este es el texto :" + mail.text)
                                    Logguer.debug('\n\n======================'+seqno+' UID:'+ result+'=================================')
                                    Logguer.debug('tienen texto el: '+ seqno)
                                    mails[result] = {};
                                    mails[result].from = mail.from.text;
                                    mails[result].subject = mail.subject;
                                    mails[result].date = mail.date;
                                    mails[result].id = result;
                                    mails[result].text = mail.text ? mail.text : mail.html;
                                    mails[result].filter = false;
                                    //Logguer.debug(mails[seqno]);
                                    process.emit('parseEnd', result);//
                                    consumed = true;
                                }
                            })
                        };
                    });
                });
                process.once('parseEnd', async function(result){
                    f.once('end',async ()=>{
                        Logguer.debug(result + ' end')
                        Logguer.debug('=======================================================\n\n\n')
                        let Filter = mails.filter( async mail_f => {
                            const match = mail_f.subject.match(regex);
                            //Logguer.debug(match)
                            return match !== null;
                        });
                        Filter.forEach(async mailFilter =>{
                            if (!mails[mailFilter.id].filter){
                                Logguer.debug("El id filtrado es: "+mailFilter.id + " y el contenido del subject desde mails[result] es: "+ mails[mailFilter.id].id + " Marca de filtrado: "+mails[mailFilter.id].filter);
                                
                                const match = mailFilter.subject.match(regex);
                                //Logguer.debug(match)
                                if (match){
                                    const tipo = match[1] ? 'Error' : match[2] ? 'Falla' : match[3] ? 'Incidencia' : match[4] ? 'VPTI' : match[5] ? 'Invitacion' : match[6] ? 'Reunion' : match[7] ? 'CDC' : Logguer.debug('No se encontro coincidencias con los parametros de busqueda...')
                                    //Logguer.debug(match);
                                    Logguer.debug('Coincidencia: '+mailFilter.id+' '+mailFilter.date+' tipo: '+ tipo);
                                    try {
                                        let findUid = await Uid.validUid(mailFilter.id);
                                        Logguer.debug('=========================Validar UID================================== '+mailFilter.id)
                                        Logguer.debug(findUid);
                                        if (findUid){
                                           return new Error('Este correo ya fue enviado');
                                        }else{
                                            Logguer.debug('#): Contenido de la variable text: ======================================================= ')
                                            Logguer.debug('#): '+mailFilter.text);
                                            Logguer.info('Enviando mensaje via telegram')
                                            await bot.telegram.sendMessage(USER, 'Grupo: '+tipo+'\n\nDe: '+mailFilter.from+' \n\nAsunto: '+mailFilter.subject+' \n\nContenido:\n\n'+mailFilter.text);
                                            let data = {};
                                            data.uid = mailFilter.id;
                                            data.send = true;
                                            let saving = await Uid.registerUidSend(data);
                                            if (!saving){
                                                Logguer.error('No se guardo el registro del UID');
                                                save = false;
                                            }else{
                                                Logguer.info('Se registro el uid como enviado');
                                                save = true;
                                            }
                                        }
                                    } catch (error) {
                                        if (error.message.includes('400: Bad Request: message is too long')){

                                            let data = {};
                                            let texto = mailFilter.text;
                                            data.from = mailFilter.from;
                                            texto = texto.trim().split('\n');
                                            texto = texto.map(texto => texto);
                                            data.texto = texto
                                            createOne(data).then(async results => {
                                                try {
                                                    let findUid = await Uid.validUid(mailFilter.id);
                                                    if (findUid){
                                                        throw new Error('Este correo ya fue enviado'); 
                                                    }else{
                                                        Logguer.info('Enviando archivo via telegram')
                                                        await bot.telegram.sendDocument(USER,{source:results},{caption: mailFilter.subject})
                                                        if (!save){
                                                            let data = {};
                                                            data.uid = mailFilter.id;
                                                            data.send = true;
                                                            let saving = await Uid.registerUidSend(data);
                                                            if (!saving){
                                                                Logguer.error('No se guardo el registro del UID');
                                                                save = false;
                                                            }else{
                                                                Logguer.info('Se registro el uid como enviado, se envio como PDF');
                                                                save = true;
                                                            }
                                                        }else{
                                                            Logguer.debug("Se ha guardado el correo como enviado")
                                                        }
                                                    }
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
                                   imap.addFlags(mailFilter.id, ['\\Seen'], function(err) {
                                        if (err) {
                                            Logguer.error('Error al marcar el correo como leído:', err);
                                        } else {
                                            Logguer.info('Correo marcado como leído.');
                                        }
                                    });
                                }
                            }
                        });
                        mails[result].filter = true;
                    });
                });
            }
        });
    });
};





let attempts = 0;
const maxAttempts = 5; 
const baseDelay = 1000; 
const delayMultiplier = 2;


do{
    console.log('Intentando conectar al IMAP Server');
    imap.connect();
    imap.once('error', (error) =>{
        Logguer.error('Error al conectar:', error);
        connect = false;
    });
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    //connect = true
}while (!connect);



imap.on('error', (error) =>{
    Logguer.error('Error al conectar:', error);
});

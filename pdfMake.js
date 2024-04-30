import path from 'path';
import pdfMake from 'pdfmake' //build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import fs from 'fs';
let file_end;

pdfMake.vfs = pdfFonts.pdfMake.vfs;

let fonts = {
    Roboto: {
        normal: Buffer.from(
            pdfMake.vfs['Roboto-Regular.ttf'],
            "base64"
        ),
        bold: Buffer.from(
            pdfMake.vfs['Roboto-Medium.ttf'],
            'base64'
        ),
    },
};



async function createOne(data){
    let docDefinition;
    let rowData = data.texto;
    let bodyData = [];
    rowData.forEach((row,index) => {
        let borderColor = index % 2 === 0 ? '#FFFFFF' : '#DDDDDD'; // Color de borde alternado
        let backgroundColor = index % 2 === 0 ? '#F2F2F2' : null; // Color de fondo alternado
        bodyData.push([
            {
                text: row,
                border: [false, false, false, true], // Solo aplicar borde en la parte inferior
                fillColor: backgroundColor,
                //borderColor: borderColor,
                margin: [row.indexOf(row.trim()) * 5, 0, 0, 0], 
            },
        ]);
    });
    docDefinition = {
        footer: [
            {
                text: 'Desarrollado por: Cesar Avila, Power By: Nodejs',
                alignment: 'right',
                margin: [10,20],
                fontSize: 8,
            },
            
        ],
        //contenido
        content: [
            //encabezado
            {
                image: './img/Movilnet-logo_0.png',
                alignment: "center",
                width: 600,
                margin: [0,-40,0,10],

            },
            //titulo
            {
                text: "From: "+data.from,
                alignment: "center",
                bold: true,
                fontSize: 18,
                            
            },
            {
            columns:[  
                        { width: '*', text: '' }, 
                        {
                            width: 'auto',
                            layout: 'lightHorizontalLines',
                            table: {
                                    widths: ['*'],
                                    body: bodyData,
                                    fontSize: 14,    
                            }
                        },
                        { width: '*', text: '' },
                    ]      
                    
                
            }
        ],
        
    };

    return new Promise(async (resolve, reject) => {

        const printer = new pdfMake(fonts);
        let pdfDoc = printer.createPdfKitDocument(docDefinition);
        try {
        file_end = fs.createWriteStream("public/pdf/archivo.pdf");  
        pdfDoc.pipe(file_end);
        }catch(err){
            console.error(new Error('Ocurrio un error al crear el pdf: '+err));
            reject(false);
        }
        pdfDoc.end();
        file_end.on('finish', async () => {
            console.log('finish')
            resolve('public/pdf/archivo.pdf')
        })
    
        })


};

export default createOne;




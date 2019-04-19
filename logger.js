'use strict';

const fs = require ('fs');
const path = require ('path');
const moment = require ('moment');

const logDir = 'log';
if (!fs.existsSync (logDir)) {
    
    fs.mkdirSync (logDir);
};

module.exports = function (asset) {

    var winston = require ('winston'),
        format = winston.format,
        transports = winston.transports;

    winston.configure ({

        level: 'debug',

        format: format.combine(
            format.label({ label: asset }),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
        ),

        transports: [

            new transports.Console({

                level: 'debug',
                format: format.combine(
                    format.colorize(),
                    format.printf(
                        info =>
                            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
                    )
                )
            }),

            new transports.File({

                filename: path.join (logDir, 'mmbot-' + asset + '-' + moment().format('YYYY-MM-DD-hh:mm:ss').trim() + '.log'),
                datePattern: 'YYYY-MM-DD-HH:mm:ss',
                format: format.combine(
                    format.printf(
                        info =>
                            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
                    )
                )
            }),
        ],
    });

    return winston;
}


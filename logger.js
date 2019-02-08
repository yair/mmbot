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

                level: 'warn',
                format: format.combine(
                    format.colorize(),
                    format.printf(
                        info =>
                            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
                    )
                )
            }),

            new transports.File({

//                filename: path.join (logDir, 'mmbot-' + asset + '-' + (new Date()).toString() + '.log'),
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
/*        level:"debug",
        format: winston.format.combine (
                    winston.format.colorize (),
                    winston.format.simple ()
        ),
        transports: [
            new winston.transports.Console()
        ],*/
    });

    return winston;
}

/*
///


var logger = require ('winston');
var transports = logger.transports;
var format = logger.format;

const fs = require('fs');
const path = require('path');

const logDir = 'log';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const caller = 'mix';

logger.add (logger.transports.File, {

    level: 'debug',
    filename: path.join (logDir, 'mmbot-' + caller + '-%DATE%.log'),
    datePattern: 'YYYY-MM-DD-HH:mm:ss',
    format: format.combine(
        format.label({ label: path.basename(caller) }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
        ),
    )
});

logger.add (transports.Console, {
    level: 'warn',
    datePattern: 'YYYY-MM-DD-HH:mm:ss',
    format: format.combine(
        format.label({ label: path.basename(caller) }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.colorize(),
        format.printf(
            info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
        ),
    )
});

module.exports=logger;

//////
const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');


if (!fs.existsSync(logDir)) {

  fs.mkdirSync(logDir);
}

const logger = caller => {
  return createLogger({
    level: 'debug',
    format: format.combine(
      format.label({ label: path.basename(caller) }),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
    ),
    transports: [
      new transports.Console({
        level: 'warn',
        format: format.combine(
          format.colorize(),
          format.printf(
            info =>
              `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
          )
        )
      }),
      new transports.File({
//        filename,
        path.join (logDir, 'mmbot-' + caller + '-%DATE%.log'),
        datePattern: 'YYYY-MM-DD-HH:mm:ss',
        format: format.combine(
          format.printf(
            info =>
              `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
          )
        )
      })
    ]
  });
};

module.exports = logger;
*/

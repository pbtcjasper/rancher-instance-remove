const winston = require('winston')

const logger = getLogger()
logger.level = process.env.LOG_LEVEL || 'info'

function stringify (obj) {
  try {
    if (obj && obj.stack && typeof (obj.stack) === 'string') {
      obj.stack = obj.stack.replace(/(?:\r\n|\r|\n)/g, '  ')
    }
  } catch (err) {
    console.error('error parsing stack trace')
  }

  return JSON.stringify(obj)
}

function getLogger() {
  if (process.env.NODE_ENV === 'development') {
    return new (winston.Logger)({
      transports: [
        // colorize the output to the console
        new (winston.transports.Console)({
          colorize: true,
          label: 'jungo-api',
        })
      ]
    })
  } else {
    return new (winston.Logger)({
      transports: [
        // colorize the output to the console
        new (winston.transports.Console)({
          colorize: true,
          label: 'jungo-api',
          json: true,
          stringify: (obj) => stringify(obj)
        })
      ]
    })
  }
}

module.exports = logger

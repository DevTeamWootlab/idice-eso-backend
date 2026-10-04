import { WinstonModule, utilities } from "nest-winston";
import "winston-daily-rotate-file";
import { format, transports } from "winston";

const consoleTransport = new transports.Console({
  level: '',
  format: format.combine(
    format.cli(),
    format.splat(),
    format.timestamp(),
    format.printf((info) => {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    }),
    utilities.format.nestLike('MyApp', {
      colors: true,
      prettyPrint: true,
      processId: true,
    }),
  ),
});

const fileTransports = [
  new transports.DailyRotateFile({
    filename: `logs/%DATE%-error.log`,
    level: 'error',
    format: format.combine(format.timestamp(), format.json()),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: '7d',
  }),
  new transports.DailyRotateFile({
    filename: `logs/%DATE%-combined.log`,
    format: format.combine(format.timestamp(), format.json()),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: '7d',
  }),
];

const logger = WinstonModule.createLogger({
  transports:
    process.env.NODE_ENV === 'production'
      ? [consoleTransport]
      : [...fileTransports, consoleTransport],
});

export default logger;

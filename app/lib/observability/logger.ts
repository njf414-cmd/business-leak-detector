type LogLevel = "info" | "warn" | "error";

type LogData = Record<
  string,
  string | number | boolean | null | undefined
>;

function writeLog(
  level: LogLevel,
  event: string,
  data: LogData = {}
) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}

export const logger = {
  info(
    event: string,
    data?: LogData
  ) {
    writeLog("info", event, data);
  },

  warn(
    event: string,
    data?: LogData
  ) {
    writeLog("warn", event, data);
  },

  error(
    event: string,
    data?: LogData
  ) {
    writeLog("error", event, data);
  },
};

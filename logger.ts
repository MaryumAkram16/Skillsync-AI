const isProd = process.env.NODE_ENV === "production";

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (isProd) {
    const entry = { level, msg, time: new Date().toISOString(), ...meta };
    const line = JSON.stringify(entry);
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  } else {
    const tag = `[${level.toUpperCase()}]`;
    const suffix = meta ? " " + JSON.stringify(meta) : "";
    if (level === "error") console.error(tag, msg + suffix);
    else if (level === "warn") console.warn(tag, msg + suffix);
    else console.log(tag, msg + suffix);
  }
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};

import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import multer from "multer";
import ffmpegStatic from "ffmpeg-static";

const app = express();

const PORT = toPositiveInt(process.env.PORT, 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_FILE_MB = toPositiveInt(process.env.MAX_FILE_MB, 100);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const CORS_ORIGIN = buildCorsOrigin(process.env.CORS_ORIGIN);
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

const TEMP_ROOT = path.resolve(process.cwd(), "tmp");
const INCOMING_DIR = path.join(TEMP_ROOT, "incoming");
const WORK_DIR = path.join(TEMP_ROOT, "work");

const ALLOWED_INPUT_EXTENSIONS = new Set([".wav", ".mp3", ".ogg"]);
const ALLOWED_FORMATS = new Set(["brstm", "bcstm", "bfstm", "bwav", "bcwav", "bfwav"]);

const ENCODER_COMMANDS = {
  brstm: process.env.NINCONVERT_BRSTM_CMD || "",
  bcstm: process.env.NINCONVERT_BCSTM_CMD || "",
  bfstm: process.env.NINCONVERT_BFSTM_CMD || "",
  bwav: process.env.NINCONVERT_BWAV_CMD || "",
  bcwav: process.env.NINCONVERT_BCWAV_CMD || "",
  bfwav: process.env.NINCONVERT_BFWAV_CMD || ""
};

await fs.mkdir(INCOMING_DIR, { recursive: true });
await fs.mkdir(WORK_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, INCOMING_DIR),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: {
    fileSize: MAX_FILE_BYTES
  }
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ninconvert-backend",
    ffmpegPath: FFMPEG_PATH,
    maxFileMb: MAX_FILE_MB,
    formats: [...ALLOWED_FORMATS],
    encodersConfigured: Object.fromEntries(
      Object.entries(ENCODER_COMMANDS).map(([format, command]) => [format, Boolean(command)])
    )
  });
});

app.post("/convert", upload.single("audio"), async (req, res) => {
  const cleanupTargets = [];

  try {
    if (!req.file) {
      res.status(400).type("text/plain").send("Missing file field: audio");
      return;
    }

    const inputExt = path.extname(req.file.originalname || "").toLowerCase();
    if (!ALLOWED_INPUT_EXTENSIONS.has(inputExt)) {
      res.status(400).type("text/plain").send("Unsupported input file type. Allowed: .wav, .mp3, .ogg");
      return;
    }

    const targetFormat = String(req.body.format || "").trim().toLowerCase();
    if (!ALLOWED_FORMATS.has(targetFormat)) {
      res.status(400).type("text/plain").send("Unsupported output format");
      return;
    }

    const loopEnabled = String(req.body.loopEnabled || "0") === "1";
    const loopStart = parseNonNegativeInteger(req.body.loopStart, "loopStart");
    const loopEnd = parseNonNegativeInteger(req.body.loopEnd, "loopEnd");
    if (loopEnabled && loopEnd <= loopStart) {
      res.status(400).type("text/plain").send("Invalid loop range: loopEnd must be greater than loopStart");
      return;
    }

    const jobId = `${Date.now()}-${crypto.randomUUID()}`;
    const safeBaseName = sanitizeBaseName(req.file.originalname || "audio");

    const sourcePath = req.file.path;
    const normalizedWavPath = path.join(WORK_DIR, `${jobId}.normalized.wav`);
    cleanupTargets.push(sourcePath, normalizedWavPath);

    await normalizeToWav(sourcePath, normalizedWavPath);

    const encoderCommand = ENCODER_COMMANDS[targetFormat];
    let outputPath = path.join(WORK_DIR, `${jobId}.${targetFormat}`);
    let outputName = `${safeBaseName}.${targetFormat}`;
    let usedFallback = false;

    if (encoderCommand) {
      cleanupTargets.push(outputPath);
      await runTemplateCommand(encoderCommand, {
        input: normalizedWavPath,
        output: outputPath,
        format: targetFormat,
        loopEnabled: loopEnabled ? "1" : "0",
        loopStart: String(loopStart),
        loopEnd: String(loopEnd)
      });
      await ensureFileExists(outputPath, "Encoder command did not generate output file");
    } else {
      outputPath = path.join(WORK_DIR, `${jobId}.wav`);
      outputName = `${safeBaseName}.wav`;
      cleanupTargets.push(outputPath);
      usedFallback = true;
      await fs.copyFile(normalizedWavPath, outputPath);
    }

    const stat = await fs.stat(outputPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${outputName}"`);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("X-NinConvert-Requested-Format", targetFormat);

    if (usedFallback) {
      res.setHeader(
        "X-NinConvert-Notice",
        `No encoder configured for ${targetFormat}. Returned normalized WAV fallback.`
      );
    }

    const stream = createReadStream(outputPath);
    stream.on("error", async () => {
      await cleanupFiles(cleanupTargets);
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("Failed to read output file");
      }
    });
    res.on("finish", async () => {
      await cleanupFiles(cleanupTargets);
    });
    stream.pipe(res);
  } catch (error) {
    await cleanupFiles(cleanupTargets);
    const message = normalizeErrorMessage(error);
    res.status(500).type("text/plain").send(message);
  }
});

app.use((error, _req, res, _next) => {
  const message = normalizeErrorMessage(error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    res.status(413).type("text/plain").send(`File too large. Max size is ${MAX_FILE_MB} MB.`);
    return;
  }
  res.status(500).type("text/plain").send(message);
});

app.listen(PORT, HOST, () => {
  console.log(`[ninconvert-backend] Listening on http://${HOST}:${PORT}`);
  console.log(`[ninconvert-backend] Health endpoint: http://${HOST}:${PORT}/health`);
});

function buildCorsOrigin(value) {
  if (!value) {
    return true;
  }
  const items = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return items.length > 0 ? items : true;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInteger(value, fieldName) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
}

function sanitizeBaseName(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "") || "audio";
  const normalized = withoutExt
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "audio";
}

function normalizeErrorMessage(error) {
  const fallback = "Conversion failed";
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function normalizeToWav(inputPath, outputPath) {
  await runProcess(FFMPEG_PATH, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
}

async function runTemplateCommand(template, values) {
  const rendered = template.replace(/\{(input|output|format|loopEnabled|loopStart|loopEnd)\}/g, (_match, key) => {
    const raw = values[key];
    if (key === "input" || key === "output") {
      return shellQuote(raw);
    }
    return String(raw);
  });

  await runProcess(rendered, [], { shell: true });
}

function shellQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

async function runProcess(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const processRef = spawn(command, args, {
      shell: Boolean(options.shell),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";

    processRef.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    processRef.on("error", (error) => {
      reject(error);
    });

    processRef.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const base = options.shell
        ? `Command failed: ${command}`
        : `Command failed: ${command} ${args.join(" ")}`;
      const details = stderr.trim();
      reject(new Error(details ? `${base}\n${details}` : base));
    });
  });
}

async function ensureFileExists(filePath, errorMessage) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(errorMessage);
  }
}

async function cleanupFiles(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  await Promise.all(
    unique.map(async (filePath) => {
      try {
        await fs.rm(filePath, { force: true });
      } catch {
        // Best effort cleanup.
      }
    })
  );
}

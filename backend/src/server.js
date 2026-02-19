import "dotenv/config";
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
      res.status(400).type("text/plain").send(
        "Unsupported input file type. Allowed: .wav, .mp3, .ogg"
      );
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

    await normalizeInputToWav(sourcePath, normalizedWavPath);
    if (loopEnabled) {
      await applyLoopMetadataToWav(normalizedWavPath, loopStart, loopEnd);
    }

    const encoderCommand = ENCODER_COMMANDS[targetFormat];
    if (!encoderCommand) {
      res.status(501).type("text/plain").send(
        [
          `No Nintendo encoder configured for format: ${targetFormat}.`,
          "Configure NINCONVERT_<FORMAT>_CMD in backend/.env (or environment).",
          "Example placeholder command: NINCONVERT_BRSTM_CMD=\"<your-tool> {input} {output}\""
        ].join("\n")
      );
      return;
    }

    const outputPath = path.join(WORK_DIR, `${jobId}.${targetFormat}`);
    const outputName = `${safeBaseName}.${targetFormat}`;
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

    const stat = await fs.stat(outputPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${outputName}"`);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("X-NinConvert-Requested-Format", targetFormat);

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

async function normalizeInputToWav(inputPath, outputPath) {
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

async function applyLoopMetadataToWav(wavPath, loopStart, loopEnd) {
  const buffer = await fs.readFile(wavPath);
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Invalid WAV file (RIFF/WAVE header missing)");
  }

  const chunks = [];
  let offset = 12;
  let sampleRate = 0;
  let blockAlign = 0;
  let totalSamples = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;
    const nextOffset = chunkDataEnd + (chunkSize % 2);

    if (chunkDataEnd > buffer.length || nextOffset > buffer.length) {
      throw new Error("Invalid WAV file (corrupted chunk layout)");
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16) {
        throw new Error("Invalid WAV file (fmt chunk too small)");
      }
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      blockAlign = buffer.readUInt16LE(chunkDataStart + 12);
    }

    if (chunkId === "data") {
      totalSamples = blockAlign > 0
        ? Math.floor(chunkSize / blockAlign)
        : 0;
    }

    chunks.push({
      id: chunkId,
      start: offset,
      end: nextOffset
    });
    offset = nextOffset;
  }

  if (!sampleRate || !blockAlign || totalSamples <= 0) {
    throw new Error("Invalid WAV file (missing fmt/data info)");
  }

  const maxSample = Math.max(0, totalSamples - 1);
  const loopStartSafe = Math.max(0, Math.min(maxSample, Math.floor(loopStart)));
  const loopEndSafe = Math.max(0, Math.min(maxSample, Math.floor(loopEnd)));

  if (loopEndSafe <= loopStartSafe) {
    throw new Error(`Invalid loop range for WAV metadata: ${loopStartSafe} -> ${loopEndSafe}`);
  }

  const smplChunk = buildSmplChunk(sampleRate, loopStartSafe, loopEndSafe);
  const rebuiltParts = [buffer.slice(0, 12)];

  for (const chunk of chunks) {
    if (chunk.id === "smpl") {
      continue;
    }
    rebuiltParts.push(buffer.slice(chunk.start, chunk.end));
  }

  rebuiltParts.push(smplChunk);

  const rebuilt = Buffer.concat(rebuiltParts);
  rebuilt.writeUInt32LE(rebuilt.length - 8, 4);
  await fs.writeFile(wavPath, rebuilt);
}

function buildSmplChunk(sampleRate, loopStart, loopEnd) {
  const loopsCount = 1;
  const smplPayloadSize = 36 + loopsCount * 24;
  const totalSize = 8 + smplPayloadSize;
  const chunk = Buffer.alloc(totalSize);

  chunk.write("smpl", 0, 4, "ascii");
  chunk.writeUInt32LE(smplPayloadSize, 4);

  let offset = 8;
  chunk.writeUInt32LE(0, offset); offset += 4; // manufacturer
  chunk.writeUInt32LE(0, offset); offset += 4; // product
  chunk.writeUInt32LE(Math.max(1, Math.round(1_000_000_000 / sampleRate)), offset); offset += 4; // samplePeriod
  chunk.writeUInt32LE(60, offset); offset += 4; // midiUnityNote
  chunk.writeUInt32LE(0, offset); offset += 4; // midiPitchFraction
  chunk.writeUInt32LE(0, offset); offset += 4; // smpteFormat
  chunk.writeUInt32LE(0, offset); offset += 4; // smpteOffset
  chunk.writeUInt32LE(loopsCount, offset); offset += 4; // numSampleLoops
  chunk.writeUInt32LE(0, offset); offset += 4; // samplerData

  chunk.writeUInt32LE(0, offset); offset += 4; // cuePointId
  chunk.writeUInt32LE(0, offset); offset += 4; // type (forward)
  chunk.writeUInt32LE(loopStart, offset); offset += 4; // start
  chunk.writeUInt32LE(loopEnd, offset); offset += 4; // end (inclusive)
  chunk.writeUInt32LE(0, offset); offset += 4; // fraction
  chunk.writeUInt32LE(0, offset); // playCount (0 = infinite)

  return chunk;
}

async function runTemplateCommand(template, values) {
  const loopEnabled = String(values.loopEnabled) === "1";
  const loopStart = Math.max(0, Number.parseInt(String(values.loopStart ?? "0"), 10) || 0);
  const loopEnd = Math.max(loopStart + 1, Number.parseInt(String(values.loopEnd ?? "0"), 10) || (loopStart + 1));

  const derivedValues = {
    ...values,
    loopVgaudioArgs: loopEnabled ? `-l ${loopStart}-${loopEnd}` : "--no-loop",
    loopNintendoWaveArgs: loopEnabled ? `--loopStart ${loopStart} --loopEnd ${loopEnd}` : ""
  };

  const rendered = template.replace(/\{(input|output|format|loopEnabled|loopStart|loopEnd|loopVgaudioArgs|loopNintendoWaveArgs)\}/g, (_match, key) => {
    const raw = derivedValues[key];
    if (key === "loopVgaudioArgs" || key === "loopNintendoWaveArgs") {
      return String(raw || "");
    }
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

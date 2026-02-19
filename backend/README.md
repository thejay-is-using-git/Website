# NinConvert Backend

Backend API for `src/ninconvert/index.html`.

## Features

- `GET /health`: backend health check.
- `POST /convert`: upload + convert endpoint (multipart/form-data).
- Input support: `.mp3`, `.wav`, `.ogg`.
- Loop fields accepted and validated (`loopEnabled`, `loopStart`, `loopEnd`).
- Nintendo output generation is done only by configured encoder commands (`NINCONVERT_<FORMAT>_CMD`).
- If no encoder command is configured for requested output format, API returns `501` (no fake WAV fallback).

## Setup

```bash
cd backend
npm install
npm run dev
```

Default API URL: `http://localhost:8787`

Health URL: `http://localhost:8787/health`

## Connect to frontend

In NinConvert page, set:

- `API endpoint` -> `http://localhost:8787`

Then click `Convert`.

## Environment variables

Copy `.env.example` and set variables if needed:

- `PORT`, `HOST`, `MAX_FILE_MB`
- `FFMPEG_PATH` (optional custom ffmpeg path, used for `.wav/.mp3/.ogg` inputs)
- `CORS_ORIGIN` (optional)
- `NINCONVERT_<FORMAT>_CMD` for real encoders:
  - `NINCONVERT_BRSTM_CMD`
  - `NINCONVERT_BCSTM_CMD`
  - `NINCONVERT_BFSTM_CMD`
  - `NINCONVERT_BWAV_CMD`
  - `NINCONVERT_BCWAV_CMD`
  - `NINCONVERT_BFWAV_CMD`

Template placeholders for command values:

- `{input}` normalized WAV input path
- `{output}` output path to generate
- `{format}` requested format
- `{loopEnabled}` `0|1`
- `{loopStart}` samples
- `{loopEnd}` samples

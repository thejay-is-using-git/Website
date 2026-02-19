# NinConvert API Contract

`POST /convert`

Request:

- Content-Type: `multipart/form-data`
- Fields:
  - `audio`: file (`.wav`, `.mp3`, `.ogg`)
  - `format`: `brstm|bcstm|bfstm|bwav|bcwav|bfwav`
  - `loopEnabled`: `0|1`
  - `loopStart`: integer (samples)
  - `loopEnd`: integer (samples)

Response (success):

- Status `200`
- Body: converted binary file
- Headers:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="<name>.<ext>"`

Response (error):

- Status `4xx|5xx`
- Body: plain text error message

Notes:

- Nintendo output formats require backend encoder commands (`NINCONVERT_<FORMAT>_CMD`).
- If encoder command is not configured for requested format, API returns `501`.

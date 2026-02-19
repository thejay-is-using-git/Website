# CTRL_J Website

Some Website with multiple resources and tools inside.
Ce projet est actuellement en phase de construction.

## Structure

- `website/`: code du site
- `website/src/`: pages HTML source (`index`, `resources`, `credit`, `ninconvert`)
- `website/public/`: assets statiques (`assets/...`)
- `website/dist/`: build de production (genere)
- `nodejs/`: environnement local Node/Vite (local uniquement, ignore pour GitHub)
- `backend/`: API locale NinConvert (`/health`, `/convert`)

## License

- Frontend website: `MIT` (see `website/licenses/LICENSE`)
- Planned backend/API for NinConvert: `GPL-3.0` (see `website/licenses/BACKEND_LICENSE.md`)
- Third-party dependencies and notices: `website/licenses/THIRD_PARTY_NOTICES.md`

## Dev

- Lancer en local depuis la racine: `start-local.bat`
- Debug (fenetre ouverte): `start-local-debug.bat`
- Lancer backend NinConvert: `start-ninconvert-backend.bat`
- Important: ne pas ouvrir `website/src/*.html` en `file://`.

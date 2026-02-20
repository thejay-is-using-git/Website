# CTRL_J Website

Some Website with multiple resources and tools inside.
Ce projet est actuellement en phase de construction.

## Structure

- `src/`: pages HTML source (`index`, `resources`, `credit`, `ninconvert`, `placeholder`)
- `public/`: assets statiques (`assets/...`)
- `.github/workflows/deploy-pages.yml`: deploiement GitHub Pages automatique via Actions

## License

- Frontend website: `MIT` (see `LICENSE`)
- Third-party dependencies and notices: `THIRD_PARTY_NOTICES.md`

## Dev

- Lancer en local depuis la racine: `start-local.bat`
- Debug (fenetre ouverte): `start-local-debug.bat`
- Important: ne pas ouvrir `src/*.html` en `file://`.

## GitHub Pages

- Le deploy se fait par GitHub Actions (workflow `Deploy Website`).
- Source unique: `src` + `public`.
- Pour activer: dans GitHub > Settings > Pages > Build and deployment > Source = `GitHub Actions`.

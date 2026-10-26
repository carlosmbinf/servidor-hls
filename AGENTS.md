# Codex: servidor HLS

Lee `../AGENTS.md`, `../.github/copilot-instructions.md` y `../.github/instructions/hls.instructions.md` antes de modificar este servicio. Para decisiones de contratos, lee también `../.github/memory/architecture.md` y `../.github/memory/decisions.md`; para cursos, `../.github/memory/courses.md`.

Antes de cambiar rutas o payloads, sigue el contrato hasta Meteor y ambos reproductores. Conserva `prepare`, `status`, `cancel`, playlists y segmentos; valida inputs antes de acceder al filesystem o FFmpeg. No conectes el servicio directamente a Mongo ni expongas información operativa sensible.

Usa `npm run check` después de cambios JavaScript y añade pruebas enfocadas cuando el cambio altere rutas o streaming. No ejecutes despliegues ni operaciones contra datos reales sin autorización explícita.

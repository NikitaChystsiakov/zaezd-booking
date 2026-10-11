import path from 'node:path'

// Загруженные фото лежат вне public: Next в продакшене не отдаёт файлы, добавленные в public после сборки.
// Отдаёт их маршрут /media/[...path].
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads'))

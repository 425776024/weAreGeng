import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '../..')

export const DATA_DIR = join(ROOT, 'data')
export const META_DIR = join(DATA_DIR, 'meta')
export const EXPERTS_DIR = join(DATA_DIR, 'experts')
export const EXPERTS_BY_HONOR_DIR = join(EXPERTS_DIR, 'by-honor')
export const EXPERTS_BY_ORG_DIR = join(EXPERTS_DIR, 'by-org')
export const CRAWL_DIR = join(DATA_DIR, 'crawl')

export const PATHS = {
  universities: join(META_DIR, 'universities.json'),
  fields: join(META_DIR, 'fields.json'),
  journals: join(META_DIR, 'journals.json'),
  manifest: join(CRAWL_DIR, 'manifest.json'),
  discoveredUniversityPages: join(CRAWL_DIR, 'discovered-university-pages.json'),
  universityTalents: join(CRAWL_DIR, 'university-talents.json'),
  orgIndex: join(EXPERTS_BY_ORG_DIR, '_index.json'),
}

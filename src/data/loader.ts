import universities from '../../data/meta/universities.json'
import fields from '../../data/meta/fields.json'
import journals from '../../data/meta/journals.json'
import type { Expert, ExpertOrgGroup, Field, Journal, University } from '../api/client'

const UNKNOWN_ORG = '未知'

const honorModules = import.meta.glob('../../data/experts/by-honor/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Expert | Expert[]>

const orgModules = import.meta.glob('../../data/experts/by-org/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ExpertOrgGroup | { orgs?: unknown[] }>

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .slice(0, 80) || 'unknown'
}

function normalizeOrgName(university?: string): string {
  const raw = university?.trim()
  if (!raw || raw === '未标注单位') return UNKNOWN_ORG
  return raw
}

function matchUniversityId(orgName: string, uniList: University[]): string | undefined {
  if (!orgName || orgName === UNKNOWN_ORG) return undefined
  for (const u of uniList) {
    if (orgName === u.name) return u.id
    if (orgName.includes(u.name) || u.name.includes(orgName)) return u.id
    if (orgName.includes(u.shortName)) return u.id
  }
  return undefined
}

function matchExpertToUniversity(expert: Expert, uni: University): boolean {
  const org = expert.university?.trim()
  if (!org) return false
  if (org === uni.name) return true
  if (org.includes(uni.name) || uni.name.includes(org)) return true
  if (org.includes(uni.shortName)) return true
  return false
}

function parseHonorExperts(): Expert[] {
  const experts: Expert[] = []
  for (const [path, mod] of Object.entries(honorModules)) {
    if (path.includes('/by-org/') || path.endsWith('/_index.json')) continue
    const list = Array.isArray(mod) ? mod : [mod]
    for (const raw of list) {
      if (!raw?.name) continue
      experts.push({ ...raw, id: raw.id || raw.name })
    }
  }
  return experts
}

function parseOrgGroups(uniList: University[]): ExpertOrgGroup[] {
  const groups: ExpertOrgGroup[] = []
  for (const [path, mod] of Object.entries(orgModules)) {
    if (path.endsWith('/_index.json')) continue
    const group = mod as ExpertOrgGroup
    if (!group?.name || !Array.isArray(group.experts)) continue
    groups.push({
      ...group,
      id: group.id === '未标注单位' ? slugify(UNKNOWN_ORG) : group.id || slugify(group.name),
      name: group.name === '未标注单位' ? UNKNOWN_ORG : group.name,
      universityId: group.universityId || matchUniversityId(group.name === '未标注单位' ? UNKNOWN_ORG : group.name, uniList),
      experts: group.experts.map((e) => ({ ...e, id: e.id || e.name })),
      count: group.experts.length,
    })
  }
  return groups
}

function groupExpertsByOrg(experts: Expert[], uniList: University[]): ExpertOrgGroup[] {
  const map = new Map<string, ExpertOrgGroup>()

  for (const expert of experts) {
    const name = normalizeOrgName(expert.university)
    const id = slugify(name)
    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        universityId: matchUniversityId(name, uniList),
        experts: [],
        count: 0,
      })
    }
    map.get(id)!.experts.push(expert)
  }

  for (const group of map.values()) {
    group.experts.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    group.count = group.experts.length
  }

  return sortOrgGroups([...map.values()], uniList)
}

function sortOrgGroups(groups: ExpertOrgGroup[], uniList: University[]): ExpertOrgGroup[] {
  const rankById = new Map(uniList.map((u) => [u.id, u.rank]))
  return groups.sort((a, b) => {
    const rankA = a.universityId ? rankById.get(a.universityId) ?? 9999 : 9999
    const rankB = b.universityId ? rankById.get(b.universityId) ?? 9999 : 9999
    if (rankA !== rankB) return rankA - rankB
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

let expertsCache: Expert[] | null = null
let orgGroupsCache: ExpertOrgGroup[] | null = null

export function getUniversities(): University[] {
  return universities
}

export function getExperts(): Expert[] {
  if (!expertsCache) {
    const fromHonor = parseHonorExperts()
    const orgGroups = parseOrgGroups(universities)
    if (orgGroups.length) {
      const seen = new Set<string>()
      expertsCache = []
      for (const group of orgGroups) {
        for (const expert of group.experts) {
          if (seen.has(expert.id)) continue
          seen.add(expert.id)
          expertsCache.push(expert)
        }
      }
      expertsCache.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } else {
      expertsCache = fromHonor.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }
  }
  return expertsCache
}

export function getExpertOrgGroups(): ExpertOrgGroup[] {
  if (!orgGroupsCache) {
    const orgGroups = parseOrgGroups(universities)
    orgGroupsCache = orgGroups.length
      ? sortOrgGroups(orgGroups, universities)
      : groupExpertsByOrg(getExperts(), universities)
  }
  return orgGroupsCache
}

export function getExpertsForUniversity(universityId: string): Expert[] {
  const uni = universities.find((u) => u.id === universityId)
  if (!uni) return []
  const groups = getExpertOrgGroups()
  const matchedGroups = groups.filter(
    (g) => g.universityId === universityId || g.name === uni.name
  )
  if (matchedGroups.length) {
    return matchedGroups.flatMap((g) => g.experts)
  }
  return getExperts().filter((e) => matchExpertToUniversity(e, uni))
}

export function getFields(): Field[] {
  return fields
}

export function getJournals(): Journal[] {
  return journals as Journal[]
}

export function getDefaults() {
  const currentYear = new Date().getFullYear()
  return {
    yearFrom: currentYear - 10,
    yearTo: currentYear,
    defaultLimit: 30,
  }
}

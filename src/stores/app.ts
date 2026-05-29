import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Paper, SearchFilters, AnalysisResult, University, Field, Journal, Expert, ExpertOrgGroup } from '../api/client'
import { api } from '../api/client'

export const useAppStore = defineStore('app', () => {
  const universities = ref<University[]>([])
  const experts = ref<Expert[]>([])
  const expertOrgGroups = ref<ExpertOrgGroup[]>([])
  const fields = ref<Field[]>([])
  const journals = ref<Journal[]>([])
  const papers = ref<Paper[]>([])
  const selectedPaperIds = ref<Set<string>>(new Set())
  const analyses = ref<AnalysisResult[]>([])
  const loading = ref(false)
  const error = ref('')
  const discovered = ref<{ names: string[]; universities: string[]; fields: string[] }>({
    names: [],
    universities: [],
    fields: [],
  })

  const filters = ref<SearchFilters>({
    query: '',
    universityId: '',
    fieldId: '',
    journalId: '',
    author: '',
    yearFrom: new Date().getFullYear() - 10,
    yearTo: new Date().getFullYear(),
  })

  function getUniversity(id: string) {
    return universities.value.find((u) => u.id === id)
  }

  function enterUniversity(id: string) {
    filters.value = {
      query: '',
      universityId: id,
      fieldId: '',
      journalId: '',
      author: '',
      yearFrom: filters.value.yearFrom,
      yearTo: filters.value.yearTo,
    }
    papers.value = []
    selectedPaperIds.value = new Set()
    discovered.value = { names: [], universities: [], fields: [] }
  }

  async function loadMeta() {
    const [u, e, g, f, j, d] = await Promise.all([
      api.getUniversities(),
      api.getExperts(),
      api.getExpertOrgGroups(),
      api.getFields(),
      api.getJournals(),
      api.getDefaults(),
    ])
    universities.value = u
    experts.value = e
    expertOrgGroups.value = g
    fields.value = f
    journals.value = j
    filters.value.yearFrom = d.yearFrom
    filters.value.yearTo = d.yearTo
  }

  async function loadExpertsForUniversity(universityId: string) {
    return api.getExpertsForUniversity(universityId)
  }

  async function search() {
    loading.value = true
    error.value = ''
    try {
      const res = await api.search({
        query: filters.value.query || undefined,
        universityId: filters.value.universityId || undefined,
        fieldId: filters.value.fieldId || undefined,
        journalId: filters.value.journalId || undefined,
        author: filters.value.author || undefined,
        yearFrom: filters.value.yearFrom,
        yearTo: filters.value.yearTo,
        dedupeByAuthor: true,
        enableWebSearch: true,
      })
      papers.value = res.papers
      discovered.value = res.discovered
      selectedPaperIds.value = new Set()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function togglePaper(id: string) {
    const s = new Set(selectedPaperIds.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    selectedPaperIds.value = s
  }

  function selectAll() {
    selectedPaperIds.value = new Set(papers.value.map((p) => p.id))
  }

  function clearSelection() {
    selectedPaperIds.value = new Set()
  }

  function getSelectedPapers(): Paper[] {
    return papers.value.filter((p) => selectedPaperIds.value.has(p.id))
  }

  async function analyzePapers(paperList: Paper[]) {
    loading.value = true
    error.value = ''
    try {
      const res = await api.analyzeBatch(paperList)
      analyses.value = res.results
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return {
    universities,
    experts,
    expertOrgGroups,
    fields,
    journals,
    papers,
    selectedPaperIds,
    analyses,
    loading,
    error,
    discovered,
    filters,
    loadMeta,
    loadExpertsForUniversity,
    getUniversity,
    enterUniversity,
    search,
    togglePaper,
    selectAll,
    clearSelection,
    getSelectedPapers,
    analyzePapers,
  }
})

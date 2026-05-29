import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type Paper } from '../api/client'

export interface BookmarkItem {
  id: string
  paper: Paper
  paperId?: string
  note?: string
  createdAt: string
}

export const useBookmarksStore = defineStore('bookmarks', () => {
  const items = ref<BookmarkItem[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      items.value = await api.listBookmarks()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function add(paper: Paper, note?: string) {
    await api.saveBookmark(paper, note)
    await load()
  }

  async function remove(id: string) {
    await api.deleteBookmark(id)
    items.value = items.value.filter((b) => b.id !== id)
  }

  function isBookmarked(paperId: string) {
    return items.value.some((b) => b.paper.id === paperId || b.paperId === paperId)
  }

  return { items, loading, error, load, add, remove, isBookmarked }
})

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarksStore } from '../stores/bookmarks'

const bookmarks = useBookmarksStore()
const router = useRouter()

onMounted(() => {
  bookmarks.load()
})

function analyze(paperId: string) {
  router.push({ name: 'analyze', query: { ids: paperId } })
}
</script>

<template>
  <div class="bookmarks-page">
    <header class="page-head">
      <h1>收藏</h1>
      <p class="subtitle">已收藏的论文，可快速跳转分析</p>
    </header>

    <div v-if="bookmarks.loading" class="loading">加载中…</div>
    <div v-else-if="bookmarks.error" class="error card">{{ bookmarks.error }}</div>
    <div v-else-if="!bookmarks.items.length" class="empty card">暂无收藏，在搜索结果页点击「收藏」添加</div>

    <div v-else class="list">
      <article v-for="item in bookmarks.items" :key="item.id" class="card bookmark">
        <div class="bookmark-main">
          <h3>{{ item.paper.title }}</h3>
          <div class="meta">
            <span>{{ item.paper.primaryAuthor }}</span>
            <span>· {{ item.paper.year }}</span>
            <span v-if="item.paper.journal">· {{ item.paper.journal }}</span>
          </div>
          <p v-if="item.note" class="note">{{ item.note }}</p>
          <span class="time">{{ item.createdAt?.slice(0, 16) }}</span>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" @click="analyze(item.paper.id)">分析</button>
          <button type="button" class="btn btn-secondary" @click="bookmarks.remove(item.id)">删除</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.bookmarks-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 0 48px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin: 4px 0 0;
}
.loading, .empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}
.bookmark {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.bookmark-main {
  flex: 1;
  min-width: 0;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
}
.meta {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text);
}
.time {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
</style>

<script setup lang="ts">
import type { Paper } from '../api/client'

defineProps<{
  papers: Paper[]
  selectedIds: Set<string>
  loading?: boolean
}>()

const emit = defineEmits<{ toggle: [id: string]; analyze: [id: string]; bookmark: [id: string] }>()
</script>

<template>
  <div v-if="loading" class="loading">正在检索公开论文数据库...</div>
  <div v-else-if="!papers.length" class="empty card">
    暂无结果，请调整筛选条件后重新搜索
  </div>
  <div v-else class="list">
    <article v-for="p in papers" :key="p.id" class="paper card">
      <div class="paper-top">
        <input
          type="checkbox"
          :checked="selectedIds.has(p.id)"
          @change="emit('toggle', p.id)"
        />
        <div class="paper-main">
          <h3>{{ p.title }}</h3>
          <div class="meta">
            <span>{{ p.primaryAuthor }}</span>
            <span v-if="p.authors.length > 1">等 {{ p.authors.length }} 人</span>
            <span>·</span>
            <span>{{ p.year }}</span>
            <span v-if="p.journal">· {{ p.journal }}</span>
            <span v-if="p.citations">· 引用 {{ p.citations }}</span>
          </div>
          <p class="abstract">{{ p.abstract.slice(0, 280) }}{{ p.abstract.length > 280 ? '...' : '' }}</p>
          <div class="tags">
            <span class="source-tag">{{ p.source }}</span>
            <a v-if="p.url" :href="p.url" target="_blank" rel="noopener" @click.stop>原文链接</a>
            <a v-if="p.pdfUrl" :href="p.pdfUrl" target="_blank" rel="noopener" @click.stop>PDF</a>
          </div>
        </div>
        <div class="paper-actions">
          <button class="btn btn-secondary analyze-btn" @click="emit('bookmark', p.id)">收藏</button>
          <button class="btn btn-secondary analyze-btn" @click="emit('analyze', p.id)">分析</button>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.loading, .empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.paper-top {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.paper-top input[type='checkbox'] {
  margin-top: 6px;
  width: 16px;
  height: 16px;
  accent-color: var(--text);
}
.paper-main {
  flex: 1;
  min-width: 0;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  line-height: 1.4;
}
.meta {
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.abstract {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.tags {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
}
.source-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-muted);
}
.analyze-btn {
  flex-shrink: 0;
}
.paper-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
</style>

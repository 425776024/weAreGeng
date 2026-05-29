<script setup lang="ts">
import { useAppStore } from '../stores/app'

const store = useAppStore()
const emit = defineEmits<{ search: [] }>()
</script>

<template>
  <div class="filter-panel card">
    <div class="grid-2">
      <div class="form-group">
        <label>关键词搜索</label>
        <input v-model="store.filters.query" placeholder="论文主题、关键词..." @keyup.enter="emit('search')" />
      </div>
      <div class="form-group">
        <label>作者姓名</label>
        <input v-model="store.filters.author" placeholder="按作者搜索..." />
      </div>
      <div class="form-group">
        <label>专业领域</label>
        <select v-model="store.filters.fieldId">
          <option value="">全部领域</option>
          <option v-for="f in store.fields" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>期刊</label>
        <select v-model="store.filters.journalId">
          <option value="">全部期刊</option>
          <option v-for="j in store.journals" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>起始年份</label>
        <input v-model.number="store.filters.yearFrom" type="number" :min="1990" :max="2030" />
      </div>
      <div class="form-group">
        <label>结束年份</label>
        <input v-model.number="store.filters.yearTo" type="number" :min="1990" :max="2030" />
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" :disabled="store.loading" @click="emit('search')">
        {{ store.loading ? '搜索中...' : '搜索论文' }}
      </button>
      <span class="hint">默认检索最近 10 年 · 人名自动去重</span>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  margin-bottom: 24px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}
.hint {
  font-size: 13px;
  color: var(--text-muted);
}
</style>

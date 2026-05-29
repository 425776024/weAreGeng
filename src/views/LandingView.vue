<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function startHunt() {
  router.push({ name: 'schools' })
}
</script>

<template>
  <div class="landing">
    <section class="hero">
      <p class="tagline">我们都是耿同学</p>
      <h1 class="slogan">要打就打大牛</h1>
      <p class="role">专家</p>
      <p class="desc">中国 Top 100 高校论文检索 · 公开数据库多源搜索 · AI 学术打假分析</p>
      <button class="btn btn-primary start-btn" @click="startHunt">开始打大牛</button>
    </section>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 32px 0;
}
.hero {
  text-align: center;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}
.tagline {
  font-size: 13px;
  color: var(--text-muted);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 24px;
}
.slogan {
  font-size: clamp(36px, 6vw, 52px);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 16px;
  color: var(--text);
  letter-spacing: -0.04em;
}
.role {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 32px;
  letter-spacing: 0.3em;
}
.desc {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.75;
  margin-bottom: 40px;
}
.start-btn {
  font-size: 15px;
  padding: 14px 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent);
}
.start-btn:hover {
  background: transparent;
  color: var(--accent);
}
</style>

import { useState } from 'react'
import type { CrawlContent, VideoAnalysis } from '../../types/electron'

function formatNumber(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function generateCSV(videos: CrawlContent[]) {
  const header = '标题,作者,播放量,点赞数,评论数,分享数,分类,发布时间'
  const rows = videos.map(v =>
    `"${(v.title || '').replace(/"/g, '""')}","${v.authorName || ''}",${v.playCount},${v.likeCount},${v.commentCount},${v.shareCount},"${v.category || '未分类'}","${v.createdAt || ''}"`
  )
  return [header, ...rows].join('\n')
}

function generateMarkdown(videos: CrawlContent[], overview?: VideoAnalysis['overview'], analysis?: VideoAnalysis) {
  let md = `# 数据导出\n\n`
  if (overview) {
    md += `## 概览\n`
    md += `- 视频总数：${overview.totalVideos}\n`
    md += `- 总播放量：${formatNumber(overview.totalPlay)}\n`
    md += `- 总点赞数：${formatNumber(overview.totalLike)}\n\n`
  }
  md += `## 视频列表\n\n`
  md += `| # | 标题 | 播放 | 点赞 | 评论 | 分类 |\n`
  md += `|---|------|------|------|------|------|\n`
  videos.forEach((v, i) => {
    md += `| ${i + 1} | ${v.title || '-'} | ${formatNumber(v.playCount)} | ${formatNumber(v.likeCount)} | ${v.commentCount} | ${v.category || '未分类'} |\n`
  })
  if (analysis?.suggestions) {
    md += `\n## AI 建议\n\n`
    analysis.suggestions.forEach(s => { md += `- ${s}\n` })
  }
  return md
}

function generateTXT(videos: CrawlContent[], overview?: VideoAnalysis['overview']) {
  let txt = `数据导出\n${'='.repeat(40)}\n\n`
  if (overview) {
    txt += `概览：\n`
    txt += `  视频总数：${overview.totalVideos}\n`
    txt += `  总播放量：${formatNumber(overview.totalPlay)}\n`
    txt += `  总点赞数：${formatNumber(overview.totalLike)}\n\n`
  }
  txt += `视频列表：\n`
  videos.forEach((v, i) => {
    txt += `  ${i + 1}. ${v.title || '-'} | 播放:${v.playCount} | 点赞:${v.likeCount}\n`
  })
  return txt
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['﻿' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  videos: CrawlContent[]
  overview?: VideoAnalysis['overview']
  analysis?: VideoAnalysis
  sourceName?: string
}

export default function ExportMenu({ videos, overview, analysis, sourceName }: Props) {
  const [open, setOpen] = useState(false)
  const prefix = sourceName || 'data'
  const ts = Date.now()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface text-xs rounded-lg hover:bg-surface-high transition-colors flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[14px]">download</span>
        导出
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px] z-50">
            <button onClick={() => { downloadFile(generateCSV(videos), `${prefix}_${ts}.csv`, 'text/csv;charset=utf-8'); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">table_chart</span>
              导出为 CSV
            </button>
            <button onClick={() => { downloadFile(generateMarkdown(videos, overview, analysis), `${prefix}_${ts}.md`, 'text/markdown;charset=utf-8'); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">description</span>
              导出为 Markdown
            </button>
            <button onClick={() => { downloadFile(generateTXT(videos, overview), `${prefix}_${ts}.txt`, 'text/plain;charset=utf-8'); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">text_snippet</span>
              导出为 TXT
            </button>
          </div>
        </>
      )}
    </div>
  )
}

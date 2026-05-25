function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function getChartTheme() {
  const ink = getCSSVar('--ink') || '#26251e'
  const body = getCSSVar('--body') || '#5a5852'
  const muted = getCSSVar('--muted') || '#807d72'
  const hairline = getCSSVar('--hairline') || '#e6e5e0'
  const surface = getCSSVar('--surface') || '#ffffff'
  const primary = getCSSVar('--primary') || '#f54e00'

  return {
    backgroundColor: 'transparent',
    textStyle: { color: body },
    title: { textStyle: { color: ink } },
    legend: { textStyle: { color: body } },
    xAxis: {
      axisLine: { lineStyle: { color: hairline } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: hairline } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: hairline } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: hairline } },
    },
    tooltip: {
      backgroundColor: surface,
      borderColor: hairline,
      textStyle: { color: ink },
    },
    color: [primary, '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6'],
  }
}

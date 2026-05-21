export default function TopicsView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <span className="material-symbols-outlined text-[48px] text-mute mb-4">lightbulb</span>
      <h2 className="text-lg font-medium text-on-surface mb-2">灵感库</h2>
      <p className="text-sm text-body max-w-sm">
        第三期功能。基于你的历史数据分析爆款规律，生成个性化选题建议。
      </p>
      <div className="mt-4 px-3 py-1.5 bg-surface-container rounded-full">
        <span className="text-xs text-mute">即将推出</span>
      </div>
    </div>
  )
}

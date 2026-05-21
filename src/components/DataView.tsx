export default function DataView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <span className="material-symbols-outlined text-[48px] text-mute mb-4">analytics</span>
      <h2 className="text-lg font-medium text-on-surface mb-2">数据分析</h2>
      <p className="text-sm text-body max-w-sm">
        第二期功能。通过 Chrome 自动化采集 B站、抖音、小红书的创作者后台数据，本地存储分析。
      </p>
      <div className="mt-4 px-3 py-1.5 bg-surface-container rounded-full">
        <span className="text-xs text-mute">即将推出</span>
      </div>
    </div>
  )
}

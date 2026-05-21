import type { Page } from '../App'
import logoSvg from '../../assets/logo-sidebar.svg?url'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'chat', icon: 'chat_bubble', label: '创作台' },
  { id: 'data', icon: 'analytics', label: '数据分析' },
  { id: 'topics', icon: 'grid_view', label: '灵感库' },
  { id: 'settings', icon: 'settings', label: '设置' },
]

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[56px] bg-sidebar flex flex-col items-center py-4 h-full border-r border-border/50">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl overflow-hidden mb-6">
        <img src={logoSvg} alt="知更" className="w-full h-full" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`sidebar-btn no-drag ${currentPage === item.id ? 'active' : ''}`}
            title={item.label}
          >
            <span className="material-symbols-outlined text-[20px]">
              {item.icon}
            </span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <button className="sidebar-btn" title="账户">
        <span className="material-symbols-outlined text-[20px]">
          person
        </span>
      </button>
    </aside>
  )
}

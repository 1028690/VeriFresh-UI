import { WorkspaceTab } from '../types/sensor';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenAddModal: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'monitor', label: 'My Pantry' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'stream', label: 'Sensors' },
  { id: 'calibration', label: 'Beta Calibration' },
  { id: 'plans', label: 'Explore Plans' },
];

export function TopBar({ activeTab, onSelectTab, onOpenAddModal }: TopBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('monitor')}
          className="text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
        >
          PantrySense
        </button>

        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'border-blue-600 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Add Food Item
          </button>
        </div>
      </div>
    </header>
  );
}

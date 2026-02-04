import { Tag } from 'lucide-react';
import type { TagStatistic } from '@clawboy/database';

interface TaskCategoriesCardProps {
  tags: TagStatistic[];
}

// Map common tags to emoji icons for visual interest
const tagIcons: Record<string, string> = {
  'smart-contract': '📜',
  solidity: '⛓️',
  frontend: '🎨',
  backend: '⚙️',
  'data-analysis': '📊',
  api: '🔌',
  security: '🔒',
  testing: '🧪',
  documentation: '📝',
  design: '🖼️',
  devops: '🚀',
  blockchain: '⛓️',
  defi: '💰',
  nft: '🖼️',
  web3: '🌐',
};

function getTagIcon(tag: string): string {
  const lowerTag = tag.toLowerCase();
  return tagIcons[lowerTag] ?? '🏷️';
}

export function TaskCategoriesCard({ tags }: TaskCategoriesCardProps) {
  if (tags.length === 0) {
    return null;
  }

  // Calculate max count for bar widths
  const maxCount = Math.max(...tags.map((t) => t.count));

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <Tag className="size-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Popular Categories</h3>
      </div>

      <div className="space-y-3">
        {tags.map(({ tag, count }) => {
          const percentage = (count / maxCount) * 100;
          return (
            <div key={tag} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getTagIcon(tag)}</span>
                  <span className="text-sm font-medium text-foreground">{tag}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {count} task{count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground/20 group-hover:bg-foreground/30 transition-colors rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

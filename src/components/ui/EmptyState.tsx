import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionButton,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 my-4">
      <div className="w-14 h-14 rounded-2xl bg-[#FF5533]/10 text-[#FF5533] flex items-center justify-center mb-4">
        {icon || <FolderOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-[#09090B]">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mt-1 mb-6 leading-relaxed">{description}</p>
      {actionButton}
    </div>
  );
};

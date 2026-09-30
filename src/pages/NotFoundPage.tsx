import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-zinc-200/80 shadow-subtle text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-[#09090B]">404 - Page Not Found</h2>
        <p className="text-xs text-zinc-500">
          The requested page route does not exist or has been moved.
        </p>
        <button
          onClick={onGoHome}
          className="px-4 py-2 bg-[#09090B] hover:bg-[#FF5533] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
};

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, LayoutDashboard } from 'lucide-react';
import { EightbitLogo } from './Logo';
import { Logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.errorBoundaryRenderError(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#dashboard';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-zinc-200/90 shadow-card text-center space-y-6">
            <div className="flex justify-center mb-2">
              <EightbitLogo size="md" />
            </div>

            <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertOctagon className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-[#09090B] tracking-tight">Something went wrong</h1>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                An error occurred while rendering the application layout. You can reload the application or return to the dashboard.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-left text-xs font-mono text-zinc-700 max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#FF5533] hover:bg-[#E64422] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleGoDashboard}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#09090B] hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

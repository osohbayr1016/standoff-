import { Component, type ErrorInfo, type ReactNode } from 'react';
import { datadogRum } from '@datadog/browser-rum';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class DatadogErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        // Send to Datadog
        datadogRum.addError(error, {
            componentStack: errorInfo.componentStack
        });
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 text-center">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                    <p className="text-gray-400 mb-6">We've been notified and are working on a fix.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 transition"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

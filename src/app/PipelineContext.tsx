import { createContext, useContext, type ReactNode } from 'react';
import { usePipeline, type Pipeline } from './usePipeline';

const PipelineContext = createContext<Pipeline | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const pipeline = usePipeline();
  return <PipelineContext.Provider value={pipeline}>{children}</PipelineContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePipelineContext(): Pipeline {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipelineContext must be used inside <PipelineProvider>');
  return ctx;
}

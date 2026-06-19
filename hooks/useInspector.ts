// Powered by OnSpace.AI
import { useContext } from 'react';
import { InspectorContext, InspectorContextType } from '@/contexts/InspectorContext';

export function useInspector(): InspectorContextType {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error('useInspector must be used within InspectorProvider');
  return ctx;
}

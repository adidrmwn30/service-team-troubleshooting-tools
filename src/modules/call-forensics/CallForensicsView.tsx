import React from 'react';
import { CallQualityView } from '../../components/call-quality/CallQualityView';

interface CallForensicsViewProps {
  onBackToControlTower?: () => void;
}

/**
 * Call Forensics Module.
 * Wraps the existing forensic engine and CallQualityView component intact.
 */
export const CallForensicsView: React.FC<CallForensicsViewProps> = (props) => {
  return <CallQualityView {...props} />;
};

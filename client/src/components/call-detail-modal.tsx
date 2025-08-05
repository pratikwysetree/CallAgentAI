import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CallWithDetails } from "@shared/schema";

interface CallDetailModalProps {
  call: CallWithDetails;
  onClose: () => void;
}

export default function CallDetailModal({ call, onClose }: CallDetailModalProps) {
  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleString();
  };

  const collectedData = (call.collectedData as Record<string, any>) || {};

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Call Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Information */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Call Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Contact:</span>
                  <span className="font-medium">{call.contact?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium">{call.phoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{formatDuration(call.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Campaign:</span>
                  <span className="font-medium">{call.campaign?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${call.status === 'completed' ? 'text-success' : call.status === 'failed' ? 'text-error' : 'text-primary'}`}>
                    {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Time:</span>
                  <span className="font-medium">{formatDate(call.startTime)}</span>
                </div>
                {call.endTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">End Time:</span>
                    <span className="font-medium">{formatDate(call.endTime)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Collected Data */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Collected Data</h4>
              <div className="space-y-2">
                {Object.keys(collectedData).length === 0 ? (
                  <p className="text-gray-500">No data collected</p>
                ) : (
                  Object.entries(collectedData).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 capitalize">{key.replace('_', ' ')}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* AI Performance Metrics */}
          {(call.aiResponseTime || call.successScore) && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">AI Performance</h4>
              <div className="grid grid-cols-2 gap-4">
                {call.aiResponseTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-medium">{call.aiResponseTime}ms</span>
                  </div>
                )}
                {call.successScore && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Score:</span>
                    <span className="font-medium">{call.successScore}/100</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conversation Summary */}
          {call.conversationSummary && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Conversation Summary</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{call.conversationSummary}</p>
              </div>
            </div>
          )}

          {/* Recording Link */}
          {call.recordingUrl && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Recording</h4>
              <a 
                href={call.recordingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-primary hover:text-blue-700"
              >
                <i className="fas fa-play-circle"></i>
                <span>Play Recording</span>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

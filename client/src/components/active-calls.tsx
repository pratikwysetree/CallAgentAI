import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CallWithDetails } from "@shared/schema";

interface ActiveCallsProps {
  calls: CallWithDetails[];
  isLoading: boolean;
  onCallSelect: (call: CallWithDetails) => void;
}

export default function ActiveCalls({ calls, isLoading, onCallSelect }: ActiveCallsProps) {
  const { toast } = useToast();

  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      return await apiRequest('POST', `/api/calls/${callId}/end`);
    },
    onSuccess: () => {
      toast({
        title: "Call ended successfully",
        description: "The call has been terminated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/calls/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: () => {
      toast({
        title: "Failed to end call",
        description: "There was an error ending the call.",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (startTime: string | Date) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(diffInSeconds / 60);
    const seconds = diffInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Active Calls</h3>
          <span className="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
            {calls.length} Active
          </span>
        </div>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                    <div className="h-3 bg-gray-300 rounded w-32"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right space-y-1">
                    <div className="h-4 bg-gray-300 rounded w-12"></div>
                    <div className="h-3 bg-gray-300 rounded w-16"></div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg"></div>
                    <div className="w-8 h-8 bg-gray-300 rounded-lg"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-phone-slash text-gray-400 text-3xl mb-4"></i>
            <p className="text-gray-500">No active calls</p>
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <div key={call.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <i className="fas fa-phone text-white text-sm"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {call.contact?.name || 'Unknown Contact'}
                    </h4>
                    <p className="text-sm text-gray-600">{call.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDuration(call.startTime)}
                    </p>
                    <p className="text-xs text-gray-500">Duration</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => onCallSelect(call)}
                      className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                      title="View details"
                    >
                      <i className="fas fa-eye text-gray-600"></i>
                    </button>
                    <button 
                      onClick={() => endCallMutation.mutate(call.id)}
                      disabled={endCallMutation.isPending}
                      className="p-2 bg-error text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      title="End call"
                    >
                      {endCallMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-phone-slash"></i>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

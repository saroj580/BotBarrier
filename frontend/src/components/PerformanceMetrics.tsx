import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Zap, 
  Database, 
  Cpu, 
  MemoryStick, 
  Network, 
  Clock, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  history: number[];
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  services: {
    api: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
    mlService: 'healthy' | 'warning' | 'critical';
    redis: 'healthy' | 'warning' | 'critical';
  };
  uptime: number;
  lastIncident: Date | null;
}

interface PerformanceMetricsProps {
  className?: string;
}

const PerformanceMetrics = ({ className }: PerformanceMetricsProps) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    services: {
      api: 'healthy',
      database: 'healthy',
      mlService: 'healthy',
      redis: 'healthy'
    },
    uptime: 0,
    lastIncident: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [realTimeMode, setRealTimeMode] = useState(true);

  // Mock performance data
  const mockMetrics: PerformanceMetric[] = [
    {
      name: "Response Time",
      value: 45,
      unit: "ms",
      trend: 'down',
      status: 'healthy',
      threshold: { warning: 100, critical: 200 },
      history: [52, 48, 45, 42, 45, 47, 45]
    },
    {
      name: "Throughput",
      value: 1250,
      unit: "req/s",
      trend: 'up',
      status: 'healthy',
      threshold: { warning: 1000, critical: 2000 },
      history: [1100, 1150, 1200, 1250, 1230, 1250, 1250]
    },
    {
      name: "CPU Usage",
      value: 35,
      unit: "%",
      trend: 'stable',
      status: 'healthy',
      threshold: { warning: 70, critical: 90 },
      history: [32, 34, 35, 36, 35, 34, 35]
    },
    {
      name: "Memory Usage",
      value: 68,
      unit: "%",
      trend: 'up',
      status: 'warning',
      threshold: { warning: 70, critical: 85 },
      history: [60, 62, 65, 68, 67, 68, 68]
    },
    {
      name: "Database Latency",
      value: 12,
      unit: "ms",
      trend: 'down',
      status: 'healthy',
      threshold: { warning: 50, critical: 100 },
      history: [15, 14, 13, 12, 12, 12, 12]
    },
    {
      name: "ML Processing Time",
      value: 85,
      unit: "ms",
      trend: 'down',
      status: 'healthy',
      threshold: { warning: 200, critical: 500 },
      history: [95, 90, 88, 85, 87, 85, 85]
    }
  ];

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics(mockMetrics);
      setSystemHealth({
        overall: 'healthy',
        services: {
          api: 'healthy',
          database: 'healthy',
          mlService: 'healthy',
          redis: 'healthy'
        },
        uptime: 99.9,
        lastIncident: null
      });
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!realTimeMode) return;

    const socket: Socket = io(API_BASE, { transports: ["websocket"] });
    
    socket.on("performance_update", (payload: any) => {
      setMetrics(prev => prev.map(metric => {
        if (metric.name === payload.name) {
          return {
            ...metric,
            value: payload.value,
            trend: payload.trend,
            status: payload.status,
            history: [...metric.history.slice(1), payload.value]
          };
        }
        return metric;
      }));
    });

    socket.on("system_health_update", (payload: any) => {
      setSystemHealth(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [realTimeMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getProgressColor = (value: number, threshold: { warning: number; critical: number }) => {
    if (value >= threshold.critical) return 'bg-red-500';
    if (value >= threshold.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            <CardTitle>Performance Metrics</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={realTimeMode ? "default" : "outline"}
              size="sm"
              onClick={() => setRealTimeMode(!realTimeMode)}
            >
              <Activity className="w-4 h-4 mr-1" />
              {realTimeMode ? 'Live' : 'Paused'}
            </Button>
          </div>
        </div>
        <CardDescription>
          Real-time system performance and health monitoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading performance data...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* System Health Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">System Health</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemHealth.overall)}
                  <Badge variant={systemHealth.overall === 'healthy' ? 'default' : 'destructive'}>
                    {systemHealth.overall.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Uptime</span>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {systemHealth.uptime.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Service Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Service Status</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(systemHealth.services).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm capitalize">{service}</span>
                    <div className="flex items-center gap-1">
                      {getServiceStatusIcon(status)}
                      <span className="text-xs">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Live Metrics</h4>
              <div className="space-y-3">
                {metrics.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{metric.name}</span>
                        {getTrendIcon(metric.trend)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                          {metric.value}{metric.unit}
                        </span>
                        {getStatusIcon(metric.status)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress 
                        value={(metric.value / metric.threshold.critical) * 100} 
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0{metric.unit}</span>
                        <span>Warning: {metric.threshold.warning}{metric.unit}</span>
                        <span>Critical: {metric.threshold.critical}{metric.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {metrics.find(m => m.name === 'Throughput')?.value || 0}
                </div>
                <div className="text-xs text-muted-foreground">req/s</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {metrics.find(m => m.name === 'Response Time')?.value || 0}ms
                </div>
                <div className="text-xs text-muted-foreground">avg response</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {metrics.find(m => m.name === 'CPU Usage')?.value || 0}%
                </div>
                <div className="text-xs text-muted-foreground">CPU usage</div>
              </div>
            </div>

            {/* Last Incident */}
            {systemHealth.lastIncident && (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium">Last Incident</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {systemHealth.lastIncident.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceMetrics;

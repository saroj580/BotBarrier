import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Bot, 
  Shield, 
  AlertTriangle,
  Activity,
  Target
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface BotScoreData {
  score: number;
  count: number;
  percentage: number;
  timestamp: Date;
  category: 'human' | 'suspicious' | 'bot' | 'critical';
}

interface DistributionStats {
  total: number;
  human: number;
  suspicious: number;
  bot: number;
  critical: number;
  average: number;
  median: number;
  mode: number;
}

interface BotScoreDistributionProps {
  className?: string;
}

const BotScoreDistribution = ({ className }: BotScoreDistributionProps) => {
  const [scoreData, setScoreData] = useState<BotScoreData[]>([]);
  const [stats, setStats] = useState<DistributionStats>({
    total: 0,
    human: 0,
    suspicious: 0,
    bot: 0,
    critical: 0,
    average: 0,
    median: 0,
    mode: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [realTimeMode, setRealTimeMode] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Mock data for demonstration
  const mockScoreData: BotScoreData[] = [
    { score: 0.1, count: 1250, percentage: 45.2, timestamp: new Date(), category: 'human' },
    { score: 0.2, count: 890, percentage: 32.1, timestamp: new Date(), category: 'human' },
    { score: 0.3, count: 420, percentage: 15.2, timestamp: new Date(), category: 'suspicious' },
    { score: 0.4, count: 180, percentage: 6.5, timestamp: new Date(), category: 'suspicious' },
    { score: 0.5, count: 95, percentage: 3.4, timestamp: new Date(), category: 'suspicious' },
    { score: 0.6, count: 45, percentage: 1.6, timestamp: new Date(), category: 'bot' },
    { score: 0.7, count: 25, percentage: 0.9, timestamp: new Date(), category: 'bot' },
    { score: 0.8, count: 15, percentage: 0.5, timestamp: new Date(), category: 'bot' },
    { score: 0.9, count: 8, percentage: 0.3, timestamp: new Date(), category: 'critical' },
    { score: 1.0, count: 3, percentage: 0.1, timestamp: new Date(), category: 'critical' }
  ];

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setScoreData(mockScoreData);
      calculateStats(mockScoreData);
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!realTimeMode) return;

    const socket: Socket = io(API_BASE, { transports: ["websocket"] });
    
    socket.on("bot_score_update", (payload: any) => {
      setScoreData(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(d => d.score === payload.score);
        
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            count: payload.count,
            percentage: payload.percentage,
            timestamp: new Date()
          };
        } else {
          updated.push({
            score: payload.score,
            count: payload.count,
            percentage: payload.percentage,
            timestamp: new Date(),
            category: getCategoryFromScore(payload.score)
          });
        }
        
        calculateStats(updated);
        return updated.sort((a, b) => a.score - b.score);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [realTimeMode]);

  const getCategoryFromScore = (score: number): 'human' | 'suspicious' | 'bot' | 'critical' => {
    if (score < 0.3) return 'human';
    if (score < 0.6) return 'suspicious';
    if (score < 0.9) return 'bot';
    return 'critical';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'human': return 'bg-green-500';
      case 'suspicious': return 'bg-yellow-500';
      case 'bot': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'human': return 'default';
      case 'suspicious': return 'secondary';
      case 'bot': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const calculateStats = (data: BotScoreData[]) => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    const human = data.filter(d => d.category === 'human').reduce((sum, item) => sum + item.count, 0);
    const suspicious = data.filter(d => d.category === 'suspicious').reduce((sum, item) => sum + item.count, 0);
    const bot = data.filter(d => d.category === 'bot').reduce((sum, item) => sum + item.count, 0);
    const critical = data.filter(d => d.category === 'critical').reduce((sum, item) => sum + item.count, 0);
    
    const weightedSum = data.reduce((sum, item) => sum + (item.score * item.count), 0);
    const average = total > 0 ? weightedSum / total : 0;
    
    // Calculate median
    const sortedScores = data.flatMap(item => Array(item.count).fill(item.score)).sort((a, b) => a - b);
    const median = sortedScores.length > 0 ? sortedScores[Math.floor(sortedScores.length / 2)] : 0;
    
    // Calculate mode (most frequent score)
    const mode = data.reduce((max, item) => item.count > max.count ? item : max, data[0] || { score: 0, count: 0 }).score;

    setStats({
      total,
      human,
      suspicious,
      bot,
      critical,
      average,
      median,
      mode
    });
  };

  const getMaxCount = () => Math.max(...scoreData.map(d => d.count));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <CardTitle>Bot Score Distribution</CardTitle>
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
          Real-time analysis of bot detection scores and patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading distribution data...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.human.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Human</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.suspicious.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Suspicious</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.bot.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Bot</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.critical.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
            </div>

            {/* Distribution Charts */}
            <Tabs defaultValue="histogram" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="histogram">Histogram</TabsTrigger>
                <TabsTrigger value="pie">Pie Chart</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              <TabsContent value="histogram" className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Score Distribution Histogram</h4>
                  <div className="space-y-2">
                    {scoreData.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-12 text-xs text-muted-foreground">
                          {(item.score * 100).toFixed(0)}%
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div 
                              className={`h-4 rounded ${getCategoryColor(item.category)}`}
                              style={{ 
                                width: `${(item.count / getMaxCount()) * 100}%`,
                                minWidth: '4px'
                              }}
                            />
                            <span className="text-xs font-medium">{item.count}</span>
                            <span className="text-xs text-muted-foreground">({item.percentage.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <Badge variant={getCategoryVariant(item.category)} className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pie" className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Category Distribution</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { category: 'human', count: stats.human, color: 'bg-green-500' },
                      { category: 'suspicious', count: stats.suspicious, color: 'bg-yellow-500' },
                      { category: 'bot', count: stats.bot, color: 'bg-orange-500' },
                      { category: 'critical', count: stats.critical, color: 'bg-red-500' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded border">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm capitalize">{item.category}</span>
                        <span className="text-sm font-medium ml-auto">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Score Statistics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded border">
                      <div className="text-lg font-bold text-blue-600">
                        {(stats.average * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Average</div>
                    </div>
                    <div className="text-center p-3 rounded border">
                      <div className="text-lg font-bold text-purple-600">
                        {(stats.median * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Median</div>
                    </div>
                    <div className="text-center p-3 rounded border">
                      <div className="text-lg font-bold text-indigo-600">
                        {(stats.mode * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Mode</div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Risk Analysis */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Risk Analysis
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Low Risk</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((stats.human / stats.total) * 100).toFixed(1)}% of traffic
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium">High Risk</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(((stats.bot + stats.critical) / stats.total) * 100).toFixed(1)}% of traffic
                  </div>
                </div>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time Range:</span>
              <div className="flex gap-1">
                {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={selectedTimeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTimeRange(range)}
                    className="text-xs"
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BotScoreDistribution;

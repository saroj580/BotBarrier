import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, AlertTriangle, Shield, Activity, TrendingUp } from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface CountryThreat {
  country: string;
  countryCode: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  requestCount: number;
  botPercentage: number;
  blockedIPs: number;
  lastActivity: Date;
  coordinates: [number, number];
}

interface WorldMapProps {
  className?: string;
}

const WorldMap = ({ className }: WorldMapProps) => {
  const [threats, setThreats] = useState<CountryThreat[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryThreat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [realTimeMode, setRealTimeMode] = useState(true);

  // Mock data for demonstration - in real implementation, this would come from API
  const mockThreatData: CountryThreat[] = [
    {
      country: "United States",
      countryCode: "US",
      threatLevel: "high",
      requestCount: 15420,
      botPercentage: 23.5,
      blockedIPs: 342,
      lastActivity: new Date(),
      coordinates: [-95.7129, 37.0902]
    },
    {
      country: "China",
      countryCode: "CN",
      threatLevel: "critical",
      requestCount: 8930,
      botPercentage: 67.8,
      blockedIPs: 1205,
      lastActivity: new Date(Date.now() - 300000),
      coordinates: [104.1954, 35.8617]
    },
    {
      country: "Russia",
      countryCode: "RU",
      threatLevel: "high",
      requestCount: 4560,
      botPercentage: 45.2,
      blockedIPs: 678,
      lastActivity: new Date(Date.now() - 180000),
      coordinates: [105.3188, 61.5240]
    },
    {
      country: "Germany",
      countryCode: "DE",
      threatLevel: "medium",
      requestCount: 2340,
      botPercentage: 12.3,
      blockedIPs: 89,
      lastActivity: new Date(Date.now() - 120000),
      coordinates: [10.4515, 51.1657]
    },
    {
      country: "India",
      countryCode: "IN",
      threatLevel: "medium",
      requestCount: 1890,
      botPercentage: 18.7,
      blockedIPs: 156,
      lastActivity: new Date(Date.now() - 90000),
      coordinates: [78.9629, 20.5937]
    },
    {
      country: "Brazil",
      countryCode: "BR",
      threatLevel: "low",
      requestCount: 1230,
      botPercentage: 8.9,
      blockedIPs: 45,
      lastActivity: new Date(Date.now() - 60000),
      coordinates: [-51.9253, -14.2350]
    },
    {
      country: "Japan",
      countryCode: "JP",
      threatLevel: "low",
      requestCount: 980,
      botPercentage: 5.2,
      blockedIPs: 23,
      lastActivity: new Date(Date.now() - 30000),
      coordinates: [138.2529, 36.2048]
    }
  ];

  useEffect(() => {
    // Simulate initial data load
    const loadInitialData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setThreats(mockThreatData);
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!realTimeMode) return;

    const socket: Socket = io(API_BASE, { transports: ["websocket"] });
    
    socket.on("geo_threat_update", (payload: any) => {
      setThreats(prev => {
        const existingIndex = prev.findIndex(t => t.countryCode === payload.countryCode);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            requestCount: payload.requestCount,
            botPercentage: payload.botPercentage,
            blockedIPs: payload.blockedIPs,
            threatLevel: payload.threatLevel,
            lastActivity: new Date()
          };
          return updated;
        } else {
          return [...prev, payload];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [realTimeMode]);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getThreatVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const totalRequests = threats.reduce((sum, threat) => sum + threat.requestCount, 0);
  const totalBlocked = threats.reduce((sum, threat) => sum + threat.blockedIPs, 0);
  const avgBotPercentage = threats.length > 0 
    ? threats.reduce((sum, threat) => sum + threat.botPercentage, 0) / threats.length 
    : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <CardTitle>Global Threat Map</CardTitle>
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
          Real-time threat visualization by geographic location
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading threat data...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalRequests.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totalBlocked.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Blocked IPs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{avgBotPercentage.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Avg Bot %</div>
              </div>
            </div>

            {/* World Map Visualization */}
            <div className="relative">
              <div className="w-full h-64 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <div className="text-center">
                  <Globe className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Interactive World Map</p>
                  <p className="text-xs text-muted-foreground">Click countries to view details</p>
                </div>
              </div>
              
              {/* Threat Indicators (simulated map markers) */}
              {threats.map((threat, index) => (
                <div
                  key={threat.countryCode}
                  className={`absolute w-4 h-4 rounded-full ${getThreatColor(threat.threatLevel)} cursor-pointer hover:scale-125 transition-transform`}
                  style={{
                    left: `${20 + (index * 12)}%`,
                    top: `${30 + (index % 3) * 20}%`,
                    animation: realTimeMode ? 'pulse 2s infinite' : 'none'
                  }}
                  onClick={() => setSelectedCountry(threat)}
                  title={`${threat.country}: ${threat.botPercentage.toFixed(1)}% bot traffic`}
                />
              ))}
            </div>

            {/* Country List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Active Threats by Country
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {threats
                  .sort((a, b) => b.botPercentage - a.botPercentage)
                  .map((threat) => (
                    <div
                      key={threat.countryCode}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedCountry?.countryCode === threat.countryCode ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedCountry(threat)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getThreatColor(threat.threatLevel)}`} />
                        <div>
                          <div className="font-medium text-sm">{threat.country}</div>
                          <div className="text-xs text-muted-foreground">
                            {threat.requestCount.toLocaleString()} requests
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={getThreatVariant(threat.threatLevel)} className="text-xs">
                          {threat.botPercentage.toFixed(1)}%
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {threat.blockedIPs} blocked
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Selected Country Details */}
            {selectedCountry && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {selectedCountry.country} Details
                  </h4>
                  <Badge variant={getThreatVariant(selectedCountry.threatLevel)}>
                    {selectedCountry.threatLevel.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Requests</div>
                    <div className="font-medium">{selectedCountry.requestCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bot Percentage</div>
                    <div className="font-medium">{selectedCountry.botPercentage.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Blocked IPs</div>
                    <div className="font-medium">{selectedCountry.blockedIPs.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Activity</div>
                    <div className="font-medium">
                      {selectedCountry.lastActivity.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorldMap;

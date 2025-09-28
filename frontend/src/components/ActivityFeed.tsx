import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api";
import { getAuth } from "@/lib/auth";
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Shield, Bot, Clock, CreditCard, User, Lock, Eye } from "lucide-react";

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: "threat" | "block" | "detection" | "alert" | "payment" | "login" | "verification";
  message: string;
  severity: "low" | "medium" | "high";
  ip?: string;
  userAgent?: string;
  path?: string;
  score?: number;
  reason?: string;
}

const ActivityFeed = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSecurityLogs = async () => {
      try {
        const auth = getAuth();
        if (!auth.accessToken) {
          setIsLoading(false);
          return;
        }

        const endpoint = auth.user?.role === 'admin' ? '/admin/logs' : '/user/logs';
        const response = await api.get(endpoint, { 
          params: { limit: 20, sort: '-createdAt' } 
        });
        
        const logEvents: ActivityEvent[] = response.data.items.map((log: any) => ({
          id: log._id,
          timestamp: new Date(log.createdAt),
          type: getEventTypeFromReason(log.reason),
          message: formatEventMessage(log),
          severity: getSeverityFromScore(log.score),
          ip: log.ip,
          userAgent: log.userAgent,
          path: log.path,
          score: log.score,
          reason: log.reason
        }));

        setEvents(logEvents);
      } catch (error) {
        console.error('Failed to fetch security logs:', error);
        if (error.response?.status === 403) {
          console.log('User does not have permission to view security logs');
        }
        setEvents(getDefaultEvents());
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecurityLogs();
  }, []);

  useEffect(() => {
    const socket: Socket = io(API_BASE, { transports: ["websocket"] });
    
    socket.on("suspicious", (payload: any) => {
      const newEvent: ActivityEvent = {
        id: String(payload.id || Date.now()),
        timestamp: new Date(),
        type: getEventTypeFromReason(payload.reason),
        message: formatEventMessage(payload),
        severity: getSeverityFromScore(payload.score),
        ip: payload.ip,
        userAgent: payload.userAgent,
        path: payload.path,
        score: payload.score,
        reason: payload.reason
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 49)]);
    });

    socket.on("payment_event", (payload: any) => {
      const newEvent: ActivityEvent = {
        id: String(payload.transactionId || Date.now()),
        timestamp: new Date(),
        type: "payment",
        message: formatPaymentEventMessage(payload),
        severity: getSeverityFromScore(payload.botScore),
        ip: payload.ip,
        score: payload.botScore,
        reason: payload.status
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 49)]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const formatCurrency = (amount: number | string, currency: string = 'USD'): string => {
    if (amount === 'N/A' || amount === null || amount === undefined) return 'N/A';
    
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'INR': '₹'
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount}`;
  };

  const getEventTypeFromReason = (reason: string): ActivityEvent['type'] => {
    switch (reason) {
      case 'blocklist': return 'block';
      case 'suspected_bot': return 'threat';
      case 'login_failed': return 'alert';
      case 'payment_completed': return 'payment';
      case 'payment_failed': return 'payment';
      case 'verification_required': return 'verification';
      case 'user_login': return 'login';
      default: return 'detection';
    }
  };

  const formatEventMessage = (log: any): string => {
    const score = log.score ? ` (${Math.round(log.score * 100)}%)` : '';
    
    switch (log.reason) {
      case 'blocklist':
        return `IP blocked - Listed in blocklist${score}`;
      case 'suspected_bot':
        return `Bot detected - Suspicious activity${score}`;
      case 'login_failed':
        return `Failed login attempt - ${log.path}${score}`;
      case 'payment_completed':
        const currency = log.meta?.currency || 'USD';
        const amount = log.meta?.amount || 'N/A';
        return `Payment completed - Amount: ${formatCurrency(amount, currency)}${score}`;
      case 'payment_failed':
        return `Payment failed - Bot score too high${score}`;
      case 'verification_required':
        return `Verification required - Medium risk${score}`;
      case 'user_login':
        return `User login - ${log.userAgent?.split(' ')[0] || 'Unknown browser'}`;
      default:
        return `${log.reason || 'Security event'} on ${log.path || '/'}${score}`;
    }
  };

  const formatPaymentEventMessage = (payload: any): string => {
    const score = payload.botScore ? ` (${Math.round(payload.botScore * 100)}%)` : '';
    
    switch (payload.status) {
      case 'blocked':
        return `Payment blocked - High bot score detected${score}`;
      case 'completed':
        const currency = payload.currency || 'USD';
        const amount = payload.amount || 'N/A';
        return `Payment completed - Amount: ${formatCurrency(amount, currency)}${score}`;
      case 'failed':
        return `Payment failed - Security check failed${score}`;
      case 'verification_required':
        return `Payment verification required - Medium risk${score}`;
      default:
        return `Payment ${payload.status}${score}`;
    }
  };

  const getSeverityFromScore = (score: number): "low" | "medium" | "high" => {
    if (score >= 0.8) return "high";
    if (score >= 0.6) return "medium";
    return "low";
  };

  const getDefaultEvents = (): ActivityEvent[] => [
    {
      id: "1",
      timestamp: new Date(),
      type: "block",
      message: "Payment blocked - High bot score detected (87%)",
      severity: "high",
      ip: "192.168.1.100"
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 120000),
      type: "detection",
      message: "ML service processed payment - Low risk (12%)",
      severity: "low",
      ip: "203.45.67.89"
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 240000),
      type: "threat",
      message: "Suspicious payment pattern detected - Multiple devices",
      severity: "high"
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 360000),
      type: "alert",
      message: "Payment verification required - Medium risk (45%)",
      severity: "medium"
    },
    {
      id: "5",
      timestamp: new Date(Date.now() - 480000),
      type: "detection",
      message: "Successful payment processed - Human user verified",
      severity: "low",
      ip: "10.0.0.15"
    }
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case "block": return <Shield className="w-4 h-4" />;
      case "threat": return <AlertTriangle className="w-4 h-4" />;
      case "detection": return <Bot className="w-4 h-4" />;
      case "payment": return <CreditCard className="w-4 h-4" />;
      case "login": return <User className="w-4 h-4" />;
      case "verification": return <Eye className="w-4 h-4" />;
      case "alert": return <Lock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Live Activity Feed
        </CardTitle>
        <CardDescription>Real-time security events and system alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading security events...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No security events yet</p>
                  <p className="text-xs text-muted-foreground">Events will appear here as they occur</p>
                </div>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
                  <div className={`p-1 rounded-full ${
                    event.severity === "high" ? "bg-destructive/10 text-destructive" :
                    event.severity === "medium" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{event.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{event.timestamp.toLocaleTimeString()}</span>
                      {event.ip && <span>• {event.ip}</span>}
                      {event.path && <span>• {event.path}</span>}
                    </div>
                    {event.userAgent && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
                        {event.userAgent.split(' ')[0]} {event.userAgent.split(' ')[1]}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={getSeverityVariant(event.severity)} className="text-xs">
                      {event.severity}
                    </Badge>
                    {event.score && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(event.score * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const ThreatChart = () => {
  const data = [
    { time: "00:00", threats: 12, requests: 450, payments: 23, botScore: 0.15 },
    { time: "04:00", threats: 8, requests: 380, payments: 18, botScore: 0.12 },
    { time: "08:00", threats: 25, requests: 820, payments: 45, botScore: 0.28 },
    { time: "12:00", threats: 42, requests: 1200, payments: 67, botScore: 0.35 },
    { time: "16:00", threats: 38, requests: 1100, payments: 52, botScore: 0.31 },
    { time: "20:00", threats: 28, requests: 750, payments: 34, botScore: 0.22 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment & Threat Detection Trends</CardTitle>
        <CardDescription>24-hour overview of payments, threats, and ML bot scores</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="time" className="text-muted-foreground" />
            <YAxis className="text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px"
              }}
              formatter={(value, name) => {
                if (name === 'botScore') return [`${(value * 100).toFixed(1)}%`, 'Avg Bot Score'];
                return [value, name];
              }}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stackId="1"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              name="Total Requests"
            />
            <Area
              type="monotone"
              dataKey="payments"
              stackId="2"
              stroke="hsl(var(--blue-500))"
              fill="hsl(var(--blue-500))"
              fillOpacity={0.2}
              name="Payments"
            />
            <Area
              type="monotone"
              dataKey="threats"
              stackId="3"
              stroke="hsl(var(--destructive))"
              fill="hsl(var(--destructive))"
              fillOpacity={0.3}
              name="Threats Detected"
            />
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Bot Score Trend */}
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" className="text-muted-foreground" />
              <YAxis domain={[0, 0.5]} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
                formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Bot Score']}
              />
              <Line
                type="monotone"
                dataKey="botScore"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--warning))", strokeWidth: 2, r: 4 }}
                name="ML Bot Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThreatChart;
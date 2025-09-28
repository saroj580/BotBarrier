import { useState, useEffect } from "react";
import { getAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  DollarSign,
  Shield,
  Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentTransaction {
  _id: string;
  ticketId: string;
  platform: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "blocked" | "cancelled";
  botScore: number;
  botDetectionReasons: string[];
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  verificationSteps?: Array<{
    step: string;
    passed: boolean;
    timestamp: string;
    details: any;
  }>;
}

const PaymentHistory = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const auth = getAuth();
  const isAuthenticated = !!auth.accessToken;

  useEffect(() => {
    if (isAuthenticated) {
      fetchPaymentHistory();
    }
  }, [isAuthenticated, currentPage, statusFilter, platformFilter]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20"
      });
      
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      
      if (platformFilter !== "all") {
        params.append("platform", platformFilter);
      }

      const response = await api.get(`/payment/history?${params}`);
      const data = response.data;
      
      setPayments(data.payments || []);
      setTotalPages(data.totalPages || 1);
      setTotalPayments(data.total || 0);
      setTotalAmount(data.totalAmount || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch payment history",
        variant: "destructive"
      });
      console.error("Payment history error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
      case "blocked": return <Shield className="w-4 h-4 text-red-500" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "cancelled": return <XCircle className="w-4 h-4 text-gray-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "failed": return "destructive";
      case "blocked": return "destructive";
      case "pending": return "secondary";
      case "cancelled": return "outline";
      default: return "outline";
    }
  };

  const getBotScoreVariant = (score: number) => {
    if (score >= 0.6) return "destructive";
    if (score >= 0.3) return "secondary";
    return "outline";
  };

  const getBotScoreLabel = (score: number) => {
    if (score >= 0.6) return "High Risk";
    if (score >= 0.3) return "Medium Risk";
    return "Low Risk";
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchTerm === "" || 
      payment.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.platform.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Date", "Ticket ID", "Platform", "Amount", "Status", "Bot Score", "Payment Method"].join(","),
      ...filteredPayments.map(payment => [
        formatDate(payment.createdAt),
        payment.ticketId,
        payment.platform,
        `₹${payment.amount.toFixed(2)}`,
        payment.status,
        `${(payment.botScore * 100).toFixed(1)}%`,
        payment.paymentMethod
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to view your payment history.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground">Track all your payment transactions and security status</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPayments}</div>
            <p className="text-xs text-muted-foreground">All transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">INR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {payments.filter(p => p.status === "completed").length}
            </div>
            <p className="text-xs text-muted-foreground">Successful payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {payments.filter(p => p.status === "blocked").length}
            </div>
            <p className="text-xs text-muted-foreground">Security blocks</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by ticket ID or platform..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="ticketmaster">Ticketmaster</SelectItem>
                <SelectItem value="eventbrite">Eventbrite</SelectItem>
                <SelectItem value="stubhub">StubHub</SelectItem>
                <SelectItem value="seatgeek">SeatGeek</SelectItem>
                <SelectItem value="vividseats">Vivid Seats</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Detailed view of all your payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading payment history...</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payments found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || platformFilter !== "all"
                  ? "Try adjusting your filters to see more results."
                  : "You haven't made any payments yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bot Score</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-mono text-sm">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono">{payment.ticketId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{payment.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <Badge variant={getStatusVariant(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="w-3 h-3" />
                          <Badge variant={getBotScoreVariant(payment.botScore)}>
                            {getBotScoreLabel(payment.botScore)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(payment.botScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {payment.paymentMethod.replace("_", " ")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredPayments.length} of {totalPayments} payments
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;

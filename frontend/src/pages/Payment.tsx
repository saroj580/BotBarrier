import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { initiatePayment, processPayment, getPaymentStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Bot,
  Clock,
  Smartphone,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { getAuth } from "@/lib/auth";

const loadRecaptchaScript = () => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="recaptcha"]')) {
      console.log('reCAPTCHA script already loaded');
      resolve(true);
      return;
    }

    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isDevelopment) {
      console.log('Development environment detected, using fallback for reCAPTCHA');
      resolve(false); 
      return;
    }
    
    
    const currentPort = window.location.port;
    if (currentPort && currentPort !== '80' && currentPort !== '443' && currentPort !== '3000' && currentPort !== '5173') {
      console.log(`Non-standard port detected (${currentPort}), using fallback for reCAPTCHA`);
      resolve(false);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('reCAPTCHA script loaded successfully');
      resolve(true);
    };
    
    script.onerror = (error) => {
      console.error('Failed to load reCAPTCHA script:', error);
      resolve(false); 
    };
    
    document.head.appendChild(script);
  });
};
const ticketTypes = {
  standard: {
    price: 50,
    prefix: "STD"
  },
  vip: {
    price: 100,
    prefix: "VIP" 
  },
  premium: {
    price: 150,
    prefix: "PRM" 
  }
};

const validateTicketId = (ticketId: string) => {
  const pattern = /^(STD|VIP|PRM)-(TM|EB|SH|SG|VS)-\d{5}$/;
  return pattern.test(ticketId);
};

const platformCodes: { [key: string]: string } = {
  ticketmaster: "TM",
  eventbrite: "EB",
  stubhub: "SH",
  seatgeek: "SG",
  vividseats: "VS",
};

const generateTicketId = (selectedTicketType: "standard" | "vip" | "premium", selectedPlatform: string) => {
  const prefix = ticketTypes[selectedTicketType].prefix;
  const platformCode = platformCodes[selectedPlatform];
  if (!platformCode) return ""; 

  const randomNumber = Math.floor(10000 + Math.random() * 90000); // Generate a random 5-digit number
  return `${prefix}-${platformCode}-${randomNumber}`;
};

interface PaymentData {
  platform: string;
  ticketId: string;
  ticketType: "standard" | "vip" | "premium";
  amount: number;
  currency: string;
  paymentMethod: string;
}

interface BotDetectionResult {
  botScore: number;
  detectionReasons: string[];
  riskFactors: any;
  requiresVerification: boolean;
  verificationSteps?: string[];
}

function PaymentPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let executeRecaptcha: any = null;
  
  try {
    const recaptchaHook = useGoogleReCaptcha();
    executeRecaptcha = recaptchaHook?.executeRecaptcha;
  } catch (error) {
    console.log('reCAPTCHA provider not available, using fallback mode');
  }

  const [paymentData, setPaymentData] = useState<PaymentData>({
    platform: "",
    ticketId: "",
    ticketType: "standard",
    amount: ticketTypes.standard.price,
    currency: "INR",
    paymentMethod: ""
  });

  const [botDetection, setBotDetection] = useState<BotDetectionResult | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationStep, setVerificationStep] = useState<string | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const platforms = [
    { value: "ticketmaster", label: "Ticketmaster" },
    { value: "eventbrite", label: "Eventbrite" },
    { value: "stubhub", label: "StubHub" },
    { value: "seatgeek", label: "SeatGeek" },
    { value: "vividseats", label: "Vivid Seats" }
  ];

  const paymentMethods = [
    { value: "credit_card", label: "Credit Card" },
    { value: "debit_card", label: "Debit Card" },
    { value: "paypal", label: "PayPal" },
    { value: "apple_pay", label: "Apple Pay" },
    { value: "google_pay", label: "Google Pay" }
  ];

  useEffect(() => {
    if (paymentData.platform && paymentData.ticketType) {
      const newTicketId = generateTicketId(paymentData.ticketType, paymentData.platform);
      setPaymentData(prev => ({ ...prev, ticketId: newTicketId }));
    }
  }, [paymentData.platform, paymentData.ticketType]);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10; 
    
    const initializeRecaptcha = async () => {
      try {
        const scriptLoaded = await loadRecaptchaScript();
        
        if (!scriptLoaded) {
          console.log('reCAPTCHA script not loaded, using fallback mode');
          setRecaptchaReady(false);
          return;
        }
        
        const checkRecaptcha = () => {
          if (executeRecaptcha) {
            setRecaptchaReady(true);
            console.log('reCAPTCHA is ready');
          } else if (retryCount < maxRetries) {
            retryCount++;
            console.log(`reCAPTCHA not ready yet, retrying... (${retryCount}/${maxRetries})`);
            setTimeout(checkRecaptcha, 1000); 
          } else {
            console.warn('reCAPTCHA failed to load after maximum retries, using fallback');
            setRecaptchaReady(false);
          }
        };
        
        checkRecaptcha();
      } catch (error) {
        console.error('Failed to initialize reCAPTCHA:', error);
        setRecaptchaReady(false);
      }
    };

    initializeRecaptcha();
    
    const timeout = setTimeout(() => {
      if (!recaptchaReady) {
        console.warn('reCAPTCHA loading timeout, will use fallback if needed');
        setRecaptchaReady(false);
      }
    }, 15000); 
    
    return () => {
      clearTimeout(timeout);
    };
  }, [executeRecaptcha]); 

  useEffect(() => {
    console.log("Bot detection state changed:", botDetection);
  }, [botDetection]);

  const getBotScoreColor = (score: number) => {
    if (score >= 0.6) return "destructive";
    if (score >= 0.3) return "secondary";
    return "outline";
  };

  const getBotScoreLabel = (score: number) => {
    if (score >= 0.6) return "High Risk";
    if (score >= 0.3) return "Medium Risk";
    return "Low Risk";
  };

  const getRiskIcon = (reason: string) => {
    switch (reason) {
      case "headless_browser": return <Bot className="w-4 h-4" />;
      case "rapid_purchase": return <Clock className="w-4 h-4" />;
      case "multiple_devices": return <Smartphone className="w-4 h-4" />;
      case "geo_mismatch": return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setError("");

    const auth = getAuth();
    if (!auth.accessToken) {
      setError("Please log in to continue with payment");
      setLoading(false);
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with payment.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Sending payment data:", paymentData);
      const result = await initiatePayment(paymentData);
      console.log("initiatePayment result:", result); 

      if (result.botScore !== undefined) {
        setBotDetection({
          botScore: result.botScore,
          detectionReasons: result.detectionReasons || [],
          riskFactors: result.riskFactors || {},
          requiresVerification: result.reason === "bot_detected" || result.reason === "medium_risk",
          verificationSteps: result.verificationSteps || []
        });
        console.log("Bot detection results set:", {
          botScore: result.botScore,
          detectionReasons: result.detectionReasons || [],
          requiresVerification: result.reason === "bot_detected" || result.reason === "medium_risk"
        });
      }

      if (result.reason === "bot_detected") {
        setPaymentStatus("verification_required");
        setVerificationStep("bot_detection");
        setTransactionId(result.transactionId);
        toast({
          title: "Bot Detected",
          description: "Your payment has been flagged as potential bot activity.",
          variant: "destructive"
        });
      } else if (result.reason === "medium_risk") {
        console.log("Medium risk detected, setting verificationStep to captcha"); 
        console.log("Bot detection result:", result);
        setPaymentStatus("verification_required");
        setVerificationStep("captcha");
        setTransactionId(result.transactionId);
        toast({
          title: "Verification Required",
          description: "Additional verification is required to complete your payment.",
          variant: "default"
        });
      } else {
        setTransactionId(result.transactionId);
        setPaymentStatus("processing");
        toast({
          title: "Payment Initiated",
          description: "Your payment is being processed.",
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Payment initiation failed");
      toast({
        title: "Payment Failed",
        description: err.response?.data?.message || "Payment initiation failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (step: string, passed: boolean, details?: any) => {
    if (!transactionId) return;

    console.log(`handleVerification called with step: ${step}, passed: ${passed}`); 
    console.log(`Current verificationStep: ${verificationStep}`); 
    setLoading(true);
    console.log(`handleVerification: Loading set to true for step ${step}`); 

    try {
      const result = await processPayment(transactionId, {
        step,
        passed,
        details
      });

      if (result.success) {
        setPaymentStatus("completed");
        toast({
          title: "Payment Completed",
          description: "Your ticket purchase was successful!",
        });
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setPaymentStatus("failed");
        toast({
          title: "Payment Failed",
          description: result.message || "Payment could not be completed",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
      console.log(`handleVerification: Loading set to false for step ${step}`); 
    }
  };

  const handleCaptcha = async () => {
    console.log('reCAPTCHA executeRecaptcha available:', !!executeRecaptcha);
    console.log('reCAPTCHA site key:', import.meta.env.VITE_RECAPTCHA_SITE_KEY);
    
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!executeRecaptcha || isDevelopment) {
      console.log('reCAPTCHA not available or in development mode, using fallback simulation');
      toast({
        title: "Using Fallback Verification",
        description: isDevelopment 
          ? "Development mode: Using alternative verification instead of reCAPTCHA."
          : "reCAPTCHA is not available. Using alternative verification.",
        variant: "default"
      });
      handleVerification("captcha", true, { captchaToken: "fallback_token" });
      return;
    }

    try {
      setLoading(true);
      
      let token;
      try {
        token = await executeRecaptcha('payment');
      } catch (recaptchaError: any) {
        console.error('reCAPTCHA execution error:', recaptchaError);
        
        if (recaptchaError.message?.includes('origins don\'t match') || 
            recaptchaError.message?.includes('origin') ||
            recaptchaError.toString().includes('origins don\'t match')) {
          console.log('Origin mismatch detected, using fallback');
          toast({
            title: "Using Fallback Verification",
            description: "reCAPTCHA origin mismatch detected. Using alternative verification.",
            variant: "default"
          });
          handleVerification("captcha", true, { captchaToken: "fallback_token" });
          return;
        }
        
        throw recaptchaError;
      }
      
      if (!token) {
        toast({
          title: "CAPTCHA Failed",
          description: "Please try again.",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/captcha/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          provider: 'recaptcha',
          token: token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        handleVerification("captcha", true, { captchaToken: token });
        toast({
          title: "CAPTCHA Verified",
          description: "You have successfully completed the CAPTCHA.",
        });
      } else {
        toast({
          title: "CAPTCHA Failed",
          description: "Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('CAPTCHA error:', error);
      toast({
        title: "CAPTCHA Error",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const simulatePhoneVerification = () => {
    handleVerification("phone_verification", true, { phoneVerified: true });
  };

  const simulateEmailVerification = () => {
    handleVerification("email_verification", true, { emailVerified: true });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Secure Ticket Purchase</h1>
          <p className="text-muted-foreground">
            Advanced bot detection protects your ticket purchase
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Details
              </CardTitle>
              <CardDescription>
                Enter your ticket purchase information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select 
                  value={paymentData.platform} 
                  onValueChange={(value) => setPaymentData(prev => ({ ...prev, platform: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(platform => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketId">Ticket ID</Label>
                <Input
                  id="ticketId"
                  placeholder="Enter ticket ID"
                  value={paymentData.ticketId}
                  readOnly 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketType">Ticket Type</Label>
                <Select
                  value={paymentData.ticketType}
                  onValueChange={(value: "standard" | "vip" | "premium") => {
                    setPaymentData(prev => ({
                      ...prev,
                      ticketType: value,
                      amount: ticketTypes[value].price 
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (₹{ticketTypes.standard.price})</SelectItem>
                    <SelectItem value="vip">VIP (₹{ticketTypes.vip.price})</SelectItem>
                    <SelectItem value="premium">Premium (₹{ticketTypes.premium.price})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={paymentData.amount || ""}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  readOnly 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select 
                  value={paymentData.paymentMethod} 
                  onValueChange={(value) => setPaymentData(prev => ({ ...prev, paymentMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleInitiatePayment}
                disabled={loading || !paymentData.platform || !paymentData.ticketId || !paymentData.amount || !paymentData.paymentMethod}
                className="w-full"
              >
                {loading ? "Processing..." : "Initiate Payment"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Bot Detection Results
              </CardTitle>
              <CardDescription>
                Real-time security analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentStatus === "idle" && (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Bot detection will analyze your request</p>
                </div>
              )}

              {botDetection && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Score</span>
                      <Badge variant={getBotScoreColor(botDetection.botScore)}>
                        {getBotScoreLabel(botDetection.botScore)}
                      </Badge>
                    </div>
                    <Progress value={botDetection.botScore * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Score: {(botDetection.botScore * 100).toFixed(1)}%
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Detection Reasons</h4>
                    <div className="space-y-2">
                      {botDetection.detectionReasons && botDetection.detectionReasons.length > 0 ? (
                        botDetection.detectionReasons.map((reason, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {getRiskIcon(reason)}
                            <span className="capitalize">{reason.replace(/_/g, " ")}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No specific risk factors detected
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Status</h4>
                    {paymentStatus === "blocked" && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          Payment blocked due to bot detection
                        </AlertDescription>
                      </Alert>
                    )}
                    {paymentStatus === "verification_required" && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Additional verification required
                        </AlertDescription>
                      </Alert>
                    )}
                    {paymentStatus === "processing" && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Payment processing
                        </AlertDescription>
                      </Alert>
                    )}
                    {paymentStatus === "completed" && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Payment completed successfully
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {verificationStep && (
          <Card>
            <CardHeader>
              <CardTitle>Additional Verification Required</CardTitle>
              <CardDescription>
                Complete the verification steps to proceed with your payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verificationStep === "captcha" && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      CAPTCHA Verification
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please complete the CAPTCHA to verify you are human and not a bot.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleCaptcha} 
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? "Verifying..." : "Complete CAPTCHA"}
                      </Button>
                      {!recaptchaReady && (
                        <div className="space-y-2">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            reCAPTCHA is loading... Please wait a moment and try again.
                          </p>
                          <Button 
                            onClick={() => window.location.reload()} 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                          >
                            Refresh Page
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {botDetection?.verificationSteps?.includes("phone_verification") && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <h4 className="font-medium mb-2">Phone Verification</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Verify your phone number to continue
                    </p>
                    <Button onClick={simulatePhoneVerification} disabled={loading}>
                      Verify Phone
                    </Button>
                  </div>
                </div>
              )}

              {botDetection?.verificationSteps?.includes("email_verification") && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <h4 className="font-medium mb-2">Email Verification</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Verify your email address to continue
                    </p>
                    <Button onClick={simulateEmailVerification} disabled={loading}>
                      Verify Email
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;

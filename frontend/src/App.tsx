import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute"; 
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Payment from "./pages/Payment";
import PaymentHistory from "./pages/PaymentHistory";
import NotFound from "./pages/NotFound";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const queryClient = new QueryClient();

window.addEventListener('error', (event) => {
  if (event.message?.includes('origins don\'t match') || 
      event.message?.includes('recaptcha') ||
      event.message?.includes('google.com') ||
      event.filename?.includes('recaptcha') ||
      event.filename?.includes('contentScript') ||
      event.filename?.includes('injected')) {
    console.warn('reCAPTCHA origin mismatch detected, this is expected in development');
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('origins don\'t match') ||
      event.reason?.message?.includes('recaptcha') ||
      event.reason?.toString().includes('origins don\'t match')) {
    console.warn('reCAPTCHA origin mismatch in promise rejection, this is expected in development');
    event.preventDefault();
  }
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="botshield-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/payment" element={
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
                  <Payment />
                ) : (
                  <GoogleReCaptchaProvider 
                    reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                    useRecaptchaNet={false}
                    useEnterprise={false}
                    scriptProps={{
                      async: false,
                      defer: false,
                      appendTo: "head",
                      nonce: undefined,
                    }}
                    container={{
                      element: undefined,
                      parameters: {
                        badge: 'bottomright',
                        theme: 'dark',
                      }
                    }}
                  >
                    <Payment />
                  </GoogleReCaptchaProvider>
                )
              } />
              <Route path="/payment-history" element={<PaymentHistory />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

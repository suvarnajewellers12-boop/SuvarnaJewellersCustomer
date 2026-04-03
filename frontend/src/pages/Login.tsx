import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Smartphone,
  Sparkles,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import GoldDustParticles from "@/components/GoldDustParticles";

const MOCK_OTP = "123456";

const Login = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  const isSignup = mode === "signup";

  const resetForm = () => {
    setPhone("");
    setName("");
    setPassword("");
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setVerified(false);
    setError("");
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (phone.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    if (isSignup) {
      if (name.trim().length < 2) {
        setError("Enter your full name");
        return;
      }

      setError("");
      setOtpSent(true);
    } else {
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password }),
        });

        const contentType = response.headers.get("content-type");

        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(
            "Server error: Backend is not sending JSON. Check your API server."
          );
        }

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || "Login failed");

        setVerified(true);

        setTimeout(() => {
          login(data.user);
          navigate("/dashboard");
        }, 1800);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const entered = otp.join("");

    if (entered === MOCK_OTP) {
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phone,
            password,
          }),
        });

        const contentType = response.headers.get("content-type");

        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Signup failed: Backend did not return JSON.");
        }

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || "Signup failed");

        setVerified(true);

        setTimeout(() => {
          login(data.user);
          navigate("/dashboard");
        }, 1800);
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      setError("Invalid OTP. Try 123456");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  return (
    <Layout>
      <section className="min-h-screen flex items-center justify-center px-4 pt-24 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-ivory" />
        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-spotlight)" }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-48"
          style={{
            background:
              "linear-gradient(180deg, hsla(38, 40%, 75%, 0.08) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23b8860b' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        <GoldDustParticles />

        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsla(43, 70%, 55%, 0.1) 0%, hsla(43, 70%, 55%, 0.04) 40%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 w-full max-w-md"
        >
          <div
            className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden"
            style={{ boxShadow: "var(--shadow-depth)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, hsla(43, 70%, 60%, 0.05) 0%, transparent 60%)",
              }}
            />

            {/* rest of your UI remains unchanged exactly */}

          </div>
        </motion.div>
      </section>
    </Layout>
  );
};

export default Login;
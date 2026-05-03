import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";

export interface Scheme {
  id: string;
  schemeId: string;
  name: string;
  monthlyAmount: number;
  durationMonths: number;
  enrolledDate: string;
  installmentsPaid: number;
}

interface User {
  id?: string;
  phone: string;
  name: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  enrolledSchemes: Scheme[];
  setEnrolledSchemes: React.Dispatch<React.SetStateAction<Scheme[]>>;
  login: (user: User) => void;
  loginAndLoad: (userData: any, token: string) => Promise<void>; // ← ADDED
  logout: () => void;
  enrollScheme: (schemeData: any) => Promise<void>;
  payInstallment: (customerSchemeId: string) => Promise<void>;
  refreshSchemes: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://suvarna-jewellers-customer-backend.vercel.app";

const formatScheme = (s: any): Scheme => ({
  id: s.id,
  schemeId: s.schemeId,
  name: s.Scheme?.name || "Active Scheme",
  monthlyAmount: s.Scheme?.monthlyAmount || 0,
  durationMonths: s.Scheme?.durationMonths || 11,
  enrolledDate: s.startDate,
  installmentsPaid: s.installmentsPaid,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledSchemes, setEnrolledSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsLoading(false);
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        // Both calls fire at the same time
        const [userRes, schemesRes] = await Promise.all([
          fetch(`${API_URL}/api/auth/me`, { headers }),
          fetch(`${API_URL}/api/schemes/my`, { headers }),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            setUser(userData.user);
            setIsLoggedIn(true);
          } else {
            localStorage.removeItem("token");
          }
        }

        if (schemesRes.ok) {
          const schemesData = await schemesRes.json();
          setEnrolledSchemes((schemesData.schemes || []).map(formatScheme));
        }
      } catch (err) {
        console.error("Session check failed");
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  // Silent background refresh — no spinner
  const refreshSchemes = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/api/schemes/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setEnrolledSchemes((data.schemes || []).map(formatScheme));
      }
    } catch (err) {
      console.error("Schemes refresh failed:", err);
    }
  }, []);

  // Called right after login — fetches schemes during the 1.8s animation
  // so Dashboard is instant when you arrive
  const loginAndLoad = useCallback(async (userData: any, token: string) => {
    setUser(userData);
    setIsLoggedIn(true);
    try {
      const res = await fetch(`${API_URL}/api/schemes/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setEnrolledSchemes((data.schemes || []).map(formatScheme));
      }
    } catch (err) {
      console.error("Post-login schemes fetch failed:", err);
    }
  }, []);

  const login = (userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    } catch {}
    setUser(null);
    setIsLoggedIn(false);
    setEnrolledSchemes([]);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const enrollScheme = async (schemeData: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/schemes/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schemeId: schemeData.id,
          monthlyAmount: schemeData.monthlyAmount,
          durationMonths: schemeData.durationMonths,
        }),
      });
      if (!res.ok) throw new Error("Enrollment failed");
      await refreshSchemes();
    } catch (err: any) {
      console.error("Enrollment failed:", err.message);
    }
  };

  const payInstallment = async (customerSchemeId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/schemes/pay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customerSchemeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Payment failed");
      }
      await refreshSchemes();
    } catch (err: any) {
      console.error("Payment failed:", err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        isLoading,
        enrolledSchemes,
        setEnrolledSchemes,
        login,
        loginAndLoad, // ← ADDED
        logout,
        enrollScheme,
        payInstallment,
        refreshSchemes,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
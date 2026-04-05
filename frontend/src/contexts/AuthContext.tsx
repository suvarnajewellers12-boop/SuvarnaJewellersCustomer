import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface Scheme {
  id: string;
  name: string;
  monthlyAmount: number;
  durationMonths: number;
  maturityAmount?: number;
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
  logout: () => void;
  enrollScheme: (schemeData: any) => Promise<void>;
  payInstallment: (customerSchemeId: string) => Promise<void>; 
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledSchemes, setEnrolledSchemes] = useState<Scheme[]>([]);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://suvarna-jewellers-customer-backend.vercel.app";

  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = localStorage.getItem("token");
        
        if (!token) {
          setIsLoading(false);
          setIsLoggedIn(false);
          return;
        }

        const res = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setIsLoggedIn(true);
          } else {
            // If server says user is null, local token is invalid
            localStorage.removeItem("token");
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.error("Session check failed");
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [API_URL]);

  const login = (userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      setUser(null);
      setIsLoggedIn(false);
      setEnrolledSchemes([]);
      localStorage.removeItem("token");
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const enrollScheme = async (schemeData: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/schemes/enroll`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          schemeId: schemeData.id,
          monthlyAmount: schemeData.monthlyAmount,
          durationMonths: schemeData.durationMonths,
        }),
      });

      if (!res.ok) throw new Error("Enrollment failed");

      window.dispatchEvent(new Event("schemeUpdated"));
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
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ customerSchemeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Payment failed");
      }

      window.dispatchEvent(new Event("schemeUpdated")); 
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
        logout,
        enrollScheme,
        payInstallment, 
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
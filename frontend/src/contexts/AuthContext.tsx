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

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setIsLoggedIn(true);
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

  const login = (userData: User) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
      setIsLoggedIn(false);
      setEnrolledSchemes([]);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const enrollScheme = async (schemeData: any) => {
    try {
      const res = await fetch(`${API_URL}/api/schemes/enroll`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId: schemeData.id,
          monthlyAmount: schemeData.monthlyAmount,
          durationMonths: schemeData.durationMonths,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Enrollment failed");
      }

      const formatted: Scheme = {
        id: data.id,
        name: data.Scheme?.name || "New Scheme",
        monthlyAmount: data.totalPaid,
        durationMonths: data.Scheme?.durationMonths || 11,
        enrolledDate: data.startDate,
        installmentsPaid: data.installmentsPaid,
      };

      window.dispatchEvent(new Event("schemeUpdated"));
    } catch (err: any) {
      console.error("Enrollment failed:", err.message);
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
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
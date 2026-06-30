import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

export interface Scheme {
  id: string;
  name: string;
  monthlyAmount: number;
  durationMonths: number;
  maturityAmount?: number;
  enrolledDate: string;
  installmentsPaid: number;

  // NEW
  isWeightBased?: boolean;
  accumulatedGrams?: number;
  totalPaid?: number;
  schemeId?: string;
  lastPaymentGrams?: number;
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
  setEnrolledSchemes: React.Dispatch<
    React.SetStateAction<Scheme[]>
  >;

  login: (user: User) => void;
  loginAndLoad: (user: User, token: string) => Promise<void>;
  logout: () => void;

  enrollScheme: (schemeData: any) => Promise<void>;
  payInstallment: (
    customerSchemeId: string
  ) => Promise<void>;

  refreshSchemes: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
};

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [user, setUser] =
    useState<User | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [enrolledSchemes, setEnrolledSchemes] =
    useState<Scheme[]>([]);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://suvarna-jewellers-customer-backend.vercel.app";

  // =====================================================
  // REFRESH SCHEMES
  // =====================================================

  const refreshSchemes = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) return;

      const res = await fetch(
        `${API_URL}/api/schemes/my`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      // IMPORTANT FIX
      const mappedSchemes = (
        data.schemes || []
      ).map((e: any) => {
        const scheme = e.Scheme || {};

        return {
          id: e.id,
          schemeId: e.schemeId,

          name:
            scheme.name || "Unnamed Scheme",

          monthlyAmount: Number(
            scheme.monthlyAmount || 0
          ),

          durationMonths: Number(
            scheme.durationMonths || 1
          ),

          installmentsPaid: Number(
            e.installmentsPaid || 0
          ),

          enrolledDate:
            e.startDate ||
            new Date().toISOString(),

          // NEW FIELDS
          isWeightBased:
            scheme.isWeightBased === true,

          accumulatedGrams: Number(
  e.accumulatedGrams || 0
),

totalPaid: Number(
  e.totalPaid || 0
),

lastPaymentGrams: (() => {
  const history = e.PaymentHistory ?? [];

  if (history.length === 0) {
    return 0;
  }

  return Number(
    history[0]?.gramsAdded || 0
  );
})(),
        };
      });

      setEnrolledSchemes(mappedSchemes);
    } catch (err) {
      console.error(
        "Failed to refresh schemes",
        err
      );
    }
  };

  // =====================================================
  // CHECK USER
  // =====================================================

  useEffect(() => {
    const checkUser = async () => {
      try {
        const token =
          localStorage.getItem("token");

        if (!token) {
          setIsLoggedIn(false);
          setIsLoading(false);
          return;
        }

        const res = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();

          if (data.user) {
            setUser(data.user);
            setIsLoggedIn(true);

            // LOAD USER SCHEMES
            await refreshSchemes();
          } else {
            localStorage.removeItem("token");

            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.error(
          "Session check failed",
          err
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  // =====================================================
  // LOGIN
  // =====================================================

  const login = async (userData: any) => {
    setUser(userData);

    setIsLoggedIn(true);

    await refreshSchemes();
  };

  // =====================================================
  // LOGIN AND LOAD (Background hydration fix for Login.tsx)
  // =====================================================

  const loginAndLoad = async (userData: any, token: string) => {
    localStorage.setItem("token", token);
    setUser(userData);
    setIsLoggedIn(true);
    await refreshSchemes();
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = async () => {
    try {
      setUser(null);
      setIsLoggedIn(false);
      setEnrolledSchemes([]);
      localStorage.removeItem("token");

      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // =====================================================
  // ENROLL SCHEME
  // =====================================================

  const enrollScheme = async (
    schemeData: any
  ) => {
    try {
      const token =
        localStorage.getItem("token");

      const res = await fetch(
        `${API_URL}/api/schemes/enroll`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            schemeId: schemeData.id,
            monthlyAmount:
              schemeData.monthlyAmount,
            durationMonths:
              schemeData.durationMonths,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Enrollment failed"
        );
      }

      // REFRESH SCHEMES
      await refreshSchemes();
    } catch (err: any) {
      console.error(
        "Enrollment failed:",
        err.message
      );
    }
  };

  // =====================================================
  // PAY INSTALLMENT
  // =====================================================

  const payInstallment = async (
    customerSchemeId: string
  ) => {
    try {
      const token =
        localStorage.getItem("token");

      const res = await fetch(
        `${API_URL}/api/schemes/pay`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            customerSchemeId,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();

        throw new Error(
          data.message || "Payment failed"
        );
      }

      // REFRESH
      await refreshSchemes();
    } catch (err: any) {
      console.error(
        "Payment failed:",
        err.message
      );

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
        loginAndLoad,
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
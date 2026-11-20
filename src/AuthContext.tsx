import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "./auth.ts";
import type { AuthUser } from "./auth.ts";

type AuthContextValue = {
    user: AuthUser | null;
    // True only during the initial fetchMe() hydration on mount - lets
    // callers (Header) avoid flashing "Sign in" for a moment before a
    // real session cookie resolves.
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void authApi
            .fetchMe()
            .then((fetched) => { if (!cancelled) setUser(fetched); })
            .catch((error: unknown) => { console.error("Failed to fetch current user:", error); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setUser(await authApi.login(email, password));
    }, []);
    const signup = useCallback(async (email: string, password: string) => {
        setUser(await authApi.signup(email, password));
    }, []);
    const logout = useCallback(async () => {
        await authApi.logout();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
}

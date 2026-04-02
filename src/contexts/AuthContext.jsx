import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (email, password, type) => {
    // Mock login
    const mockUser = {
      id: 1,
      name: type === "official" ? "Б. Болд" : "Хэрэглэгч",
      email,
      type,
      role: email.includes("admin") ? "admin" : "user",
    };
    setUser(mockUser);
    return true;
  };

  const logout = () => setUser(null);

  const register = (data) => {
    const newUser = { ...data, id: Date.now(), role: "user" };
    setUser(newUser);
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

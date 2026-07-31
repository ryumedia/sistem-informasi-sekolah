"use client";

import { createContext, useContext } from 'react';

/**
 * Mendefinisikan tipe data untuk nilai konteks pengguna.
 * userData bisa berisi tipe data yang lebih spesifik jika Anda sudah memilikinya.
 */
export interface UserContextType {
  userData: any; 
  isAuthDataLoaded: boolean;
}

// Membuat konteks dengan nilai awal `undefined`.
const UserContext = createContext<UserContextType | undefined>(undefined);

// Mengekspor Provider dari konteks yang telah dibuat.
export const UserProvider = UserContext.Provider;

// Membuat custom hook `useUser` untuk mempermudah penggunaan konteks.
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser harus digunakan di dalam UserProvider');
  }
  return context;
}
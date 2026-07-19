import { clsx, type ClassValue } from "clsx"
import CryptoJS from "crypto-js"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || "vnierp-fallback-secret-key-2026"

export function encryptData(data: string): string {
  if (!data) return ""
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString()
}

export function decryptData(cipherText: string): string {
  if (!cipherText) return ""
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (err) {
    console.error("Error decrypting data", err)
    return ""
  }
}

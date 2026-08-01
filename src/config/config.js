// Configuration file for Bite&Co application

export const config = {
  // App Information
  appName: "Bite&Co",
  appDescription: "Your Ultimate Food Ordering & Catering Platform",
  appVersion: "1.0.0",
  
  // Brand Colors
  colors: {
    primary: "#711330",
    secondary: "#8B1538",
    accent: "#A91D4A",
    light: "#F8F9FA",
    dark: "#2D3748",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6"
  },
  
  // App Store Links
  appStore: {
    android: "https://play.google.com/store/apps/details?id=com.biteandco.app",
    ios: "https://apps.apple.com/app/bite-co/id1234567890", // Placeholder
    webApp: "https://app.biteandco.id"
  },
  
  // Contact Information
  contact: {
    email: "hello@biteandco.com",
    phone: "+62 21 1234 5678",
    whatsapp: "+62 812 3456 7890",
    address: "Jakarta, Indonesia"
  },
  
  // Social Media
  social: {
    instagram: "https://instagram.com/biteandco",
    facebook: "https://facebook.com/biteandco",
    twitter: "https://twitter.com/biteandco",
    linkedin: "https://linkedin.com/company/biteandco"
  },
  
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api",
    version: "v1"
  },
  
  // Feature Flags
  features: {
    cateringOrders: true,
    realTimeTracking: true,
    multiplePayments: true,
    reviewSystem: true,
    chatSupport: true,
    bulkOrders: true
  }
}

export default config

import { Configuration, PopupRequest } from '@azure/msal-browser';

/**
 * Configuration MSAL pour Azure AD
 * Authentification SSO Microsoft (SPA)
 */
export const msalConfig: Configuration = {
  auth: {
    /**
     * ✅ OBLIGATOIRE
     * Ne jamais mettre de fallback vide :
     * si absent, le build doit échouer (meilleur qu’un bug OAuth silencieux)
     */
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID!,

    /**
     * ✅ Tenant Azure AD
     */
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,

    /**
     * ✅ MSAL SPA → URL de base de l’application
     * PAS de /api/auth/*
     */
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI!,

    /**
     * ✅ Redirection après logout
     */
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI!,
  },

  /**
   * Cache MSAL
   */
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },

  /**
   * Logging MSAL (debug utile en dev / pre-prod)
   */
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;

        switch (level) {
          case 0: // Error
            console.error(message);
            break;
          case 1: // Warning
            console.warn(message);
            break;
          case 2: // Info
            console.info(message);
            break;
          case 3: // Verbose
            console.debug(message);
            break;
        }
      },
    },
  },
};

/**
 * Scopes demandés lors du login
 * Microsoft Graph (profil + calendrier)
 */
export const loginRequest: PopupRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
  ],
};

/**
 * Scopes pour l'acquisition silencieuse de token
 */
export const tokenRequest = {
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
  ],
};


import { Configuration, PopupRequest } from '@azure/msal-browser';

// MSAL configuration for Azure AD SSO (SPA)
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI!,
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI!,
  },

  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },

  system: {
    tokenRenewalOffsetSeconds: 300,
    windowHashTimeout: 60000,
    iframeHashTimeout: 10000,
    loadFrameTimeout: 10000,
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

// Login scopes: profile + shared calendar access
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

// Silent token acquisition scopes
export const tokenRequest = {
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
  ],
};

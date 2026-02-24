import { Configuration, PopupRequest } from '@azure/msal-browser';

// MSAL configuration for Azure AD SSO (SPA)
export const msalConfig: Configuration = {
  auth: {
    // Required - Azure AD application client ID
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID!,

    // Azure AD tenant authority
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,

    // MSAL SPA redirect URI (base app URL, not /api/auth/*)
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI!,

    // Post-logout redirect
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

// Scopes requested during login (Microsoft Graph: profile + calendar + mail)
export const loginRequest: PopupRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
    'Mail.Send.Shared',
    'Mail.Read.Shared',
  ],
};

// Scopes for silent token acquisition
export const tokenRequest = {
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Calendars.ReadWrite.Shared',
    'Mail.Send.Shared',
    'Mail.Read.Shared',
  ],
};

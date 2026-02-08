# Configuration du SSO Microsoft Azure AD

Ce guide explique comment configurer l'authentification SSO Microsoft pour l'application Shift Manager.

## Prérequis

- Un compte Microsoft Azure avec accès à Azure AD (admin.microsoft.com)
- Une application enregistrée dans Azure AD
- Tenant ID et Client ID de votre application Azure AD

## Étape 1 : Configuration dans Azure AD (admin.microsoft.com)

### 1.1 Enregistrer l'application (déjà fait)

✅ Vous avez déjà enregistré votre application dans Azure AD.

### 1.2 Configurer les Redirect URIs

Dans le portail Azure AD, accédez à votre application et configurez :

**Développement :**
- `http://localhost:3000`
- `http://localhost:3001`

**Production :**
- `https://votre-domaine.com`

### 1.3 Permissions API (déjà configurées)

Vous avez déjà configuré les permissions suivantes :
- ✅ `User.Read` - Information de base sur l'utilisateur
- ✅ `Calendars.ReadBasic` - Lecture basique des calendriers
- ✅ `Calendars.Read` - Lecture complète des calendriers
- ✅ `Calendars.Read.Shared` - Lecture des calendriers partagés
- ✅ `Calendars.ReadWrite` - Lecture et écriture dans les calendriers

**Important :** Assurez-vous que ces permissions sont **accordées** (Grant admin consent).

### 1.4 Type d'application

Dans "Authentication" > "Platform configurations" :
- Type : **Single-page application (SPA)**
- Allow implicit flow : **Non** (MSAL utilise PKCE par défaut)

## Étape 2 : Configuration de l'application Next.js

### 2.1 Fichier `.env`

Ouvrez le fichier `.env` à la racine du projet et remplacez les valeurs suivantes :

```env
# Azure AD / Microsoft SSO Configuration
NEXT_PUBLIC_AZURE_AD_CLIENT_ID="VOTRE_CLIENT_ID_ICI"
NEXT_PUBLIC_AZURE_AD_TENANT_ID="VOTRE_TENANT_ID_ICI"
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI="http://localhost:3001"
```

**Où trouver ces valeurs dans Azure AD :**

1. **Client ID (Application ID)** :
   - Azure Portal > Azure Active Directory > App registrations
   - Sélectionnez votre application
   - Copiez "Application (client) ID"

2. **Tenant ID** :
   - Azure Portal > Azure Active Directory > App registrations
   - Sélectionnez votre application
   - Copiez "Directory (tenant) ID"

### 2.2 Redémarrer le serveur

Après avoir modifié le fichier `.env`, redémarrez le serveur de développement :

```bash
# Arrêter le serveur actuel (Ctrl+C)
npm run dev
```

## Étape 3 : Test de la connexion SSO

1. Accédez à `http://localhost:3001/login`
2. Cliquez sur le bouton **"Se connecter avec Azure AD"**
3. Une popup Microsoft s'ouvrira
4. Connectez-vous avec vos identifiants Microsoft
5. Accordez les permissions si demandées
6. Vous serez automatiquement redirigé vers le dashboard

## Architecture de l'authentification

### Fichiers créés

```
Autoplanner/
├── lib/
│   ├── msalConfig.ts              # Configuration MSAL et scopes
│   └── hooks/
│       └── useGraphAPI.ts         # Hook pour Microsoft Graph API
├── contexts/
│   └── AuthContext.tsx            # Contexte d'authentification global
├── app/
│   ├── layout.tsx                 # Wrapper avec AuthProvider
│   └── login/
│       └── page.tsx               # Page de connexion avec SSO
└── docs/
    ├── SSO_SETUP.md               # Ce fichier
    └── GRAPH_API_USAGE.md         # Guide d'utilisation de l'API Graph
```

### Flux d'authentification

1. **Initialisation** : `AuthProvider` initialise MSAL au chargement de l'application
2. **Connexion** : L'utilisateur clique sur "Se connecter avec Azure AD"
3. **Popup** : MSAL ouvre une popup Microsoft pour l'authentification
4. **Token** : Après authentification, un token d'accès est obtenu
5. **Session** : Le token est stocké et géré automatiquement par MSAL
6. **Graph API** : Le hook `useGraphAPI` utilise ce token pour les appels API

### Méthodes d'authentification

#### SSO Microsoft (Principal - Production)
- Utilisé pour l'authentification en production
- Accès aux calendriers Microsoft
- Gestion automatique des tokens

#### Email/Password (Temporaire - Développement)
- ⚠️ **TEMPORAIRE** : Sera supprimé dans une version future
- Marqué avec `@deprecated` dans le code
- Visible avec un avertissement sur la page de connexion
- Ne donne pas accès aux calendriers Microsoft

## Utilisation de l'API Graph

Une fois authentifié via SSO, vous pouvez utiliser le hook `useGraphAPI` pour accéder aux calendriers :

```tsx
import { useGraphAPI } from '@/lib/hooks/useGraphAPI';

export default function MyComponent() {
  const { getCalendarEvents } = useGraphAPI();

  const fetchEvents = async () => {
    const events = await getCalendarEvents();
    console.log(events);
  };

  return <button onClick={fetchEvents}>Récupérer mes événements</button>;
}
```

Consultez `docs/GRAPH_API_USAGE.md` pour plus d'exemples.

## Résolution des problèmes

### Erreur : "MSAL n'est pas initialisé"
- Vérifiez que `AuthProvider` enveloppe bien votre application dans `layout.tsx`
- Vérifiez que les variables d'environnement sont correctement configurées

### Erreur : "Impossible d'obtenir le token d'accès"
- Vérifiez que les permissions sont accordées dans Azure AD
- Vérifiez que le Tenant ID et Client ID sont corrects
- Essayez de vous déconnecter et de vous reconnecter

### Popup bloquée par le navigateur
- Autorisez les popups pour `http://localhost:3001`
- Vérifiez que le bloqueur de popups n'est pas actif

### Erreur : "Invalid redirect URI"
- Vérifiez que l'URI de redirection est configurée dans Azure AD
- Assurez-vous que l'URI correspond exactement (port inclus)

### Permissions refusées
- Accédez au portail Azure AD
- App registrations > Votre app > API permissions
- Cliquez sur "Grant admin consent" pour accorder les permissions

## Sécurité

- ✅ Les tokens sont stockés dans `sessionStorage` (plus sécurisé que `localStorage`)
- ✅ MSAL utilise PKCE (Proof Key for Code Exchange) par défaut
- ✅ Les tokens sont automatiquement rafraîchis
- ✅ Les appels API incluent automatiquement le token Bearer
- ⚠️ Ne commitez jamais le fichier `.env` avec vos vraies valeurs

## Prochaines étapes

1. ✅ Configurer les variables d'environnement
2. ✅ Tester la connexion SSO
3. ✅ Vérifier l'accès aux calendriers
4. 🔜 Intégrer les calendriers dans l'application
5. 🔜 Supprimer la méthode de connexion email/password

## Ressources

- [Azure AD Documentation](https://learn.microsoft.com/en-us/azure/active-directory/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
